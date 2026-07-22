/**
 * Contrato do ADR-0001 (APROVADO 2026-07-22, Alternativa A + condições a–d):
 * `InstanceState`, eventos e efeitos do engine determinístico.
 *
 * Tudo aqui é JSON puro e serializável; a MESMA (state, event) produz a MESMA
 * (state', effects) byte-idêntica sob {@link canonicalJsonExact} (invariante 2
 * — vale inclusive para `joinArrivals`, condição c).
 */

/** Escopo raiz da v1 (single-process). Subprocessos reais chegam na F5. */
export const ROOT_SCOPE = 'root';

export interface InstanceState {
  /** Versão do FORMATO deste estado; migrações puras encadeadas (D14). */
  stateSchemaVersion: number;
  engineVersion: string;
  definitionRef: { registryRef: string; bpmnVersion: string };
  /** SEMPRE por elementId (D14). */
  tokens: Token[];
  waits: Wait[];
  /**
   * AND-joins parcialmente sincronizados. Chave COMPOSTA
   * `${joinElementId}@${scopeId}` (condição a) → edgeIds já entregues, SEMPRE
   * em ordem lexicográfica (condição c). Cancelamento/boundary interruptivo
   * limpam as entradas do escopo afetado (condição b).
   */
  joinArrivals: Record<string, string[]>;
  /** Monotônico; base do history.seq do host. */
  sequence: number;
  status: 'active' | 'completed' | 'cancelled' | 'incident';
}

export interface Token {
  /**
   * Id determinístico derivado pelo ENGINE: raiz = instanceId (fornecido uma
   * única vez em StartInstance); filho = `${parentTokenId}/${outgoingFlowId}`
   * (spawn de boundary não-interruptivo usa o id do boundary como "flow").
   */
  id: string;
  elementId: string;
  scopeId: string;
  parentTokenId?: string;
}

export interface Wait {
  kind: 'userTask' | 'job' | 'timer';
  elementId: string;
  tokenId: string;
  /** GERADA PELO ENGINE, determinística: `${elementId}:${tokenId}`. O host
   * mapeia waitKey ↔ effect_key nas linhas de job/task/timer (D11). */
  waitKey: string;
}

/** Visão IMUTÁVEL das variáveis, fornecida pelo host. O engine as usa SÓ para
 * avaliar condições — nunca as devolve (D13, invariante 5). */
export type Vars = Readonly<Record<string, unknown>>;

export type EngineEvent =
  | { type: 'StartInstance'; now: string; instanceId: string; variables: Vars; businessKey?: string }
  | { type: 'JobCompleted'; now: string; waitKey: string; variables: Vars; result?: Vars }
  | { type: 'JobFailed'; now: string; waitKey: string; variables: Vars; error: string }
  | { type: 'TimerFired'; now: string; waitKey: string; variables: Vars }
  | { type: 'UserTaskCompleted'; now: string; waitKey: string; variables: Vars; submission: Vars }
  | { type: 'CancelInstance'; now: string; variables: Vars; reason?: string };
// `variables` em TODOS os eventos: qualquer um pode desembocar em gateway com
// condição S-FEEL. `now` SEMPRE do host; o kernel nunca consulta relógio (D2).

export type Effect =
  | { type: 'CreateJob'; waitKey: string; elementId: string; jobType: string; payload: Vars }
  | { type: 'OpenUserTask'; waitKey: string; elementId: string; formRef: string; candidates: string[] }
  | { type: 'CloseUserTask'; waitKey: string }
  | { type: 'CancelJob'; waitKey: string }
  | { type: 'ScheduleTimer'; waitKey: string; elementId: string; fireAt: string }
  | { type: 'CancelTimer'; waitKey: string }
  | { type: 'EmitHistory'; kind: string; payload: unknown }
  | { type: 'RaiseIncident'; kind: string; message: string }
  | { type: 'CompleteInstance' };
// effect_key = hash(instanceId, revision, index, type) atribuída pelo HOST (D11).
// Cancelamento/interrupção: o engine emite Close/Cancel para TODAS as esperas afetadas.

export type Rejection = {
  kind: 'staleWait' | 'invalidTransition' | 'alreadyClosed' | string;
  message: string;
};

export type AdvanceResult =
  | { ok: true; state: InstanceState; effects: Effect[] }
  | { ok: false; rejection: Rejection };
// Rejeição de NEGÓCIO → ok:false tipado; o host responde 409/422 e NÃO altera
// estado. Defeito INTERNO → o engine LANÇA EngineInvariantError; o host aborta
// a transação e dispara alerta crítico. Bug nunca vira incidente silencioso.

/** Defeito interno do engine (invariante violada, estado corrompido): o host
 * NUNCA trata isto como rejeição de negócio. */
export class EngineInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineInvariantError';
  }
}

/**
 * Avaliador de condição injetado pelo HOST (mesmo padrão do DecisionEvaluator
 * do simulation): o kernel não importa `sfeel` — recebe a capacidade. Deve ser
 * PURO e determinístico (D2 vale para o avaliador também).
 */
export interface ConditionEvaluator {
  /** Avalia uma expressão S-FEEL booleana sobre a visão imutável de variáveis.
   * Retorna { error } em expressão inválida — nunca lança. */
  evaluate(expression: string, variables: Vars): { value: boolean } | { error: string };
}
