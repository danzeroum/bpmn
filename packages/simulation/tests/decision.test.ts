import { describe, expect, it } from 'vitest';
import { createDiagram, createEdge, createNode } from '@buildtovalue/core';
import { SimulationEngine } from '../src/index.js';
import type { DecisionEvaluator } from '../src/index.js';

/**
 * Handoff 9 SF-2 — businessRuleTask routes through an INJECTED decision
 * evaluator. The fake evaluator below proves the engine needs no dmn/sfeel
 * import (same injection acid as Signer/AnchorAdapter): outputs route the
 * token by outgoing-flow label; declared failures stop it honestly.
 */
function build() {
  const diagram = createDiagram({ name: 'Decide' });
  diagram.nodes = {
    start: createNode({ type: 'startEvent', id: 'start', label: 'Início', x: 0, y: 0 }),
    brt: createNode({ type: 'businessRuleTask', id: 'brt', label: 'Aprovar?', x: 100, y: 0 }),
    auto: createNode({ type: 'task', id: 'auto', label: 'Auto', x: 300, y: -50 }),
    manual: createNode({ type: 'task', id: 'manual', label: 'Manual', x: 300, y: 50 }),
    end1: createNode({ type: 'endEvent', id: 'end1', label: 'Fim', x: 500, y: -50 }),
    end2: createNode({ type: 'endEvent', id: 'end2', label: 'Fim', x: 500, y: 50 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'brt' }),
    eAuto: createEdge({ id: 'eAuto', sourceId: 'brt', targetId: 'auto', label: 'auto' }),
    eManual: createEdge({ id: 'eManual', sourceId: 'brt', targetId: 'manual', label: 'manual' }),
    e2: createEdge({ id: 'e2', sourceId: 'auto', targetId: 'end1' }),
    e3: createEdge({ id: 'e3', sourceId: 'manual', targetId: 'end2' }),
  };
  return diagram;
}

/** Fake: amount < 100 → route "auto"; otherwise "manual"; amount === -1 →
 * declared nonSimulable (stands in for a date() cell). */
const fake: DecisionEvaluator = {
  hasDecision: (nodeId) => nodeId === 'brt',
  inputsOf: () => ['amount'],
  evaluate: (_nodeId, context) => {
    const amount = context.amount;
    if (amount === -1) {
      return { nonSimulable: { cell: 'date(x) > 1', reason: 'function invocation outside the S-FEEL subset' } };
    }
    if (typeof amount !== 'number') return { noMatch: true };
    return { outputs: { route: amount < 100 ? 'auto' : 'manual' }, ruleIndex: amount < 100 ? 0 : 1 };
  },
};

describe('businessRuleTask via injected DecisionEvaluator (SF-2)', () => {
  it('pauses at the businessRuleTask asking for inputs, then routes by output', () => {
    const engine = new SimulationEngine(build(), { decisions: fake });
    engine.advance(); // start → brt
    expect(engine.canAdvance).toBe(false);
    expect(engine.state.pendingDecisionInput).toEqual({
      nodeId: 'brt',
      label: 'Aprovar?',
      inputs: ['amount'],
    });

    const result = engine.choose({ kind: 'decision', node: 'brt', context: { amount: 50 } });
    expect(result.moved).toBe(true);
    expect(result.transitions[0].type).toBe('decision');
    expect(result.transitions[0].message).toMatch(/fired rule 1: route="auto"/);
    expect(engine.state.tokens[0].nodeId).toBe('auto');
  });

  it('routes to the other flow when the output differs', () => {
    const engine = new SimulationEngine(build(), { decisions: fake });
    engine.advance();
    engine.choose({ kind: 'decision', node: 'brt', context: { amount: 500 } });
    expect(engine.state.tokens[0].nodeId).toBe('manual');
  });

  it('nonSimulable → declared stop with cell + reason; token stays; no advance', () => {
    const engine = new SimulationEngine(build(), { decisions: fake });
    engine.advance();
    const result = engine.choose({ kind: 'decision', node: 'brt', context: { amount: -1 } });
    expect(result.moved).toBe(false);
    expect(engine.state.blockedDecision).toEqual({
      nodeId: 'brt',
      cell: 'date(x) > 1',
      reason: 'function invocation outside the S-FEEL subset',
    });
    expect(engine.state.pendingDecisionInput).toBeNull(); // the warning owns the panel
    expect(engine.state.tokens[0].nodeId).toBe('brt'); // token did not move
    expect(engine.canAdvance).toBe(false);
    expect(engine.state.trail.at(-1)?.type).toBe('decision-blocked');
  });

  it('no matching rule → declared stop (never a guessed route)', () => {
    const engine = new SimulationEngine(build(), { decisions: fake });
    engine.advance();
    const result = engine.choose({ kind: 'decision', node: 'brt', context: { amount: 'x' } });
    expect(result.moved).toBe(false);
    expect(engine.state.blockedDecision?.reason).toMatch(/no rule matched/);
  });

  it('output matching no flow label → declared stop naming the output', () => {
    const weird: DecisionEvaluator = {
      ...fake,
      evaluate: () => ({ outputs: { route: 'nowhere' }, ruleIndex: 0 }),
    };
    const engine = new SimulationEngine(build(), { decisions: weird });
    engine.advance();
    const result = engine.choose({ kind: 'decision', node: 'brt', context: {} });
    expect(result.moved).toBe(false);
    expect(engine.state.blockedDecision?.reason).toMatch(/'nowhere' matches no outgoing flow label/);
  });

  it('replay reproduces a scenario containing a decision bit-for-bit', () => {
    const engine = new SimulationEngine(build(), { decisions: fake });
    engine.advance();
    engine.choose({ kind: 'decision', node: 'brt', context: { amount: 50 } });
    while (engine.canAdvance) engine.advance();
    expect(engine.complete).toBe(true);

    const replayed = SimulationEngine.replay(build(), engine.scenario, { decisions: fake });
    expect(replayed.complete).toBe(true);
    expect(replayed.state.traversedEdges.sort()).toEqual(engine.state.traversedEdges.sort());
  });

  it('without an evaluator the businessRuleTask is an ordinary activity (degradation)', () => {
    const engine = new SimulationEngine(build());
    engine.advance(); // start → brt
    expect(engine.state.pendingDecisionInput).toBeNull();
    // brt has 2 unlabeled-choice outgoing flows and no gateway → step takes the first.
    engine.advance();
    expect(engine.state.tokens[0].nodeId).toBe('auto');
  });
});
