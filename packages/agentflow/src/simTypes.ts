/**
 * Simulation result shape (Handoff 12 §1.2 / §7).
 *
 * The mock engine (`simulate.ts`) has its OWN semantics — messages,
 * data-mapping, retries — and never adapts or imports the H7 BPMN token engine
 * (cerca §2). What it shares with `@buildtovalue/simulation` is only the result
 * SHAPE, so the react layer renders an agent run with the very same trail
 * components: `SimulationState`, `TransitionRecord` and `BlockedDecision` here
 * are **structurally identical** to the ones in
 * `packages/simulation/src/types.ts`.
 *
 * The parity is by structure, not by dependency — `agentflow` stays zero
 * ecosystem imports (independence test). A type-level test
 * (`tests/structuralShape.test.ts`) inlines the H7 shapes (no import) and
 * asserts mutual assignability, so a drift breaks the build.
 *
 * Several fields are BPMN-token concepts an agent run never populates
 * (`joinArrivals`, `pendingChoice`, `boundaryOptions`, `pendingDecisionInput`).
 * They are kept — empty/`null` — precisely so the shared shape holds and the
 * same components work unchanged.
 */

/** A token currently resting at a node — the render cursor. */
export interface Token {
  id: string;
  nodeId: string;
}

/** BPMN gateway roles — carried for shape parity; unused by an agent run. */
export type GatewayKind = 'exclusive' | 'parallel' | 'inclusive' | 'eventBased';

/** A blocked interactive choice — shape parity only (agent mock is deterministic). */
export interface PendingChoice {
  nodeId: string;
  kind: Extract<GatewayKind, 'exclusive' | 'inclusive' | 'eventBased'>;
  multiple: boolean;
  options: { edgeId: string; targetId: string; label: string }[];
  approximate: boolean;
}

/** A fireable boundary event — shape parity only. */
export interface BoundaryOption {
  host: string;
  boundary: string;
  interrupting: boolean;
  label: string;
}

/** A businessRuleTask awaiting inputs — shape parity only. */
export interface PendingDecisionInput {
  nodeId: string;
  label: string;
  inputs: string[];
}

/**
 * One entry in the run trail — the mono log the panel renders. Identical to the
 * H7 record so the same component paints it. Agent runs emit the subset
 * `move` / `decision` / `decision-blocked` / `end`; the other members exist for
 * shape parity.
 */
export interface TransitionRecord {
  /** Monotonic step index within the session. */
  step: number;
  type:
    | 'move'
    | 'split'
    | 'join-wait'
    | 'join-fire'
    | 'boundary'
    | 'decision'
    | 'decision-blocked'
    | 'end';
  /** Human-readable description (localized by the host, English here). */
  message: string;
  nodeId?: string;
  edgeId?: string;
  approximate?: boolean;
}

/**
 * A declared honest stop (§1.2 / §3). Retry exhausted, an unmatched decision
 * route, or a condition the mock cannot evaluate all land here — the run never
 * guesses a route (same discipline as S-FEEL's `nonSimulable`). Structurally
 * identical to the H7 `BlockedDecision`: `cell` names WHAT blocked (the route,
 * the error boundary, the condition), `reason` carries the human explanation
 * including any retry count.
 */
export interface BlockedDecision {
  nodeId: string;
  cell: string;
  reason: string;
}

/** A serializable snapshot of the whole run — the shared render contract. */
export interface SimulationState {
  tokens: Token[];
  /** Sync-join arrivals — always empty for an agent run (no joins). */
  joinArrivals: Record<string, string[]>;
  /** Edges traversed so far (synthesized ids `from->to`). */
  traversedEdges: string[];
  /** Nodes a token rested on this run. */
  visitedNodes: string[];
  trail: TransitionRecord[];
  complete: boolean;
  /** True only if the frontier stalls with no legal move; honest stops use
   * `blockedDecision` instead. */
  deadlocked: boolean;
  pendingChoice: PendingChoice | null;
  boundaryOptions: BoundaryOption[];
  pendingDecisionInput: PendingDecisionInput | null;
  blockedDecision: BlockedDecision | null;
}

/**
 * Per-node mock fixtures (cerca §2 determinism): outputs are declared, never
 * random. `outputs[i]` is the node's structured output on its i-th visit (the
 * last entry repeats if a node is visited more often). `fails` is the number of
 * consecutive execution failures before the node succeeds — it drives the
 * `errorBoundary` decorator; without one, the first failure is a hard stop.
 */
export interface NodeFixture {
  outputs?: Record<string, unknown>[];
  fails?: number;
}

/** Fixtures keyed by node id. */
export type Fixtures = Record<string, NodeFixture>;

/** Options for {@link simulate}. */
export interface SimulateOptions {
  /** Per-node mock outputs; a node with none produces an empty output. */
  fixtures?: Fixtures;
  /** Safety cap on micro-steps (default 10_000) — a malformed graph blocks
   * honestly rather than looping forever. */
  maxSteps?: number;
}
