/**
 * Public value types for the headless replay engine.
 *
 * The engine reasons over an **abstract graph injected by the caller** — it
 * imports nothing from the ecosystem (not even `@buildtovalue/core`), so the same
 * fitness/heatmap machinery works on any `{ nodes, edges }` (a BPMN model, a
 * future DMN DRD, a fake graph in a test). Everything here is plain JSON.
 */

/** A node in the injected graph. `name` (when present) is matched against the
 * log activity name; otherwise `id` is used. */
export interface ReplayNode {
  id: string;
  name?: string;
}

/** A directed edge in the injected graph. */
export interface ReplayEdge {
  id: string;
  source: string;
  target: string;
}

/** The abstract graph the log is replayed against. */
export interface ReplayGraph {
  nodes: ReplayNode[];
  edges: ReplayEdge[];
}

/** One event of a trace. `timestamp` is epoch milliseconds (optional). */
export interface LogEvent {
  activity: string;
  timestamp?: number;
}

/** One case: an ordered sequence of events. */
export interface Trace {
  caseId: string;
  events: LogEvent[];
}

/** Per-node aggregate: frequency and average sojourn time (⌀ chip). */
export interface NodeStat {
  nodeId: string;
  count: number;
  /** Average time (ms) until the next event in the same case; undefined when
   * timestamps are absent or the node never has a successor. */
  avgMs?: number;
}

/** Per-edge aggregate: frequency (heatmap thickness) and average transition time. */
export interface EdgeStat {
  edgeId: string;
  source: string;
  target: string;
  count: number;
  avgMs?: number;
}

/**
 * A transition seen in the log that has no corresponding edge in the model —
 * the dashed red "▲ DESVIO" path. `from`/`to` are node ids; an unmapped
 * activity is encoded as `?<activity>`.
 */
export interface Deviation {
  from: string;
  to: string;
  /** Total occurrences across the log. */
  count: number;
  /** Distinct cases exhibiting this deviation (the "N casos" label). */
  cases: number;
}

/** A trace variant (a distinct activity sequence) with its share. */
export interface Variant {
  /** Stable signature (normalized activities joined). */
  signature: string;
  activities: string[];
  count: number;
  /** Share of all cases, 0–1. */
  share: number;
  /** One case id exhibiting this variant (for "▶ Reproduzir"). */
  sampleCaseId: string;
}

/**
 * Token-replay fitness (cerca §0.2 — NOT alignments). `fitness` is the fraction
 * of transition moves that had a corresponding model edge; `conformingCases`
 * counts traces that replayed with zero deviations (the "N de M casos" note).
 */
export interface Fitness {
  fitness: number;
  fitMoves: number;
  totalMoves: number;
  conformingCases: number;
  totalCases: number;
}

/** The full one-pass aggregation result. */
export interface AggregatedLog {
  totalEvents: number;
  totalCases: number;
  nodes: NodeStat[];
  edges: EdgeStat[];
  deviations: Deviation[];
  variants: Variant[];
  fitness: Fitness;
  /** Distinct log activity names with no matching node. */
  unmapped: string[];
  /** Node with the highest average sojourn time (the "GARGALO"). */
  bottleneckNodeId?: string;
}

export interface AggregateOptions {
  /** Max variants returned (default 3, matching the prototype's top-3). */
  topVariants?: number;
}
