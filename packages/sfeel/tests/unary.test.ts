import { describe, expect, it } from 'vitest';
import { checkOutputCell, checkUnaryCell, parseUnaryTests, type UnaryTest } from '../src/index.js';

/**
 * Vectors per supported rule of the §5 subset (acceptance §8.4). Each vector
 * asserts BOTH that the cell parses and what it parses to — the parse shape is
 * the semantic contract the evaluator relies on.
 */
function testsOf(cell: string): UnaryTest[] {
  const parsed = parseUnaryTests(cell);
  if (!parsed.ok) throw new Error(`expected '${cell}' to parse, got: ${parsed.reason}`);
  return parsed.tests;
}

describe('comparisons (§5)', () => {
  it.each([
    ['< 5', '<', 5],
    ['<= 5', '<=', 5],
    ['> 5', '>', 5],
    ['>= 5', '>=', 5],
    ['<5', '<', 5],
    ['< -2.5', '<', -2.5],
    ['>= 0.25', '>=', 0.25],
  ] as const)('%s → cmp %s %d', (cell, op, value) => {
    expect(testsOf(cell)).toEqual([{ kind: 'cmp', op, value }]);
  });

  it.each([
    ['= 7', 7],
    ['= "gold"', 'gold'],
    ['= true', true],
    ['= false', false],
  ] as const)('%s → equality', (cell, value) => {
    expect(testsOf(cell)).toEqual([{ kind: 'cmp', op: '=', value }]);
  });

  it('bare literals are equality shorthand', () => {
    expect(testsOf('7')).toEqual([{ kind: 'cmp', op: '=', value: 7 }]);
    expect(testsOf('"gold"')).toEqual([{ kind: 'cmp', op: '=', value: 'gold' }]);
    expect(testsOf('true')).toEqual([{ kind: 'cmp', op: '=', value: true }]);
    expect(testsOf('-3')).toEqual([{ kind: 'cmp', op: '=', value: -3 }]);
  });

  it('ordered comparison against a non-number literal is out of the subset', () => {
    const parsed = parseUnaryTests('< "abc"');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/must be a number literal/);
  });
});

describe('ranges (§5) — inclusive, exclusive and mixed', () => {
  it.each([
    ['[1..10]', 1, 10, true, true],
    [']1..10[', 1, 10, false, false],
    ['[1..10[', 1, 10, true, false],
    [']1..10]', 1, 10, false, true],
    ['[-5..5]', -5, 5, true, true],
    ['[1.5 .. 2.5]', 1.5, 2.5, true, true],
  ] as const)('%s', (cell, lo, hi, loIncl, hiIncl) => {
    expect(testsOf(cell)).toEqual([{ kind: 'range', lo, hi, loIncl, hiIncl }]);
  });

  it('range endpoints must be numbers', () => {
    const parsed = parseUnaryTests('["a".."b"]');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/must be a number literal/);
  });

  it('an unclosed or mis-closed range is malformed, with a reason', () => {
    for (const cell of ['[1..5', '[1..5)', '[1 5]', '[1..]']) {
      const parsed = parseUnaryTests(cell);
      expect(parsed.ok, cell).toBe(false);
      if (!parsed.ok) expect(parsed.reason.length).toBeGreaterThan(0);
    }
    const misclosed = parseUnaryTests('[1..5)');
    if (!misclosed.ok) expect(misclosed.reason).toMatch(/closing the range/);
  });
});

describe('value lists — implicit OR (§5)', () => {
  it('string list', () => {
    expect(testsOf('"a", "b"')).toEqual([
      { kind: 'cmp', op: '=', value: 'a' },
      { kind: 'cmp', op: '=', value: 'b' },
    ]);
  });

  it('number list', () => {
    expect(testsOf('1, 2, 3')).toHaveLength(3);
  });

  it('mixed tests OR together (standard S-FEEL positive unary tests)', () => {
    expect(testsOf('< 3, > 10')).toEqual([
      { kind: 'cmp', op: '<', value: 3 },
      { kind: 'cmp', op: '>', value: 10 },
    ]);
    expect(testsOf('[1..3], 7')).toEqual([
      { kind: 'range', lo: 1, hi: 3, loIncl: true, hiIncl: true },
      { kind: 'cmp', op: '=', value: 7 },
    ]);
  });
});

describe('not(…) — list negation (§5)', () => {
  it('parses a literal list', () => {
    expect(testsOf('not("a", "b")')).toEqual([{ kind: 'not', values: ['a', 'b'] }]);
    expect(testsOf('not(1)')).toEqual([{ kind: 'not', values: [1] }]);
  });

  it('rejects non-literals inside not(…)', () => {
    const parsed = parseUnaryTests('not(< 5)');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/only a list of literal values/);
  });
});

describe("irrelevant '-' (§5)", () => {
  it.each(['-', '', '  ', ' - '])("'%s' matches anything", (cell) => {
    expect(testsOf(cell)).toEqual([{ kind: 'any' }]);
  });
});

describe('checkUnaryCell (editor feedback)', () => {
  it('reports simulable cells', () => {
    expect(checkUnaryCell('[1..2]')).toEqual({ simulable: true });
  });
  it('reports the reason for excluded cells', () => {
    const check = checkUnaryCell('date("2024-01-01")');
    expect(check.simulable).toBe(false);
    if (!check.simulable) expect(check.reason).toMatch(/function invocation/);
  });

  it('checkOutputCell mirrors the same verdicts for output cells', () => {
    expect(checkOutputCell('"approve"')).toEqual({ simulable: true });
    const check = checkOutputCell('a + 1');
    expect(check.simulable).toBe(false);
    if (!check.simulable) expect(check.reason).toMatch(/arithmetic/);
  });
});
