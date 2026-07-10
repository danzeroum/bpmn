import { describe, expect, it } from 'vitest';
import { checkTable, evaluate, type SfeelTable } from '../src/index.js';

/**
 * Evaluation semantics (§5 + acceptance §8.4): hit policies U and F, the
 * declared Unique violation, no-match → null, and the dynamic honesty
 * failures (missing variable, type mismatch) — all with cell + reason.
 *
 * The fixture is deliberately a FAKE, non-BPMN table (a coffee-loyalty
 * program): the acid test that sfeel operates on plain cells + context and
 * knows nothing about DMN/BPMN (same pattern as replay's coffee graph).
 */
function loyaltyTable(hitPolicy: string): SfeelTable {
  return {
    hitPolicy,
    inputs: [{ expression: 'cups' }, { expression: 'plan' }],
    outputs: [{ expression: 'discount' }, { expression: 'freeRefill' }],
    rules: [
      { inputEntries: ['< 10', '"basic"'], outputEntries: ['0', 'false'] },
      { inputEntries: ['[10..50]', '"basic"'], outputEntries: ['5', 'false'] },
      { inputEntries: ['> 50', '-'], outputEntries: ['15', 'true'] },
      { inputEntries: ['-', '"gold"'], outputEntries: ['10', 'true'] },
    ],
  };
}

describe('hit policy U (Unique)', () => {
  it('single match → its outputs, keyed by output expression', () => {
    const outcome = evaluate(loyaltyTable('U'), { cups: 5, plan: 'basic' });
    expect(outcome).toEqual({
      result: { outputs: { discount: 0, freeRefill: false }, ruleIndex: 0 },
    });
  });

  it('no match → result null (not an error, not a guess)', () => {
    const outcome = evaluate(loyaltyTable('U'), { cups: 20, plan: 'silver' });
    expect(outcome).toEqual({ result: null });
  });

  it('two matching rules → DECLARED Unique violation naming both rules', () => {
    // cups 60 + plan gold matches rule 3 (>50) and rule 4 (gold).
    const outcome = evaluate(loyaltyTable('U'), { cups: 60, plan: 'gold' });
    expect('nonSimulable' in outcome).toBe(true);
    if ('nonSimulable' in outcome) {
      expect(outcome.nonSimulable.cell).toBe('U');
      expect(outcome.nonSimulable.reason).toBe(
        'Unique hit policy violated: rules 3 and 4 both match',
      );
    }
  });
});

describe('hit policy F (First)', () => {
  it('returns the FIRST matching rule even when a later one also matches', () => {
    const outcome = evaluate(loyaltyTable('F'), { cups: 60, plan: 'gold' });
    expect(outcome).toEqual({
      result: { outputs: { discount: 15, freeRefill: true }, ruleIndex: 2 },
    });
  });

  it('no match → result null', () => {
    expect(evaluate(loyaltyTable('F'), { cups: 20, plan: 'silver' })).toEqual({ result: null });
  });
});

describe('test semantics', () => {
  const oneInput = (cell: string): SfeelTable => ({
    hitPolicy: 'U',
    inputs: [{ expression: 'x' }],
    outputs: [{ expression: 'out' }],
    rules: [{ inputEntries: [cell], outputEntries: ['"hit"'] }],
  });
  const hits = (cell: string, x: number | string | boolean): boolean => {
    const outcome = evaluate(oneInput(cell), { x });
    if ('nonSimulable' in outcome) throw new Error(outcome.nonSimulable.reason);
    return outcome.result !== null;
  };

  it('range inclusivity honours each bracket form', () => {
    expect(hits('[1..10]', 1)).toBe(true);
    expect(hits('[1..10]', 10)).toBe(true);
    expect(hits(']1..10[', 1)).toBe(false);
    expect(hits(']1..10[', 10)).toBe(false);
    expect(hits(']1..10[', 5)).toBe(true);
    expect(hits('[1..10[', 10)).toBe(false);
    expect(hits(']1..10]', 10)).toBe(true);
  });

  it('comparisons and equality', () => {
    expect(hits('< 5', 4.99)).toBe(true);
    expect(hits('< 5', 5)).toBe(false);
    expect(hits('>= 5', 5)).toBe(true);
    expect(hits('= "gold"', 'gold')).toBe(true);
    expect(hits('= "gold"', 'silver')).toBe(false);
    expect(hits('true', true)).toBe(true);
    expect(hits('false', true)).toBe(false);
  });

  it('value lists OR; not(…) excludes its values', () => {
    expect(hits('"a", "b"', 'b')).toBe(true);
    expect(hits('"a", "b"', 'c')).toBe(false);
    expect(hits('< 3, > 10', 11)).toBe(true);
    expect(hits('< 3, > 10', 5)).toBe(false);
    expect(hits('not("a", "b")', 'c')).toBe(true);
    expect(hits('not("a", "b")', 'a')).toBe(false);
  });
});

describe('dynamic honesty failures (declared, never silent)', () => {
  it('missing input variable → nonSimulable naming the variable', () => {
    const outcome = evaluate(loyaltyTable('U'), { cups: 5 });
    expect('nonSimulable' in outcome).toBe(true);
    if ('nonSimulable' in outcome) {
      expect(outcome.nonSimulable.reason).toMatch(/'plan' missing from the simulation context/);
      expect(outcome.nonSimulable.ruleIndex).toBe(0);
      expect(outcome.nonSimulable.columnIndex).toBe(1);
    }
  });

  it('type mismatch on ordered comparison → nonSimulable with the cell', () => {
    const outcome = evaluate(loyaltyTable('U'), { cups: 'lots', plan: 'basic' });
    expect('nonSimulable' in outcome).toBe(true);
    if ('nonSimulable' in outcome) {
      expect(outcome.nonSimulable.cell).toBe('< 10');
      expect(outcome.nonSimulable.reason).toMatch(/needs a number but the input value is a string/);
    }
  });

  it('type mismatch on equality → nonSimulable', () => {
    const outcome = evaluate(loyaltyTable('U'), { cups: 5, plan: 7 });
    expect('nonSimulable' in outcome).toBe(true);
    if ('nonSimulable' in outcome) {
      expect(outcome.nonSimulable.reason).toMatch(
        /test compares a string but the input value is a number/,
      );
    }
  });

  it('type mismatch inside not(…) → nonSimulable', () => {
    const table: SfeelTable = {
      hitPolicy: 'U',
      inputs: [{ expression: 'x' }],
      outputs: [{ expression: 'out' }],
      rules: [{ inputEntries: ['not("a")'], outputEntries: ['1'] }],
    };
    const outcome = evaluate(table, { x: 5 });
    expect('nonSimulable' in outcome).toBe(true);
    if ('nonSimulable' in outcome) {
      expect(outcome.nonSimulable.reason).toMatch(/not\(…\) lists a string/);
    }
  });
});

describe('static issues surface before any matching (deterministic verdict)', () => {
  it('a nonSimulable cell in a LATER rule blocks the table even if rule 1 matches', () => {
    const table = loyaltyTable('F');
    table.rules[3] = { inputEntries: ['-', 'date("x")'], outputEntries: ['0', 'false'] };
    const outcome = evaluate(table, { cups: 5, plan: 'basic' });
    expect('nonSimulable' in outcome).toBe(true);
    if ('nonSimulable' in outcome) {
      expect(outcome.nonSimulable.cell).toBe('date("x")');
      expect(outcome.nonSimulable.ruleIndex).toBe(3);
      expect(outcome.nonSimulable.columnIndex).toBe(1);
    }
  });

  it('ragged rules (entry count ≠ column count) are declared, not guessed', () => {
    const table = loyaltyTable('U');
    table.rules[1] = { inputEntries: ['< 10'], outputEntries: ['5', 'false'] };
    const outcome = evaluate(table, { cups: 5, plan: 'basic' });
    expect('nonSimulable' in outcome).toBe(true);
    if ('nonSimulable' in outcome) {
      expect(outcome.nonSimulable.reason).toMatch(/rule 2 has 1 input entries but the table declares 2/);
    }
  });

  it('ragged OUTPUT entries are declared too', () => {
    const table = loyaltyTable('U');
    table.rules[0] = { inputEntries: ['< 10', '"basic"'], outputEntries: ['0'] };
    const outcome = evaluate(table, { cups: 5, plan: 'basic' });
    expect('nonSimulable' in outcome).toBe(true);
    if ('nonSimulable' in outcome) {
      expect(outcome.nonSimulable.reason).toMatch(
        /rule 1 has 1 output entries but the table declares 2/,
      );
    }
  });

  it('range test against a non-number input → declared type mismatch', () => {
    const table: SfeelTable = {
      hitPolicy: 'U',
      inputs: [{ expression: 'x' }],
      outputs: [{ expression: 'out' }],
      rules: [{ inputEntries: ['[1..10]'], outputEntries: ['1'] }],
    };
    const outcome = evaluate(table, { x: 'five' });
    expect('nonSimulable' in outcome).toBe(true);
    if ('nonSimulable' in outcome) {
      expect(outcome.nonSimulable.reason).toMatch(
        /range test needs a number but the input value is a string/,
      );
    }
  });
});

describe('checkTable (editor ⚠ markers in one pass)', () => {
  it('collects every offending cell with rule/column coordinates', () => {
    const table: SfeelTable = {
      hitPolicy: 'C',
      inputs: [{ expression: 'x' }],
      outputs: [{ expression: 'out' }],
      rules: [
        { inputEntries: ['date("a")'], outputEntries: ['1'] },
        { inputEntries: ['< 5'], outputEntries: ['x + 1'] },
      ],
    };
    const issues = checkTable(table);
    expect(issues).toHaveLength(3);
    expect(issues[0].cell).toBe('C');
    expect(issues[1]).toMatchObject({ cell: 'date("a")', ruleIndex: 0, columnIndex: 0 });
    expect(issues[2]).toMatchObject({ cell: 'x + 1', ruleIndex: 1, columnIndex: 1 });
  });

  it('a clean U/F table has zero issues', () => {
    expect(checkTable(loyaltyTable('U'))).toEqual([]);
    expect(checkTable(loyaltyTable('F'))).toEqual([]);
  });
});
