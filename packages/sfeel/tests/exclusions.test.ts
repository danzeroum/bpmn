import { describe, expect, it } from 'vitest';
import { evaluate, parseOutputLiteral, parseUnaryTests, type SfeelTable } from '../src/index.js';

/**
 * Cerca §1.6 — every item of the EXPLICIT exclusion list (§5) must come back
 * as a declared failure with the offending cell and a reason naming the
 * exclusion. Never a silently wrong evaluation, never "quase FEEL".
 */
const reasonOf = (cell: string): string => {
  const parsed = parseUnaryTests(cell);
  if (parsed.ok) throw new Error(`expected '${cell}' to be excluded`);
  return parsed.reason;
};

describe('exclusion list (§5 / cerca §1.6) — input cells', () => {
  it('function invocation: date(…), duration(…), custom fn', () => {
    expect(reasonOf('date("2024-01-01")')).toMatch(/function invocation 'date\(…\)'/);
    expect(reasonOf('date("2024-01-01")')).toMatch(/date\/time\/duration/);
    expect(reasonOf('duration("P1D") > x')).toMatch(/function invocation 'duration\(…\)'/);
    expect(reasonOf('myFn(1, 2)')).toMatch(/function invocation 'myFn\(…\)'/);
  });

  it('arithmetic in cells: + - * /', () => {
    expect(reasonOf('1 + 2')).toMatch(/arithmetic/);
    expect(reasonOf('5 - 2')).toMatch(/arithmetic/);
    expect(reasonOf('2 * 3')).toMatch(/arithmetic/);
    expect(reasonOf('10 / 2')).toMatch(/arithmetic/);
  });

  it('quantified expressions: for / some / every', () => {
    expect(reasonOf('for x in list return x')).toMatch(/quantified expression \('for'\)/);
    expect(reasonOf('some x in list satisfies x > 1')).toMatch(/quantified expression \('some'\)/);
    expect(reasonOf('every x in list satisfies x')).toMatch(/quantified expression \('every'\)/);
  });

  it('nested contexts: { … }', () => {
    expect(reasonOf('{a: 1}')).toMatch(/nested context/);
  });

  it('date/time/duration literals: @"…"', () => {
    expect(reasonOf('@"2024-01-01"')).toMatch(/date\/time\/duration literal/);
  });

  it('identifier references (compare against literals only)', () => {
    expect(reasonOf('otherVar')).toMatch(/identifier reference 'otherVar'/);
    expect(reasonOf('< limit')).toMatch(/must be a number literal|identifier/);
  });

  it("FEEL '?' placeholder tests", () => {
    expect(reasonOf('? < 5')).toMatch(/'\?' placeholder/);
  });

  it('parenthesized expressions', () => {
    expect(reasonOf('(1)')).toMatch(/parenthesized expression/);
  });
});

describe('exclusion list — output cells (literals only)', () => {
  const outputReason = (cell: string): string => {
    const parsed = parseOutputLiteral(cell);
    if (parsed.ok) throw new Error(`expected output '${cell}' to be excluded`);
    return parsed.reason;
  };

  it('accepts the three literal types', () => {
    expect(parseOutputLiteral('42')).toEqual({ ok: true, value: 42 });
    expect(parseOutputLiteral('"approve"')).toEqual({ ok: true, value: 'approve' });
    expect(parseOutputLiteral('true')).toEqual({ ok: true, value: true });
    expect(parseOutputLiteral(' -1.5 ')).toEqual({ ok: true, value: -1.5 });
  });

  it('rejects non-literal output expressions with a named reason', () => {
    expect(outputReason('amount * 0.1')).toMatch(/arithmetic/);
    expect(outputReason('date("2024-01-01")')).toMatch(/function invocation/);
    expect(outputReason('someVar')).toMatch(/identifier reference/);
    expect(outputReason('1 2')).toMatch(/non-literal output expression/);
    expect(outputReason('')).toBe('empty output entry');
    expect(outputReason('   ')).toBe('empty output entry');
  });
});

describe('exclusion list — hit policies beyond U/F (§5)', () => {
  it.each(['A', 'P', 'R', 'O', 'C', 'X'])('hit policy %s → declared nonSimulable', (policy) => {
    const table: SfeelTable = {
      hitPolicy: policy,
      inputs: [{ expression: 'x' }],
      outputs: [{ expression: 'out' }],
      rules: [{ inputEntries: ['-'], outputEntries: ['1'] }],
    };
    const outcome = evaluate(table, { x: 1 });
    expect('nonSimulable' in outcome).toBe(true);
    if ('nonSimulable' in outcome) {
      expect(outcome.nonSimulable.cell).toBe(policy);
      expect(outcome.nonSimulable.reason).toMatch(/only U and F are simulable/);
    }
  });
});
