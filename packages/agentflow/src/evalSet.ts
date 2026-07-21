/**
 * Eval sets (Squad Lane SL-7) — an `eval:*@semver` artifact whose cases run the
 * target agent through the deterministic {@link simulate} engine and assert on
 * its final output. Assertions are ONLY `regex` | `contains` | `schema` — never
 * code (cerca §5): no `eval`, no function, so a fixture-driven run stays pure and
 * reproducible (same fixtures 10× → identical report). Pure, zero ecosystem
 * imports (independence test).
 */

import type { AgentWorkflow, SchemaNode, SchemaShape } from './types.js';
import { normalizeSchema } from './schema.js';
import { finalOutput, simulate } from './simulate.js';
import type { Fixtures } from './simTypes.js';

/** The three honest assertion kinds (cerca §5) — never code. */
export type AssertionKind = 'contains' | 'regex' | 'schema';

/** One assertion over the agent's final output. */
export interface Assertion {
  kind: AssertionKind;
  /** Dotted path into the output (`answer`, `sources.0.url`); omitted → whole output. */
  path?: string;
  /** For `contains`: the substring the value must include. */
  value?: string;
  /** For `regex`: the pattern the value (stringified) must match. */
  pattern?: string;
}

/** One eval case: a scenario input, its per-node fixtures, and its assertions. */
export interface EvalCase {
  name: string;
  /** The scenario input this case represents (contextual; the run is fixture-driven). */
  input?: Record<string, unknown>;
  /** Per-node mock outputs that make the run deterministic. */
  fixtures?: Fixtures;
  assertions: Assertion[];
}

/** The EVAL artifact (`eval:rsch-base@1.0.0`). `promotionThreshold` is the
 * assertion pass-rate required to promote the target to active. */
export interface EvalSet {
  kind: 'EvalSet';
  id: string;
  version: string;
  /** The agent this eval targets, e.g. `agnt-rsch@2.1.0`. */
  targetRef: string;
  promotionThreshold: number;
  cases: EvalCase[];
}

/** The verdict for a single assertion. */
export interface AssertionResult {
  kind: AssertionKind;
  path?: string;
  passed: boolean;
}

/** The verdict for a single case. */
export interface EvalCaseResult {
  name: string;
  /** True when the run reached an end (a blocked run cannot satisfy assertions). */
  completed: boolean;
  assertions: AssertionResult[];
  passed: boolean;
}

/** The whole eval report — the promotion scoreboard. */
export interface EvalReport {
  targetRef: string;
  /** Assertions that passed / total assertions across all cases. */
  passed: number;
  total: number;
  passRate: number;
  threshold: number;
  meetsThreshold: boolean;
  cases: EvalCaseResult[];
}

/** Reads a dotted path (`a.b.0.c`) out of the output — the same traversal the
 * simulate engine uses for tool params, so assertions and the run agree. */
function readPath(source: Record<string, unknown>, path: string): unknown {
  let cur: unknown = source;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Honest-subset value type check (SL-4 `SchemaNode`). Unknown type tokens do
 * not fail (we never assert a type we cannot honestly evaluate). */
function typeMatches(type: string, value: unknown): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return type.endsWith('[]') ? Array.isArray(value) : true; // legacy 'string[]' → array
  }
}

/** Validates the output against the workflow outputSchema (honest subset). */
function schemaPasses(output: Record<string, unknown>, outputSchema: SchemaShape): boolean {
  const normalized = normalizeSchema(outputSchema);
  for (const [key, node] of Object.entries(normalized) as [string, SchemaNode][]) {
    const present = key in output;
    if (node.required === true && !present) return false;
    if (present) {
      const value = output[key];
      if (!typeMatches(node.type, value)) return false;
      if (node.enum && !node.enum.includes(value)) return false;
    }
  }
  return true;
}

/** Evaluates one assertion against the recovered output. */
function assertionPasses(
  assertion: Assertion,
  output: Record<string, unknown>,
  outputSchema: SchemaShape,
): boolean {
  if (assertion.kind === 'schema') return schemaPasses(output, outputSchema);
  const actual = assertion.path ? readPath(output, assertion.path) : output;
  if (actual === undefined) return false; // path absent → honest fail
  const text = typeof actual === 'string' ? actual : JSON.stringify(actual);
  if (assertion.kind === 'contains') {
    return typeof assertion.value === 'string' && text.includes(assertion.value);
  }
  // regex
  if (typeof assertion.pattern !== 'string') return false;
  try {
    return new RegExp(assertion.pattern).test(text);
  } catch {
    return false; // a malformed pattern never throws through the runner
  }
}

/**
 * Runs every case of an {@link EvalSet} against `wf` via the deterministic
 * simulate engine and returns the {@link EvalReport}. A blocked run (no `end`)
 * fails every assertion of that case. Assertion pass-rate ≥ `promotionThreshold`
 * → `meetsThreshold`. No fixtures/assertions → `total === 0`, `passRate === 1`
 * (honest: nothing to fail).
 */
export function runEvalSet(evalSet: EvalSet, wf: AgentWorkflow): EvalReport {
  let passed = 0;
  let total = 0;
  const cases: EvalCaseResult[] = [];
  for (const testCase of evalSet.cases) {
    const state = simulate(wf, { fixtures: testCase.fixtures ?? {} });
    const output = finalOutput(state);
    const completed = output !== undefined;
    const results: AssertionResult[] = testCase.assertions.map((assertion) => {
      total += 1;
      const ok = output !== undefined ? assertionPasses(assertion, output, wf.outputSchema) : false;
      if (ok) passed += 1;
      return { kind: assertion.kind, path: assertion.path, passed: ok };
    });
    cases.push({
      name: testCase.name,
      completed,
      assertions: results,
      passed: results.length > 0 && results.every((r) => r.passed),
    });
  }
  const passRate = total === 0 ? 1 : passed / total;
  return {
    targetRef: evalSet.targetRef,
    passed,
    total,
    passRate,
    threshold: evalSet.promotionThreshold,
    meetsThreshold: passRate >= evalSet.promotionThreshold,
    cases,
  };
}
