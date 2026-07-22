import { parseTimerExpression, type BpmnDiagram } from '@buildtovalue/core';
import { buildEngineGraph, type EngineGraph, type EngineNode } from './graph.js';
import { ENGINE_VERSION } from './version.js';
import {
  EngineInvariantError,
  ROOT_SCOPE,
  type AdvanceResult,
  type ConditionEvaluator,
  type Effect,
  type EngineEvent,
  type InstanceState,
  type Token,
  type Wait,
} from './types.js';

export { ENGINE_VERSION };

/** Versão do FORMATO de InstanceState (D14; migrações puras encadeadas). */
export const STATE_SCHEMA_VERSION = 1;

export interface EngineOptions {
  /** Avaliador S-FEEL injetado pelo host; sem ele, gateway com condição vira
   * incidente estrutural (nunca escolha arbitrária). */
  conditions?: ConditionEvaluator;
}

export interface Engine {
  initialState(definitionRef: InstanceState['definitionRef']): InstanceState;
  advance(state: InstanceState, event: EngineEvent): AdvanceResult;
}

/** Tipos de nó que um token ATRAVESSA sem esperar (subset v1). */
const PASS_THROUGH_TYPES = new Set(['task', 'startEvent']);

/**
 * Cria o engine para UMA definição BPMN. `advance` é pura e determinística:
 * mesma (state, event) ⇒ mesmos (state', effects) byte-idênticos sob
 * canonicalJsonExact (invariante 2). Extraída da semântica de tokens do
 * `@buildtovalue/simulation` (D10) — passo, split AND, sync join com
 * `joinArrivals` (agora persistido, condição a/c do ADR-0001), boundary
 * interruptivo/não-interruptivo — reformulada de classe small-step para
 * função com esperas explícitas e run-to-quiescence.
 *
 * Incidentes têm duas classes (documentado no ADR):
 * - ESTRUTURAIS (elemento não suportado, sem rota, timer inválido, deadlock):
 *   `RaiseIncident` + status='incident' — o avanço congela (D19 defensivo).
 * - OPERACIONAIS (jobFailed com retries esgotados): `RaiseIncident` com a
 *   instância ATIVA — o operador resolve/repete pela Operação (F3).
 */
export function createEngine(diagram: BpmnDiagram, options: EngineOptions = {}): Engine {
  const graph = buildEngineGraph(diagram);

  return {
    initialState(definitionRef) {
      return {
        stateSchemaVersion: STATE_SCHEMA_VERSION,
        engineVersion: ENGINE_VERSION,
        definitionRef,
        tokens: [],
        waits: [],
        joinArrivals: {},
        sequence: 0,
        status: 'active',
      };
    },
    advance(state, event) {
      return advanceImpl(graph, options, state, event);
    },
  };
}

// ------------------------------------------------------------------ interno

interface Ctx {
  graph: EngineGraph;
  options: EngineOptions;
  state: InstanceState;
  effects: Effect[];
  event: EngineEvent;
}

function reject(kind: string, message: string): AdvanceResult {
  return { ok: false, rejection: { kind, message } };
}

function advanceImpl(
  graph: EngineGraph,
  options: EngineOptions,
  input: InstanceState,
  event: EngineEvent,
): AdvanceResult {
  if (input.status === 'completed' || input.status === 'cancelled') {
    return reject('alreadyClosed', `instância ${input.status}; evento ${event.type} não se aplica`);
  }
  if (input.status === 'incident' && event.type !== 'CancelInstance') {
    return reject('invalidTransition', 'instância em incidente estrutural: só CancelInstance');
  }

  const state = structuredClone(input) as InstanceState;
  const ctx: Ctx = { graph, options, state, effects: [], event };

  switch (event.type) {
    case 'StartInstance': {
      if (state.sequence > 0 || state.tokens.length > 0 || state.waits.length > 0) {
        return reject('invalidTransition', 'StartInstance sobre instância já iniciada');
      }
      if (graph.starts.length !== 1) {
        structuralIncident(
          ctx,
          'invalidDefinition',
          `definição tem ${graph.starts.length} start events; o subset v1 exige exatamente 1 (deploy lint deveria ter rejeitado)`,
        );
        return { ok: true, state: finalize(ctx), effects: ctx.effects };
      }
      // Raiz = instanceId, fornecido UMA vez (ADR-0001; sem pool de ids).
      const root = { id: event.instanceId, elementId: graph.starts[0], scopeId: ROOT_SCOPE };
      state.tokens.push(root);
      emitHistory(ctx, 'instanceStarted', {
        instanceId: event.instanceId,
        ...(event.businessKey !== undefined ? { businessKey: event.businessKey } : {}),
      });
      settle(ctx, root);
      break;
    }
    case 'UserTaskCompleted': {
      const wait = takeWait(ctx, event.waitKey, 'userTask');
      if (!wait) return reject('staleWait', `espera ${event.waitKey} inexistente ou fechada`);
      cancelTimersOfToken(ctx, wait.tokenId);
      moveOn(ctx, wait);
      break;
    }
    case 'JobCompleted': {
      const wait = takeWait(ctx, event.waitKey, 'job');
      if (!wait) return reject('staleWait', `espera ${event.waitKey} inexistente ou fechada`);
      cancelTimersOfToken(ctx, wait.tokenId);
      moveOn(ctx, wait);
      break;
    }
    case 'JobFailed': {
      const wait = findWait(state, event.waitKey, 'job');
      if (!wait) return reject('staleWait', `espera ${event.waitKey} inexistente ou fechada`);
      // Retries são do HOST; chegar aqui = esgotados. Incidente OPERACIONAL:
      // a espera fica (retry do operador re-dispara o job), instância ativa.
      ctx.effects.push({
        type: 'RaiseIncident',
        kind: 'jobFailed',
        message: `job ${wait.elementId} falhou definitivamente: ${event.error}`,
      });
      break;
    }
    case 'TimerFired': {
      const wait = takeWait(ctx, event.waitKey, 'timer');
      if (!wait) return reject('staleWait', `espera ${event.waitKey} inexistente ou fechada`);
      const node = requireNode(graph, wait.elementId);
      if (node.boundaryHost !== undefined) {
        fireBoundaryTimer(ctx, node, wait);
      } else {
        moveOn(ctx, wait); // timer intermediário: segue o fluxo
      }
      break;
    }
    case 'CancelInstance': {
      closeAllWaits(ctx);
      clearScopeArrivals(ctx.state, null); // condição b: instância inteira
      state.tokens = [];
      state.status = 'cancelled';
      emitHistory(ctx, 'instanceCancelled', {
        ...(event.reason !== undefined ? { reason: event.reason } : {}),
      });
      return { ok: true, state: finalize(ctx), effects: ctx.effects };
    }
  }

  runToQuiescence(ctx);
  return { ok: true, state: finalize(ctx), effects: ctx.effects };
}

/** Garante a ordenação canônica do joinArrivals (condição c) e devolve. */
function finalize(ctx: Ctx): InstanceState {
  const sorted: Record<string, string[]> = {};
  for (const key of Object.keys(ctx.state.joinArrivals).sort()) {
    sorted[key] = [...ctx.state.joinArrivals[key]].sort();
  }
  ctx.state.joinArrivals = sorted;
  return ctx.state;
}

// -------------------------------------------------------------- esperas

function waitKeyOf(elementId: string, tokenId: string): string {
  return `${elementId}:${tokenId}`;
}

function findWait(state: InstanceState, waitKey: string, kind: Wait['kind']): Wait | undefined {
  return state.waits.find((w) => w.waitKey === waitKey && w.kind === kind);
}

function takeWait(ctx: Ctx, waitKey: string, kind: Wait['kind']): Wait | undefined {
  const wait = findWait(ctx.state, waitKey, kind);
  if (wait) ctx.state.waits = ctx.state.waits.filter((w) => w !== wait);
  return wait;
}

/** Cancela (com efeito) toda espera de TIMER do token — usado quando a
 * atividade host conclui e seus boundaries armados perdem o objeto. */
function cancelTimersOfToken(ctx: Ctx, tokenId: string): void {
  const timers = ctx.state.waits.filter((w) => w.kind === 'timer' && w.tokenId === tokenId);
  for (const timer of timers) ctx.effects.push({ type: 'CancelTimer', waitKey: timer.waitKey });
  ctx.state.waits = ctx.state.waits.filter((w) => !(w.kind === 'timer' && w.tokenId === tokenId));
}

function closeAllWaits(ctx: Ctx): void {
  for (const wait of ctx.state.waits) {
    if (wait.kind === 'userTask') ctx.effects.push({ type: 'CloseUserTask', waitKey: wait.waitKey });
    else if (wait.kind === 'job') ctx.effects.push({ type: 'CancelJob', waitKey: wait.waitKey });
    else ctx.effects.push({ type: 'CancelTimer', waitKey: wait.waitKey });
  }
  ctx.state.waits = [];
}

/** Remove entradas de joinArrivals do escopo (null = todos) — condição b. */
function clearScopeArrivals(state: InstanceState, scopeId: string | null): void {
  for (const key of Object.keys(state.joinArrivals)) {
    if (scopeId === null || key.endsWith(`@${scopeId}`)) delete state.joinArrivals[key];
  }
}

// ------------------------------------------------------- movimentação

function requireNode(graph: EngineGraph, elementId: string): EngineNode {
  const node = graph.nodes.get(elementId);
  if (!node) throw new EngineInvariantError(`elemento ${elementId} não existe no grafo`);
  return node;
}

function tokenOf(ctx: Ctx, tokenId: string): Token {
  const token = ctx.state.tokens.find((t) => t.id === tokenId);
  if (!token) throw new EngineInvariantError(`token ${tokenId} referido por espera não existe`);
  return token;
}

/** Token cuja espera fechou segue adiante a partir do elemento da espera. */
function moveOn(ctx: Ctx, wait: Wait): void {
  const token = tokenOf(ctx, wait.tokenId);
  const node = requireNode(ctx.graph, wait.elementId);
  leaveAlong(ctx, token, node.outgoing);
}

/** Boundary de timer disparou sobre a atividade host do token da espera. */
function fireBoundaryTimer(ctx: Ctx, boundary: EngineNode, wait: Wait): void {
  const hostToken = tokenOf(ctx, wait.tokenId);
  if (boundary.interrupting !== false) {
    // Interruptivo: fecha a espera da atividade host (CloseUserTask/CancelJob
    // — viabilizado pelo catálogo completado na v1.2) e demais timers irmãos;
    // o token re-emerge no boundary.
    const hostWaits = ctx.state.waits.filter(
      (w) => w.tokenId === hostToken.id && w.kind !== 'timer',
    );
    for (const hostWait of hostWaits) {
      ctx.effects.push(
        hostWait.kind === 'userTask'
          ? { type: 'CloseUserTask', waitKey: hostWait.waitKey }
          : { type: 'CancelJob', waitKey: hostWait.waitKey },
      );
    }
    cancelTimersOfToken(ctx, hostToken.id);
    ctx.state.waits = ctx.state.waits.filter((w) => w.tokenId !== hostToken.id);
    emitHistory(ctx, 'boundaryFired', { elementId: boundary.id, interrupting: true });
    ctx.state.sequence += 1;
    hostToken.elementId = boundary.id;
    settle(ctx, hostToken);
  } else {
    // Não-interruptivo: host segue esperando; um token paralelo nasce no
    // boundary (derivação determinística: boundaryId faz papel do flow).
    emitHistory(ctx, 'boundaryFired', { elementId: boundary.id, interrupting: false });
    ctx.state.sequence += 1;
    const spawned: Token = {
      id: `${hostToken.id}/${boundary.id}`,
      elementId: boundary.id,
      scopeId: hostToken.scopeId,
      parentTokenId: hostToken.id,
    };
    ctx.state.tokens.push(spawned);
    settle(ctx, spawned);
  }
}

/** Consome o token e entrega um token por aresta (split quando >1). */
function leaveAlong(ctx: Ctx, token: Token, edgeIds: string[]): void {
  ctx.state.tokens = ctx.state.tokens.filter((t) => t.id !== token.id);
  if (edgeIds.length === 0) {
    ctx.state.sequence += 1; // consumo em end/sink
    return;
  }
  for (const edgeId of edgeIds) {
    const child: Token =
      edgeIds.length === 1
        ? { ...token, id: token.id } // movimento simples preserva a identidade
        : {
            id: `${token.id}/${edgeId}`,
            elementId: token.elementId,
            scopeId: token.scopeId,
            parentTokenId: token.id,
          };
    deliver(ctx, child, edgeId);
    if (ctx.state.status === 'incident') return;
  }
}

/** Atravessa a aresta; trata chegada em AND-join (joinArrivals). */
function deliver(ctx: Ctx, token: Token, edgeId: string): void {
  const edge = ctx.graph.edges.get(edgeId);
  if (!edge) throw new EngineInvariantError(`aresta ${edgeId} não existe no grafo`);
  const target = requireNode(ctx.graph, edge.target);
  ctx.state.sequence += 1;

  const isSyncJoin = target.type === 'parallelGateway' && target.incoming.length > 1;
  if (isSyncJoin) {
    const key = `${target.id}@${token.scopeId}`; // condição a: chave composta
    const arrivals = new Set(ctx.state.joinArrivals[key] ?? []);
    // Condição d.2: segunda chegada pelo MESMO fluxo não infla o set — o
    // token é consumido e a chegada registrada uma única vez (declarado).
    arrivals.add(edgeId);
    const complete = target.incoming.every((e) => arrivals.has(e));
    if (!complete) {
      ctx.state.joinArrivals[key] = [...arrivals].sort(); // condição c
      return; // token absorvido na sincronização
    }
    delete ctx.state.joinArrivals[key];
    const joined: Token = {
      id: `${token.id}/${edgeId}`, // derivado da chegada que COMPLETOU o join
      elementId: target.id,
      scopeId: token.scopeId,
      parentTokenId: token.id,
    };
    ctx.state.tokens.push(joined);
    settle(ctx, joined);
    return;
  }

  token.elementId = target.id;
  ctx.state.tokens.push(token);
  settle(ctx, token);
}

// --------------------------------------------- semântica por elemento

/**
 * Decide o que acontece com um token RECÉM-CHEGADO ao seu elemento: atravessa,
 * espera (emitindo efeitos) ou congela em incidente estrutural. Chamada
 * recursivamente via deliver/leaveAlong até a quiescência (profundidade
 * limitada pelo diagrama; O(elementos) por evento — sem recursão infinita
 * porque todo ciclo passa por espera ou consome sequência de aresta).
 */
function settle(ctx: Ctx, token: Token): void {
  if (ctx.state.status !== 'active') return;
  const node = requireNode(ctx.graph, token.elementId);

  if (node.type === 'endEvent' || node.outgoing.length === 0) {
    ctx.state.tokens = ctx.state.tokens.filter((t) => t.id !== token.id);
    ctx.state.sequence += 1;
    return;
  }

  if (PASS_THROUGH_TYPES.has(node.type) || node.boundaryHost !== undefined) {
    // task genérica, startEvent, ou token pousado num boundary já disparado.
    if (node.outgoing.length > 1) {
      structuralIncident(ctx, 'unsupportedElement', `${node.type} ${node.id} com fan-out implícito não é suportado na v1`);
      return;
    }
    leaveAlong(ctx, token, node.outgoing);
    return;
  }

  switch (node.type) {
    case 'userTask': {
      const waitKey = waitKeyOf(node.id, token.id);
      ctx.state.waits.push({ kind: 'userTask', elementId: node.id, tokenId: token.id, waitKey });
      ctx.effects.push({
        type: 'OpenUserTask',
        waitKey,
        elementId: node.id,
        formRef: readString(node, 'formRef') ?? '',
        candidates: readStringArray(node, 'candidateRoles'),
      });
      armBoundaryTimers(ctx, node, token);
      return;
    }
    case 'serviceTask': {
      const jobType = readString(node, 'jobType');
      if (jobType === undefined) {
        structuralIncident(ctx, 'invalidDefinition', `serviceTask ${node.id} sem properties.jobType (deploy lint deveria ter rejeitado)`);
        return;
      }
      const waitKey = waitKeyOf(node.id, token.id);
      ctx.state.waits.push({ kind: 'job', elementId: node.id, tokenId: token.id, waitKey });
      ctx.effects.push({
        type: 'CreateJob',
        waitKey,
        elementId: node.id,
        jobType,
        payload: readObject(node, 'jobPayload'),
      });
      armBoundaryTimers(ctx, node, token);
      return;
    }
    case 'exclusiveGateway': {
      routeExclusive(ctx, node, token);
      return;
    }
    case 'parallelGateway': {
      // Chegada por settle = fork puro (joins são tratados em deliver).
      leaveAlong(ctx, token, node.outgoing);
      return;
    }
    case 'intermediateCatchEvent': {
      if (node.eventKind === 'timer') {
        armTimerWait(ctx, node, token, /* boundary */ false);
        return;
      }
      structuralIncident(ctx, 'unsupportedElement', `intermediateCatchEvent "${node.eventKind ?? 'sem definição'}" fora do subset v1 (D19)`);
      return;
    }
    default: {
      structuralIncident(ctx, 'unsupportedElement', `elemento ${node.type} (${node.id}) fora do subset v1 (D19)`);
      return;
    }
  }
}

function routeExclusive(ctx: Ctx, node: EngineNode, token: Token): void {
  if (node.outgoing.length <= 1) {
    leaveAlong(ctx, token, node.outgoing); // XOR-merge ou passagem
    return;
  }
  const evaluator = ctx.options.conditions;
  let defaultEdge: string | undefined;
  for (const edgeId of node.outgoing) {
    const edge = ctx.graph.edges.get(edgeId)!;
    if (edge.isDefault) defaultEdge = edgeId;
    else if (edge.condition === undefined && defaultEdge === undefined) defaultEdge = edgeId; // default implícito (convenção do lint)
  }
  for (const edgeId of node.outgoing) {
    const edge = ctx.graph.edges.get(edgeId)!;
    if (edge.condition === undefined || edgeId === defaultEdge) continue;
    if (!evaluator) {
      structuralIncident(ctx, 'invalidDefinition', `gateway ${node.id} tem condições mas o host não injetou avaliador`);
      return;
    }
    const outcome = evaluator.evaluate(edge.condition, ctx.event.variables);
    if ('error' in outcome) {
      structuralIncident(ctx, 'conditionError', `condição da aresta ${edgeId}: ${outcome.error}`);
      return;
    }
    if (outcome.value) {
      emitHistory(ctx, 'flowRouted', { gatewayId: node.id, edgeId });
      leaveAlong(ctx, token, [edgeId]);
      return;
    }
  }
  if (defaultEdge !== undefined) {
    emitHistory(ctx, 'flowRouted', { gatewayId: node.id, edgeId: defaultEdge, default: true });
    leaveAlong(ctx, token, [defaultEdge]);
    return;
  }
  structuralIncident(ctx, 'noRouteTaken', `gateway ${node.id}: nenhuma condição verdadeira e sem fluxo default`);
}

// ----------------------------------------------------------- timers

function armBoundaryTimers(ctx: Ctx, host: EngineNode, token: Token): void {
  for (const boundaryId of ctx.graph.boundariesByHost.get(host.id) ?? []) {
    const boundary = requireNode(ctx.graph, boundaryId);
    if (boundary.eventKind !== 'timer') {
      structuralIncident(ctx, 'unsupportedElement', `boundary "${boundary.eventKind ?? 'sem definição'}" em ${host.id} fora do subset v1 (D19)`);
      return;
    }
    armTimerWait(ctx, boundary, token, /* boundary */ true);
    if (ctx.state.status !== 'active') return;
  }
}

function armTimerWait(ctx: Ctx, node: EngineNode, token: Token, boundary: boolean): void {
  const fireAt = computeFireAt(ctx, node);
  if (fireAt === undefined) return; // incidente já registrado
  const waitKey = waitKeyOf(node.id, token.id);
  ctx.state.waits.push({ kind: 'timer', elementId: node.id, tokenId: token.id, waitKey });
  ctx.effects.push({ type: 'ScheduleTimer', waitKey, elementId: node.id, fireAt });
  if (!boundary) ctx.state.sequence += 1;
}

/**
 * fireAt determinístico a partir de `event.now` + timer do modelo. Aritmética
 * de instantes usa APENAS Date.parse/new Date(ms) sobre valores fornecidos —
 * deterministas; leitura de relógio (Date.now, construtor sem argumento) é
 * proibida e vetada pelo teste de pureza. Meses/anos em duração e cycles são
 * calendário-dependentes → fora da v1 (incidente estrutural, D19).
 */
function computeFireAt(ctx: Ctx, node: EngineNode): string | undefined {
  const timer = node.timer;
  if (!timer) {
    structuralIncident(ctx, 'invalidDefinition', `timer ${node.id} sem properties.timer`);
    return undefined;
  }
  const parsed = parseTimerExpression(timer.kind, timer.expression);
  if (!parsed.valid) {
    structuralIncident(ctx, 'invalidDefinition', `timer ${node.id}: ${parsed.error}`);
    return undefined;
  }
  if (parsed.kind === 'date') return parsed.date;
  if (parsed.kind === 'cycle') {
    structuralIncident(ctx, 'unsupportedElement', `timer cíclico em ${node.id} fora da v1 (D19)`);
    return undefined;
  }
  const { years, months, weeks, days, hours, minutes, seconds } = parsed.parts;
  if (years > 0 || months > 0) {
    structuralIncident(ctx, 'unsupportedElement', `duração com anos/meses em ${node.id} é calendário-dependente — fora da v1`);
    return undefined;
  }
  const ms =
    (((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60_000 + Math.round(seconds * 1000);
  const base = Date.parse(ctx.event.now);
  if (Number.isNaN(base)) {
    throw new EngineInvariantError(`event.now "${ctx.event.now}" não é um instante ISO-8601`);
  }
  return new Date(base + ms).toISOString();
}

// ------------------------------------------------------------ término

function structuralIncident(ctx: Ctx, kind: string, message: string): void {
  ctx.effects.push({ type: 'RaiseIncident', kind, message });
  ctx.state.status = 'incident';
}

function emitHistory(ctx: Ctx, kind: string, payload: unknown): void {
  ctx.effects.push({ type: 'EmitHistory', kind, payload });
}

/**
 * Após aplicar o evento, verifica término. Tokens/waits vazios com joinArrivals
 * pendente = deadlock estrutural (o soundness/lint deveria ter pego) —
 * incidente declarado, nunca silêncio.
 */
function runToQuiescence(ctx: Ctx): void {
  const { state } = ctx;
  if (state.status !== 'active') return;
  if (state.tokens.length === 0 && state.waits.length === 0) {
    if (Object.keys(state.joinArrivals).length > 0) {
      structuralIncident(
        ctx,
        'deadlock',
        `instância sem tokens/esperas mas com joins incompletos: ${Object.keys(state.joinArrivals).join(', ')}`,
      );
      return;
    }
    state.status = 'completed';
    ctx.effects.push({ type: 'CompleteInstance' });
    emitHistory(ctx, 'instanceCompleted', {});
  }
}

// ------------------------------------------------ leitura de propriedades

function readString(node: EngineNode, key: string): string | undefined {
  const value = node.props[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function readStringArray(node: EngineNode, key: string): string[] {
  const value = node.props[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function readObject(node: EngineNode, key: string): Readonly<Record<string, unknown>> {
  const value = node.props[key];
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
