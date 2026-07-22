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
 * automatizada. Os dois modelos diferem por DESIGN no ponto de parada
 * (o simulador anda por atividades; o engine ESPERA em user/service/timer),
 * então a equivalência é projetada sobre o que ambos afirmam:
 *
 *  1. TERMINAL: complete↔completed; deadlocked↔incident(deadlock).
 *  2. ROTAS de gateway: a aresta escolhida no engine (EmitHistory flowRouted)
 *     é a MESMA da decisão equivalente do cenário do simulador.
 *  3. POSIÇÕES de espera: todo elemento onde o engine abriu espera foi
 *     visitado por token no simulador (mesma caminhada).
 *  4. SINCRONIZAÇÃO: joinArrivals residual equivalente (vazio ao completar;
 *     não-vazio nos dois em deadlock).
 *
 * Fixtures fora do subset v1 ficam com skip explícito `todo:F5` (reativação
 * na F5) — a lista está no fim do arquivo.
 */

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
    if (
      next &&
      next.kind === 'boundary' &&
      sim.state.tokens.some((t) => t.nodeId === next.host)
    ) {
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

interface EngineRun {
  state: InstanceState;
  effects: Effect[];
}

function runEngine(
  diagram: BpmnDiagram,
  events: Array<Omit<EngineEvent, 'now'>>,
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

function waitElements(run: EngineRun): string[] {
  return run.effects
    .filter((e): e is Extract<Effect, { elementId: string }> =>
      e.type === 'OpenUserTask' || e.type === 'CreateJob' || e.type === 'ScheduleTimer',
    )
    .map((e) => e.elementId);
}

function routedEdges(run: EngineRun): string[] {
  return run.effects
    .filter((e) => e.type === 'EmitHistory' && e.kind === 'flowRouted')
    .map((e) => ((e as Extract<Effect, { type: 'EmitHistory' }>).payload as { edgeId: string }).edgeId);
}

function expectEquivalentTerminal(sim: SimulationState, run: EngineRun): void {
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
}

function expectWaitsVisited(sim: SimulationState, run: EngineRun): void {
  for (const elementId of waitElements(run)) {
    expect(sim.visitedNodes, `elemento ${elementId} esperado na caminhada do simulador`).toContain(
      elementId,
    );
  }
}

const vars = Object.freeze({});
const startEvent = (variables: Readonly<Record<string, unknown>> = vars) =>
  ({ type: 'StartInstance', instanceId: 'i1', variables }) as const;

describe('equivalência simulation×engine (subset v1)', () => {
  it('linear com task genérica: ambos completam sem paradas', () => {
    const diagram = () => flow(['s:startEvent', 'a:task', 'e:endEvent'], ['s->a', 'a->e']);
    const sim = runSim(diagram(), []);
    const run = runEngine(diagram(), [startEvent()]);
    expectEquivalentTerminal(sim, run);
    expect(waitElements(run)).toEqual([]);
  });

  it('linear com user task: espera do engine ⊆ caminhada do simulador', () => {
    const diagram = () => flow(['s:startEvent', 'u:userTask', 'e:endEvent'], ['s->u', 'u->e']);
    const sim = runSim(diagram(), []);
    const run = runEngine(diagram(), [
      startEvent(),
      { type: 'UserTaskCompleted', waitKey: 'u:i1', variables: vars, submission: vars },
    ]);
    expectEquivalentTerminal(sim, run);
    expectWaitsVisited(sim, run);
    expect(waitElements(run)).toEqual(['u']);
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

  it('XOR rota "aprova": mesma aresta nos dois motores', () => {
    const sim = runSim(xorDiagram(), [{ kind: 'exclusive', gateway: 'x', edge: 'e1' }]);
    const run = runEngine(xorDiagram(), [startEvent({ valor: 200 })], evaluator);
    expectEquivalentTerminal(sim, run);
    expect(routedEdges(run)).toEqual(['e1']);
  });

  it('XOR rota "rejeita" (default): mesma aresta nos dois motores', () => {
    const sim = runSim(xorDiagram(), [{ kind: 'exclusive', gateway: 'x', edge: 'e2' }]);
    const run = runEngine(xorDiagram(), [startEvent({ valor: 10 })], evaluator);
    expectEquivalentTerminal(sim, run);
    expect(routedEdges(run)).toEqual(['e2']);
  });

  it('AND fork/join com user tasks: sincronização equivalente', () => {
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
    expectEquivalentTerminal(sim, run);
    expectWaitsVisited(sim, run);
    expect(waitElements(run).sort()).toEqual(['a', 'b']);
  });

  it('trap XOR→AND-join: deadlock declarado nos dois motores', () => {
    const diagram = () =>
      flow(
        ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'j:parallelGateway', 'e:endEvent'],
        ['s->x', 'x->a', 'x->b', 'a->j', 'b->j', 'j->e'],
        (d) => {
          d.edges.e1.properties.condition = 'valor > 100';
        },
      );
    const sim = runSim(diagram(), [{ kind: 'exclusive', gateway: 'x', edge: 'e1' }]);
    const run = runEngine(diagram(), [startEvent({ valor: 200 })], evaluator);
    expectEquivalentTerminal(sim, run); // deadlocked ↔ incident(deadlock)
  });

  it('boundary timer interruptivo sobre user task: mesmo desvio', () => {
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
    expectEquivalentTerminal(sim, run);
    expect(sim.visitedNodes).toContain('bt');
    expect(run.effects).toContainEqual({ type: 'CloseUserTask', waitKey: 'u:i1' });
  });
});

describe('fora do subset v1 — skip explícito, reativar na F5 (D19)', () => {
  it.todo('todo:F5 — OR (inclusiveGateway) split/join por dominadores');
  it.todo('todo:F5 — eventBasedGateway (corrida de catch events)');
  it.todo('todo:F5 — signal broadcast / message single-delivery por definição nomeada');
  it.todo('todo:F5 — error/escalation matching em 4 tiers');
  it.todo('todo:F5 — event subprocess (interrupting e não)');
  it.todo('todo:F5 — compensação (reverse order + esub de compensação)');
  it.todo('todo:F5 — businessRuleTask via DecisionEvaluator (DMN completo)');
});
