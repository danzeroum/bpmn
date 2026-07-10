import { describe, expect, it } from 'vitest';
import { createDiagram, createNode } from '@buildtovalue/core';
import {
  createSfeelDecisionSupport,
  nonSimulableCells,
  type DecisionTable,
} from '../src/index.js';

/**
 * Handoff 9 SF-2 — the S-FEEL-backed decision support the host injects into
 * the simulator, and the static ⚠ analysis the editor renders.
 */
const table: DecisionTable = {
  hitPolicy: 'U',
  inputs: [{ id: 'i1', label: 'Valor', expression: 'amount', typeRef: 'number' }],
  outputs: [{ id: 'o1', label: 'Rota', expression: 'route', typeRef: 'string' }],
  rules: [
    { id: 'r1', inputEntries: ['< 100'], outputEntries: ['"auto"'] },
    { id: 'r2', inputEntries: ['>= 100'], outputEntries: ['"manual"'] },
  ],
};

function build(withTable: DecisionTable | undefined) {
  const diagram = createDiagram({ name: 'S' });
  diagram.nodes.brt = createNode({
    type: 'businessRuleTask',
    id: 'brt',
    label: 'Aprovar?',
    x: 0,
    y: 0,
    properties: withTable ? { decisionTable: withTable } : {},
  });
  return diagram;
}

describe('createSfeelDecisionSupport (SF-2)', () => {
  it('detects the table, lists inputs and evaluates via sfeel', () => {
    const support = createSfeelDecisionSupport(build(table));
    expect(support.hasDecision('brt')).toBe(true);
    expect(support.hasDecision('other')).toBe(false);
    expect(support.inputsOf('brt')).toEqual(['amount']);
    expect(support.evaluate('brt', { amount: 50 })).toEqual({
      outputs: { route: 'auto' },
      ruleIndex: 0,
    });
    expect(support.evaluate('brt', { amount: 500 })).toEqual({
      outputs: { route: 'manual' },
      ruleIndex: 1,
    });
  });

  it('maps sfeel outcomes: no match → noMatch; excluded cell → nonSimulable', () => {
    const support = createSfeelDecisionSupport(build(table));
    // 'amount' present but matching no rule is impossible here (rules cover ℝ);
    // use a type mismatch instead — declared nonSimulable.
    const mismatch = support.evaluate('brt', { amount: 'muito' });
    expect(mismatch.nonSimulable?.reason).toMatch(/needs a number/);

    const bad: DecisionTable = {
      ...table,
      rules: [{ id: 'r1', inputEntries: ['date("2024") > x'], outputEntries: ['"a"'] }],
    };
    const badSupport = createSfeelDecisionSupport(build(bad));
    const outcome = badSupport.evaluate('brt', { amount: 1 });
    expect(outcome.nonSimulable?.cell).toBe('date("2024") > x');
    expect(outcome.nonSimulable?.reason).toMatch(/function invocation/);
  });

  it('nodes without a table have no decision (degradation)', () => {
    const support = createSfeelDecisionSupport(build(undefined));
    expect(support.hasDecision('brt')).toBe(false);
  });
});

describe('nonSimulableCells (editor ⚠, §5)', () => {
  it('flags out-of-subset cells with rule/column coordinates', () => {
    const bad: DecisionTable = {
      ...table,
      rules: [
        { id: 'r1', inputEntries: ['< 100'], outputEntries: ['"auto"'] },
        { id: 'r2', inputEntries: ['date("x")'], outputEntries: ['amount * 2'] },
      ],
    };
    const issues = nonSimulableCells(bad);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ ruleIndex: 1, columnIndex: 0 });
    expect(issues[1]).toMatchObject({ ruleIndex: 1, columnIndex: 1 });
  });

  it('a clean subset table has zero issues', () => {
    expect(nonSimulableCells(table)).toEqual([]);
  });
});
