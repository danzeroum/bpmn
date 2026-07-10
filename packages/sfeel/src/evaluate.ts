import { isIrrelevant, parseOutputLiteral, parseUnaryTests, type UnaryTest } from './parse.js';
import type {
  EvaluateResult,
  NonSimulable,
  SfeelContext,
  SfeelMatch,
  SfeelTable,
  SfeelValue,
} from './types.js';

/**
 * Decision-table evaluation over the S-FEEL subset (Handoff 9 §5).
 *
 * Honesty contract (cerca §1.6): the ONLY two outcomes are a result (a match
 * or `null` for no matching rule) and a declared `nonSimulable {cell, reason}`.
 * Static exclusions (a cell outside the subset ANYWHERE in the table), dynamic
 * failures (missing input variable, type mismatch between a test and the
 * context value) and hit-policy violations (Unique with two matching rules)
 * all take the declared path — never a silently wrong result.
 *
 * Hit policies: **U** (Unique — 0 or 1 match; 2+ is a declared violation) and
 * **F** (First — first matching rule in order). The other DMN policies
 * (A/P/R/O/C) remain editor metadata; evaluating them is registered as a
 * pendência (§5).
 */

/** The hit policies the simulator can evaluate (§5). */
export const SIMULABLE_HIT_POLICIES = ['U', 'F'] as const;

/**
 * Static analysis of a whole table: every cell outside the subset (and an
 * unsupported hit policy) — the editor's ⚠ markers in one pass. Column index
 * counts inputs first, then outputs (same convention as the DMN editor).
 */
export function checkTable(table: SfeelTable): NonSimulable[] {
  const issues: NonSimulable[] = [];
  if (!SIMULABLE_HIT_POLICIES.includes(table.hitPolicy as 'U' | 'F')) {
    issues.push({
      cell: table.hitPolicy,
      reason: `hit policy '${table.hitPolicy}' evaluation outside the S-FEEL subset (only U and F are simulable)`,
    });
  }
  table.rules.forEach((rule, ruleIndex) => {
    if (rule.inputEntries.length !== table.inputs.length) {
      issues.push({
        cell: `rule ${ruleIndex + 1}`,
        reason: `rule ${ruleIndex + 1} has ${rule.inputEntries.length} input entries but the table declares ${table.inputs.length} inputs`,
        ruleIndex,
      });
    }
    if (rule.outputEntries.length !== table.outputs.length) {
      issues.push({
        cell: `rule ${ruleIndex + 1}`,
        reason: `rule ${ruleIndex + 1} has ${rule.outputEntries.length} output entries but the table declares ${table.outputs.length} outputs`,
        ruleIndex,
      });
    }
    rule.inputEntries.forEach((cell, columnIndex) => {
      const parsed = parseUnaryTests(cell);
      if (!parsed.ok) issues.push({ cell, reason: parsed.reason, ruleIndex, columnIndex });
    });
    rule.outputEntries.forEach((cell, outputIndex) => {
      const parsed = parseOutputLiteral(cell);
      if (!parsed.ok) {
        issues.push({
          cell,
          reason: parsed.reason,
          ruleIndex,
          columnIndex: table.inputs.length + outputIndex,
        });
      }
    });
  });
  return issues;
}

/** Internal declared-failure carrier for the dynamic phase. */
class Honesty extends Error {
  constructor(readonly payload: NonSimulable) {
    super(payload.reason);
  }
}

const typeName = (value: SfeelValue): string => typeof value;

/** Does `value` satisfy one parsed unary test? Type mismatches are DECLARED
 * (throw {@link Honesty}), never a silent false. */
function testMatches(test: UnaryTest, value: SfeelValue, cell: string): boolean {
  switch (test.kind) {
    /* v8 ignore next 2 -- evaluate() short-circuits irrelevant cells before
       matching; the arm exists for exhaustiveness and external callers. */
    case 'any':
      return true;
    case 'cmp': {
      if (test.op === '=') {
        if (typeof test.value !== typeof value) {
          throw new Honesty({
            cell,
            reason: `type mismatch: test compares a ${typeName(test.value)} but the input value is a ${typeName(value)}`,
          });
        }
        return value === test.value;
      }
      if (typeof value !== 'number') {
        throw new Honesty({
          cell,
          reason: `type mismatch: ordered comparison '${test.op}' needs a number but the input value is a ${typeName(value)}`,
        });
      }
      const bound = test.value as number;
      if (test.op === '<') return value < bound;
      if (test.op === '<=') return value <= bound;
      if (test.op === '>') return value > bound;
      return value >= bound;
    }
    case 'range': {
      if (typeof value !== 'number') {
        throw new Honesty({
          cell,
          reason: `type mismatch: range test needs a number but the input value is a ${typeName(value)}`,
        });
      }
      const aboveLo = test.loIncl ? value >= test.lo : value > test.lo;
      const belowHi = test.hiIncl ? value <= test.hi : value < test.hi;
      return aboveLo && belowHi;
    }
    case 'not': {
      for (const candidate of test.values) {
        if (typeof candidate !== typeof value) {
          throw new Honesty({
            cell,
            reason: `type mismatch: not(…) lists a ${typeName(candidate)} but the input value is a ${typeName(value)}`,
          });
        }
      }
      return !test.values.includes(value);
    }
  }
}

/**
 * Evaluates `table` against `context` (§5): `{result}` — a match or `null`
 * when no rule fires — or `{nonSimulable: {cell, reason}}`. Static issues are
 * reported before any matching runs, so the verdict for a given table is
 * deterministic regardless of the data.
 */
export function evaluate(table: SfeelTable, context: SfeelContext): EvaluateResult {
  const staticIssues = checkTable(table);
  if (staticIssues.length > 0) return { nonSimulable: staticIssues[0] };

  try {
    const matches: SfeelMatch[] = [];
    for (let ruleIndex = 0; ruleIndex < table.rules.length; ruleIndex++) {
      const rule = table.rules[ruleIndex];
      let all = true;
      for (let columnIndex = 0; columnIndex < table.inputs.length; columnIndex++) {
        const cell = rule.inputEntries[columnIndex];
        if (isIrrelevant(cell)) continue;
        const variable = table.inputs[columnIndex].expression;
        const value = context[variable];
        if (value === undefined) {
          throw new Honesty({
            cell,
            reason: `input variable '${variable}' missing from the simulation context`,
            ruleIndex,
            columnIndex,
          });
        }
        // checkTable already proved the cell parses.
        const parsed = parseUnaryTests(cell);
        /* v8 ignore next -- unreachable: checkTable vetoed unparsable cells */
        if (!parsed.ok) break;
        let anyMatch = false;
        for (const test of parsed.tests) {
          try {
            if (testMatches(test, value, cell)) {
              anyMatch = true;
              break;
            }
          } catch (error) {
            if (error instanceof Honesty) {
              error.payload.ruleIndex = ruleIndex;
              error.payload.columnIndex = columnIndex;
            }
            throw error;
          }
        }
        if (!anyMatch) {
          all = false;
          break;
        }
      }
      if (!all) continue;

      const outputs: Record<string, SfeelValue> = {};
      table.outputs.forEach((column, outputIndex) => {
        const parsed = parseOutputLiteral(rule.outputEntries[outputIndex]);
        if (parsed.ok) outputs[column.expression] = parsed.value;
      });
      const match: SfeelMatch = { outputs, ruleIndex };

      if (table.hitPolicy === 'F') return { result: match };
      matches.push(match);
      if (matches.length === 2) {
        return {
          nonSimulable: {
            cell: table.hitPolicy,
            reason: `Unique hit policy violated: rules ${matches[0].ruleIndex + 1} and ${matches[1].ruleIndex + 1} both match`,
          },
        };
      }
    }
    return { result: matches.length === 1 ? matches[0] : null };
  } catch (error) {
    if (error instanceof Honesty) return { nonSimulable: error.payload };
    /* v8 ignore next -- defensive: no other throw site exists */
    throw error;
  }
}
