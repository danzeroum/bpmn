import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BpmnDiagram } from '@buildtovalue/core';
import { describe, expect, it } from 'vitest';
import {
  canonicalJsonExact,
  createEngine,
  type ConditionEvaluator,
  type EngineEvent,
} from '../src/index.js';
import { DEF_REF, flow, NOW } from './fixtures.js';

/**
 * CORPUS DE REPLAY (D6: replay é contrato). Cada cenário grava, em JSON
 * comitado, a sequência de eventos e o par (estado canônico, efeitos
 * canônicos) após CADA evento. O teste reexecuta e exige identidade BYTE A
 * BYTE — mudança que altere replay gravado é MAJOR, mesmo parecendo bugfix.
 *
 * Regenerar (após decisão consciente de major):
 *   UPDATE_REPLAY_FIXTURES=1 npx vitest run --project engine replay
 */
type EventInput = EngineEvent extends infer E
  ? E extends EngineEvent
    ? Omit<E, 'now'>
    : never
  : never;

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'replay-fixtures');
const UPDATE = process.env.UPDATE_REPLAY_FIXTURES === '1';

// Regenerar fixture de replay é decisão LOCAL e deliberada (major, D6). Um
// pipeline mal configurado com a variável setada FALHA aqui em vez de
// regenerar silenciosamente — o CI nunca reescreve o contrato.
if (UPDATE && process.env.CI) {
  throw new Error(
    'UPDATE_REPLAY_FIXTURES é proibido em CI — regeneração de replay só local e deliberada (D6)',
  );
}

const vars = Object.freeze({});

interface ReplayScenario {
  name: string;
  diagram: () => BpmnDiagram;
  events: EventInput[];
  conditions?: ConditionEvaluator;
}

const evaluator: ConditionEvaluator = {
  evaluate: (expr, v) => ({ value: expr === 'valor > 100' && Number(v.valor) > 100 }),
};

const SCENARIOS: ReplayScenario[] = [
  {
    name: 'linear-usertask',
    diagram: () => flow(['s:startEvent', 'u:userTask', 'e:endEvent'], ['s->u', 'u->e']),
    events: [
      { type: 'StartInstance', instanceId: 'i1', variables: vars },
      { type: 'UserTaskCompleted', waitKey: 'u:i1', variables: vars, submission: vars },
    ],
  },
  {
    name: 'xor-condicao-verdadeira',
    diagram: () =>
      flow(
        ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'e1:endEvent', 'e2:endEvent'],
        ['s->x', 'x->a', 'x->b', 'a->e1', 'b->e2'],
        (d) => {
          d.edges.e1.properties.condition = 'valor > 100';
        },
      ),
    events: [{ type: 'StartInstance', instanceId: 'i1', variables: { valor: 200 } }],
    conditions: evaluator,
  },
  {
    name: 'and-join-parcial-retomado',
    diagram: () =>
      flow(
        ['s:startEvent', 'f:parallelGateway', 'a:userTask', 'b:userTask', 'j:parallelGateway', 'e:endEvent'],
        ['s->f', 'f->a', 'f->b', 'a->j', 'b->j', 'j->e'],
      ),
    events: [
      { type: 'StartInstance', instanceId: 'i1', variables: vars },
      { type: 'UserTaskCompleted', waitKey: 'a:i1/e1', variables: vars, submission: vars },
      { type: 'UserTaskCompleted', waitKey: 'b:i1/e2', variables: vars, submission: vars },
    ],
  },
  {
    name: 'boundary-timeout-interruptivo',
    diagram: () =>
      flow(
        ['s:startEvent', 'u:userTask', 'bt:boundaryEvent', 'esc:task', 'e1:endEvent', 'e2:endEvent'],
        ['s->u', 'u->e1', 'bt->esc', 'esc->e2'],
        (d) => {
          d.nodes.bt.properties.attachedToRef = 'u';
          d.nodes.bt.properties.eventDefinition = 'timer';
          d.nodes.bt.properties.timer = { kind: 'duration', expression: 'PT1H' };
        },
      ),
    events: [
      { type: 'StartInstance', instanceId: 'i1', variables: vars },
      { type: 'TimerFired', waitKey: 'bt:i1', variables: vars },
    ],
  },
  {
    name: 'cancelamento-com-join-parcial',
    diagram: () =>
      flow(
        ['s:startEvent', 'f:parallelGateway', 'a:userTask', 'b:userTask', 'j:parallelGateway', 'e:endEvent'],
        ['s->f', 'f->a', 'f->b', 'a->j', 'b->j', 'j->e'],
      ),
    events: [
      { type: 'StartInstance', instanceId: 'i1', variables: vars },
      { type: 'UserTaskCompleted', waitKey: 'a:i1/e1', variables: vars, submission: vars },
      { type: 'CancelInstance', variables: vars, reason: 'replay-fixture' },
    ],
  },
];

interface ReplayStep {
  event: unknown;
  state: string;
  effects: string;
}

function computeTrace(scenario: ReplayScenario): ReplayStep[] {
  const engine = createEngine(
    scenario.diagram(),
    scenario.conditions ? { conditions: scenario.conditions } : {},
  );
  let state = engine.initialState(DEF_REF);
  const steps: ReplayStep[] = [];
  for (const event of scenario.events) {
    const full = { ...event, now: NOW } as EngineEvent;
    const result = engine.advance(state, full);
    if (!result.ok) throw new Error(`replay ${scenario.name}: ${result.rejection.message}`);
    state = result.state;
    steps.push({
      event: full,
      state: canonicalJsonExact(result.state),
      effects: canonicalJsonExact(result.effects),
    });
  }
  return steps;
}

describe('corpus de replay (D6 — identidade byte a byte)', () => {
  for (const scenario of SCENARIOS) {
    it(scenario.name, () => {
      const live = computeTrace(scenario);
      const file = join(FIXTURES_DIR, `${scenario.name}.json`);
      if (UPDATE || !existsSync(file)) {
        mkdirSync(FIXTURES_DIR, { recursive: true });
        writeFileSync(file, JSON.stringify(live, null, 2) + '\n');
        if (!UPDATE) {
          throw new Error(
            `fixture de replay ${scenario.name} não existia — gerada agora; commite e rode de novo`,
          );
        }
        return;
      }
      const stored = JSON.parse(readFileSync(file, 'utf8')) as ReplayStep[];
      expect(live.length).toBe(stored.length);
      for (let i = 0; i < live.length; i++) {
        expect(live[i].state, `${scenario.name} passo ${i}: estado divergiu do replay gravado`).toBe(
          stored[i].state,
        );
        expect(
          live[i].effects,
          `${scenario.name} passo ${i}: efeitos divergiram do replay gravado`,
        ).toBe(stored[i].effects);
      }
    });
  }
});
