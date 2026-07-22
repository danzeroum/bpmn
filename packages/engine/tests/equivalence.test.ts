import {
  andParallel,
  eventBased,
  linear,
  nonInterruptingBoundary,
  orRegion,
  threePaths,
  trap,
  xorSplit,
} from '../../simulation/tests/fixtures.js';
import { SimulationEngine, type Decision, type SimulationState } from '@buildtovalue/simulation';
import type { BpmnDiagram } from '@buildtovalue/core';
import { describe, expect, it } from 'vitest';
import {
  createEngine,
  type ConditionEvaluator,
  type Effect,
  type EngineEvent,
  type InstanceState,
} from '../src/index.js';
import { DEF_REF, flow, NOW } from './fixtures.js';

/**
 * EQUIVALÊNCIA simulation×engine (F0b.4, D10) — subconjunto v1, 100%
 * automatizada, consumindo o CORPUS EXISTENTE do simulador
 * (`packages/simulation/tests/fixtures.ts`, 8 fixtures) além de cenários
 * autorados para as esperas que o corpus não exercita.
 *
 * Os dois modelos diferem por DESIGN no ponto de parada: o simulador é
 * small-step (o token REPOUSA em cada nó e `advance()` o move — estados
 * transientes), o engine roda até a quiescência e só para em ESPERA
 * (user/service/timer). A equivalência compara o que ambos afirmam:
 *
 *  1. TERMINAL: complete↔completed; deadlocked↔incident(deadlock).
 *  2. ROTAS de gateway: aresta escolhida idêntica nos dois motores.
 *  3. PONTOS DE PAUSA — IGUALDADE DE CONJUNTO (não subconjunto): o conjunto
 *     de elementos onde o engine abriu espera de pausa == o conjunto de
 *     elementos de TIPO-espera visitados pelo simulador. Omissão de espera
 *     num ramo paralelo agora falha, mesmo com terminal idêntico.
 *  4. BOUNDARIES ARMADOS: timers de boundary agendados pelo engine == timers
 *     de boundary anexados a hosts de pausa visitados pelo simulador.
 *  5. SINCRONIZAÇÃO: joinArrivals residual equivalente.
 *
 * A perna "mesma sequência de efeitos" do D10 é coberta pelo CORPUS DE
 * REPLAY (replay.test.ts): efeitos canônicos byte-a-byte após CADA evento.
 *
 * DIVERGÊNCIA DECLARADA (relatório f0b-equivalencia.md): boundary sobre task
 * GENÉRICA (fixtures threePaths/nonInterruptingBoundary do corpus) não arma
 * no engine — task genérica é travessia, não espera; o deploy lint v1
 * restringirá boundary a atividades de espera. O caminho feliz dessas
 * fixtures é verificado; o caminho do boundary é coberto pelos cenários
 * autorados com host userTask/serviceTask.
 */

type EventInput = EngineEvent extends infer E
  ? E extends EngineEvent
    ? Omit<E, 'now'>
    : never
  : never;

// ---------------------------------------------------------------- drivers

interface EngineRun {
  state: InstanceState;
  effects: Effect[];
}

function runEngine(
  diagram: BpmnDiagram,
  events: EventInput[],
  conditions?: ConditionEvaluator,
): EngineRun {
  const engine = createEngine(diagram, conditions ? { conditions } : {});
  let state = engine.initialState(DEF_REF);
  const effects: Effect[] = [];
  for (const event of events) {
    const result = engine.advance(state, { ...event, now: NOW } as EngineEvent);
    if (!result.ok) throw new Error(`evento ${event.type} rejeitado: ${result.rejection.message}`);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}

/**
 * Piloto automático do engine para o corpus: inicia e resolve TODA espera de
 * pausa em ordem determinística (userTask/job primeiro, depois timers
 * intermediários) até terminar. Timers de BOUNDARY não são disparados
 * (caminho feliz — eles morrem com o host via CancelTimer).
 */
function autoRunEngine(diagram: BpmnDiagram): EngineRun {
  const engine = createEngine(diagram);
  let state = engine.initialState(DEF_REF);
  const effects: Effect[] = [];
  const apply = (event: EngineEvent): void => {
    const result = engine.advance(state, event);
    if (!result.ok) throw new Error(`auto-run rejeitado: ${result.rejection.message}`);
    state = result.state;
    effects.push(...result.effects);
  };
  apply({ type: 'StartInstance', now: NOW, instanceId: 'i1', variables: {} });
  let guard = 0;
  while (state.status === 'active' && guard++ < 1000) {
    const waits = [...state.waits].sort((a, b) => a.waitKey.localeCompare(b.waitKey));
    const task = waits.find((w) => w.kind === 'userTask' || w.kind === 'job');
    if (task) {
      apply(
        task.kind === 'userTask'
          ? { type: 'UserTaskCompleted', now: NOW, waitKey: task.waitKey, variables: {}, submission: {} }
          : { type: 'JobCompleted', now: NOW, waitKey: task.waitKey, variables: {} },
      );
      continue;
    }
    const timer = waits.find(
      (w) => w.kind === 'timer' && !isBoundary(diagram, w.elementId),
    );
    if (timer) {
      apply({ type: 'TimerFired', now: NOW, waitKey: timer.waitKey, variables: {} });
      continue;
    }
    break; // só restam boundaries armados — nada a resolver no caminho feliz
  }
  return { state, effects };
}

/** Roda o simulador seguindo `decisions` nos pontos de escolha. */
function runSim(diagram: BpmnDiagram, decisions: Decision[]): SimulationState {
  const sim = new SimulationEngine(diagram);
  const queue = [...decisions];
  let guard = 0;
  while (guard++ < 10_000) {
    if (sim.pendingChoice) {
      const next = queue.shift();
      if (!next) break;
      sim.choose(next);
      continue;
    }
    const next = queue[0];
    if (next && next.kind === 'boundary' && sim.state.tokens.some((t) => t.nodeId === next.host)) {
      sim.fireBoundary(next.boundary);
      queue.shift();
      continue;
    }
    if (sim.canAdvance) {
      sim.advance();
      continue;
    }
    break;
  }
  return sim.state;
}

// ------------------------------------------------------------- projeções

function isBoundary(diagram: BpmnDiagram, nodeId: string): boolean {
  return typeof diagram.nodes[nodeId]?.properties.attachedToRef === 'string';
}

/** Elemento de TIPO-espera do subset v1 (a régua da igualdade de pausa). */
function isPauseType(diagram: BpmnDiagram, nodeId: string): boolean {
  const node = diagram.nodes[nodeId];
  if (!node || isBoundary(diagram, nodeId)) return false;
  if (node.type === 'userTask' || node.type === 'serviceTask') return true;
  return node.type === 'intermediateCatchEvent' && node.properties.eventDefinition === 'timer';
}

/** Esperas de PAUSA abertas pelo engine (exclui boundaries armados). */
function enginePauseSet(diagram: BpmnDiagram, run: EngineRun): Set<string> {
  const ids = run.effects
    .filter(
      (e): e is Extract<Effect, { elementId: string }> =>
        e.type === 'OpenUserTask' || e.type === 'CreateJob' || e.type === 'ScheduleTimer',
    )
    .map((e) => e.elementId)
    .filter((id) => !isBoundary(diagram, id));
  return new Set(ids);
}

/** Boundaries de timer ARMADOS pelo engine (ScheduleTimer em boundary). */
function engineArmedBoundaries(diagram: BpmnDiagram, run: EngineRun): Set<string> {
  return new Set(
    run.effects
      .filter((e): e is Extract<Effect, { type: 'ScheduleTimer' }> => e.type === 'ScheduleTimer')
      .map((e) => e.elementId)
      .filter((id) => isBoundary(diagram, id)),
  );
}

/** Boundaries de timer anexados aos hosts DE PAUSA visitados pelo simulador. */
function simExpectedArmed(diagram: BpmnDiagram, sim: SimulationState): Set<string> {
  const visited = new Set(sim.visitedNodes);
  const armed = new Set<string>();
  for (const node of Object.values(diagram.nodes)) {
    const host = node.properties.attachedToRef;
    if (
      typeof host === 'string' &&
      visited.has(host) &&
      isPauseType(diagram, host) &&
      node.properties.eventDefinition === 'timer'
    ) {
      armed.add(node.id);
    }
  }
  return armed;
}

function routedEdges(run: EngineRun): string[] {
  return run.effects
    .filter((e) => e.type === 'EmitHistory' && e.kind === 'flowRouted')
    .map((e) => ((e as Extract<Effect, { type: 'EmitHistory' }>).payload as { edgeId: string }).edgeId);
}

function expectEquivalent(diagram: BpmnDiagram, sim: SimulationState, run: EngineRun): void {
  // 1. terminal
  if (sim.complete) {
    expect(run.state.status).toBe('completed');
    expect(run.state.joinArrivals).toEqual({});
  } else if (sim.deadlocked) {
    expect(run.state.status).toBe('incident');
    expect(run.effects.some((e) => e.type === 'RaiseIncident' && e.kind === 'deadlock')).toBe(true);
    expect(Object.keys(run.state.joinArrivals).length).toBeGreaterThan(0);
    expect(Object.keys(sim.joinArrivals).length).toBeGreaterThan(0);
  } else {
    throw new Error('cenário do simulador não terminou — fixture mal construída');
  }
  // 3. IGUALDADE de conjuntos nos pontos de pausa (nunca subconjunto)
  const simPause = new Set(sim.visitedNodes.filter((id) => isPauseType(diagram, id)));
  expect(enginePauseSet(diagram, run)).toEqual(simPause);
  // 4. boundaries armados
  expect(engineArmedBoundaries(diagram, run)).toEqual(simExpectedArmed(diagram, sim));
}

const vars = Object.freeze({});
const startEvent = (variables: Readonly<Record<string, unknown>> = vars) =>
  ({ type: 'StartInstance', instanceId: 'i1', variables }) as const;

// ============================== CORPUS DO SIMULATION ==============================

/**
 * Fixtures herdadas de packages/simulation/tests/fixtures.ts (todas as 8
 * contabilizadas). Piloto: o ENGINE roda primeiro (rotas determinísticas:
 * default implícito nos XOR sem condição); o simulador segue as MESMAS
 * arestas como decisões — depois as projeções são comparadas.
 */
const CORPUS_V1: Array<{ name: string; diagram: () => BpmnDiagram; note?: string }> = [
  { name: 'linear', diagram: linear },
  { name: 'xorSplit', diagram: xorSplit },
  { name: 'andParallel', diagram: andParallel },
  { name: 'trap (deadlock XOR→AND)', diagram: trap },
  {
    name: 'threePaths (caminho feliz)',
    diagram: threePaths,
    note: 'boundary sobre task genérica não arma no engine — divergência declarada',
  },
  {
    name: 'nonInterruptingBoundary (caminho feliz)',
    diagram: nonInterruptingBoundary,
    note: 'boundary sobre task genérica não arma no engine — divergência declarada',
  },
];

describe('equivalência — corpus herdado do simulation (D10)', () => {
  for (const fixture of CORPUS_V1) {
    it(fixture.name, () => {
      const run = autoRunEngine(fixture.diagram());
      // o simulador segue as rotas que o engine tomou
      const decisions: Decision[] = [];
      const simProbe = new SimulationEngine(fixture.diagram());
      const routed = [...routedEdges(run)];
      let guard = 0;
      while (guard++ < 10_000) {
        if (simProbe.pendingChoice) {
          const choice = simProbe.pendingChoice;
          const edge = routed.shift();
          if (edge === undefined) break;
          const kind = choice.kind === 'inclusive' ? 'exclusive' : choice.kind;
          decisions.push({ kind: kind as 'exclusive', gateway: choice.nodeId, edge });
          simProbe.choose({ kind: kind as 'exclusive', gateway: choice.nodeId, edge });
          continue;
        }
        if (simProbe.canAdvance) {
          simProbe.advance();
          continue;
        }
        break;
      }
      const sim = runSim(fixture.diagram(), decisions);
      expectEquivalent(fixture.diagram(), sim, run);
    });
  }

  // Fora do subset v1 — skip explícito com nome da fixture herdada (D19).
  it.todo('todo:F5 — corpus `orRegion` (OR split/join por dominadores)');
  it.todo('todo:F5 — corpus `eventBased` (corrida de catch events)');
  void orRegion;
  void eventBased;
});

// ============================== CENÁRIOS DE ESPERA (autorados) ==============================

describe('equivalência — esperas que o corpus não exercita', () => {
  it('user task: pausa idêntica nos dois motores', () => {
    const diagram = () => flow(['s:startEvent', 'u:userTask', 'e:endEvent'], ['s->u', 'u->e']);
    const sim = runSim(diagram(), []);
    const run = runEngine(diagram(), [
      startEvent(),
      { type: 'UserTaskCompleted', waitKey: 'u:i1', variables: vars, submission: vars },
    ]);
    expectEquivalent(diagram(), sim, run);
  });

  it('service task/job: pausa idêntica nos dois motores', () => {
    const diagram = () =>
      flow(['s:startEvent', 'j:serviceTask', 'e:endEvent'], ['s->j', 'j->e'], (d) => {
        d.nodes.j.properties.jobType = 'http-call';
      });
    const sim = runSim(diagram(), []);
    const run = runEngine(diagram(), [
      startEvent(),
      { type: 'JobCompleted', waitKey: 'j:i1', variables: vars },
    ]);
    expectEquivalent(diagram(), sim, run);
  });

  it('timer intermediário (não-boundary): pausa idêntica nos dois motores', () => {
    const diagram = () =>
      flow(['s:startEvent', 't:intermediateCatchEvent', 'e:endEvent'], ['s->t', 't->e'], (d) => {
        d.nodes.t.properties.eventDefinition = 'timer';
        d.nodes.t.properties.timer = { kind: 'duration', expression: 'PT15M' };
      });
    const sim = runSim(diagram(), []);
    const run = runEngine(diagram(), [
      startEvent(),
      { type: 'TimerFired', waitKey: 't:i1', variables: vars },
    ]);
    expectEquivalent(diagram(), sim, run);
  });

  const xorDiagram = () =>
    flow(
      ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'e1:endEvent', 'e2:endEvent'],
      ['s->x', 'x->a:aprova', 'x->b:rejeita', 'a->e1', 'b->e2'],
      (d) => {
        d.edges.e1.properties.condition = 'valor > 100';
      },
    );
  const evaluator: ConditionEvaluator = {
    evaluate: (expr, v) => ({ value: expr === 'valor > 100' && Number(v.valor) > 100 }),
  };

  it('XOR condicionado, rota "aprova": mesma aresta', () => {
    const sim = runSim(xorDiagram(), [{ kind: 'exclusive', gateway: 'x', edge: 'e1' }]);
    const run = runEngine(xorDiagram(), [startEvent({ valor: 200 })], evaluator);
    expectEquivalent(xorDiagram(), sim, run);
    expect(routedEdges(run)).toEqual(['e1']);
  });

  it('XOR condicionado, rota default: mesma aresta', () => {
    const sim = runSim(xorDiagram(), [{ kind: 'exclusive', gateway: 'x', edge: 'e2' }]);
    const run = runEngine(xorDiagram(), [startEvent({ valor: 10 })], evaluator);
    expectEquivalent(xorDiagram(), sim, run);
    expect(routedEdges(run)).toEqual(['e2']);
  });

  it('AND fork/join com user tasks: pausa {a,b} idêntica + sincronização', () => {
    const diagram = () =>
      flow(
        ['s:startEvent', 'f:parallelGateway', 'a:userTask', 'b:userTask', 'j:parallelGateway', 'e:endEvent'],
        ['s->f', 'f->a', 'f->b', 'a->j', 'b->j', 'j->e'],
      );
    const sim = runSim(diagram(), []);
    const run = runEngine(diagram(), [
      startEvent(),
      { type: 'UserTaskCompleted', waitKey: 'a:i1/e1', variables: vars, submission: vars },
      { type: 'UserTaskCompleted', waitKey: 'b:i1/e2', variables: vars, submission: vars },
    ]);
    expectEquivalent(diagram(), sim, run);
  });

  it('boundary timer interruptivo sobre USER task: mesmo desvio + armamento', () => {
    const diagram = () =>
      flow(
        ['s:startEvent', 'u:userTask', 'bt:boundaryEvent', 'esc:task', 'e1:endEvent', 'e2:endEvent'],
        ['s->u', 'u->e1', 'bt->esc', 'esc->e2'],
        (d) => {
          d.nodes.bt.properties.attachedToRef = 'u';
          d.nodes.bt.properties.eventDefinition = 'timer';
          d.nodes.bt.properties.timer = { kind: 'duration', expression: 'PT1H' };
        },
      );
    const sim = runSim(diagram(), [{ kind: 'boundary', host: 'u', boundary: 'bt' }]);
    const run = runEngine(diagram(), [
      startEvent(),
      { type: 'TimerFired', waitKey: 'bt:i1', variables: vars },
    ]);
    expectEquivalent(diagram(), sim, run);
    expect(sim.visitedNodes).toContain('bt');
    expect(run.effects).toContainEqual({ type: 'CloseUserTask', waitKey: 'u:i1' });
  });

  // Fora do subset v1 — semânticas do simulador sem contraparte no engine v1.
  it.todo('todo:F5 — signal broadcast / message single-delivery por definição nomeada');
  it.todo('todo:F5 — error/escalation matching em 4 tiers');
  it.todo('todo:F5 — event subprocess (interrupting e não)');
  it.todo('todo:F5 — compensação (reverse order + esub de compensação)');
  it.todo('todo:F5 — businessRuleTask via DecisionEvaluator (DMN completo)');
});
