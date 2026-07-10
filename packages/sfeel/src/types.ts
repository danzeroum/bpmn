/**
 * @buildtovalue/sfeel — minimal S-FEEL subset (Handoff 9 §5).
 *
 * The whole package operates on plain string cells plus a `{variable: value}`
 * context — it imports NOTHING from the ecosystem (independence test), so it
 * can serve both the simulator (Handoff 7) and the DMN editor (Handoff 5)
 * without depending on either. The table shape below is structurally
 * compatible with `@buildtovalue/dmn`'s `DecisionTable` (extra fields are
 * ignored), so adapting one is a type-level pass-through.
 */

/** The three value types of the subset (§5). Dates/times/durations are OUT. */
export type SfeelValue = number | string | boolean;

/** Evaluation context: input-column expression → value. A missing variable is
 * a DECLARED failure, never a silent non-match. */
export type SfeelContext = Record<string, SfeelValue | undefined>;

export interface SfeelColumn {
  /** Input: the context key to read. Output: the result key to write. The
   * expression is used verbatim as the key — it is NOT evaluated (an input
   * expression that needs evaluation is outside the subset). */
  expression: string;
  typeRef?: string;
}

export interface SfeelRule {
  /** S-FEEL unary tests, one per input column ('-'/empty = irrelevant). */
  inputEntries: string[];
  /** Literal expressions, one per output column. */
  outputEntries: string[];
}

export interface SfeelTable {
  /** Only 'U' (Unique) and 'F' (First) are simulable (§5); the other DMN hit
   * policies remain editor metadata and evaluate to a declared nonSimulable. */
  hitPolicy: string;
  inputs: SfeelColumn[];
  outputs: SfeelColumn[];
  rules: SfeelRule[];
}

/**
 * The honest-failure payload (cerca §1.6): WHAT cell cannot be simulated and
 * WHY — for the token warning in the simulator and the ⚠ marker in the editor.
 * Covers both static subset exclusions (e.g. `date(...)` in a cell) and
 * dynamic honesty failures (missing variable, type mismatch, Unique
 * violation) — in every case the alternative would be a silently wrong result.
 */
export interface NonSimulable {
  /** The offending cell's raw text (or the hit policy letter / rule label). */
  cell: string;
  /** Human-readable reason, always naming what is outside the subset. */
  reason: string;
  /** 0-based rule index, when the failure is cell-scoped. */
  ruleIndex?: number;
  /** 0-based column index across inputs then outputs, when cell-scoped. */
  columnIndex?: number;
}

/** A successful match: outputs keyed by output-column expression. */
export interface SfeelMatch {
  outputs: Record<string, SfeelValue>;
  /** 0-based index of the rule that fired. */
  ruleIndex: number;
}

/**
 * `evaluate` contract (§5): a result (a match, or `null` when no rule
 * matches) — or a declared `nonSimulable`. There is no third, silent state.
 */
export type EvaluateResult = { result: SfeelMatch | null } | { nonSimulable: NonSimulable };

/** Static per-cell verdict for editor feedback (⚠ before simulating). */
export type CellCheck = { simulable: true } | { simulable: false; reason: string };
