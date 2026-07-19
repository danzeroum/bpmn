/**
 * Public value types for the headless token-simulation engine.
 *
 * Everything here is plain JSON data so a session, a scenario and the engine
 * state are serializable and deterministic — the same property the rest of the
 * repo relies on for hashing, diffing and (Handoff 7A-3) registering a session
 * in the ledger.
 */

/**
 * The control-flow role a node plays in the token semantics. Derived once from
 * the BPMN node type and its fan-in/fan-out when the graph is built.
 */
export type GatewayKind =
  | 'exclusive' // XOR — one outgoing, chosen
  | 'parallel' // AND — all outgoing / sync all incoming
  | 'inclusive' // OR — approximate (see limitations.md)
  | 'eventBased'; // event race — one outgoing catch event, chosen

/** A sequence flow in the simulation graph. */
export interface SimEdge {
  id: string;
  source: string;
  target: string;
  /** Label shown on the gateway choice card; falls back to the target label. */
  label: string;
}

/** A flow node in the simulation graph. */
export interface SimNode {
  id: string;
  type: string;
  label: string;
  /** Present when the node is a gateway (controls split/join semantics). */
  gateway?: GatewayKind;
  /** Outgoing sequence-flow edge ids, in diagram order. */
  outgoing: string[];
  /** Incoming sequence-flow edge ids. */
  incoming: string[];
  /** Host activity id when this node is a boundary event. */
  boundaryHost?: string;
  /** Interrupting boundary (cancels the host) vs non-interrupting (spawns). */
  interrupting?: boolean;
  /** Event kind (`properties.eventDefinition`) — E-6 matching input. */
  eventKind?: string;
  /** Named-definition reference (`properties.eventDefinitionRef`) — the
   * matching KEY (3a ids; E-3 `gov-*` mirrors match identically). */
  eventRef?: string;
  /** Resolved definition name for UI labels (falls back to the ref). */
  eventRefLabel?: string;
  /** True when this node is an event-subprocess SHELL (ES-5): it never seeds
   * an implicit start token — it only fires by its start event. */
  eventSubprocess?: boolean;
  /** The shell's single typed start (ES-5) — present ONLY when the container
   * is eligible: exactly one typed start among its DIRECT children. A
   * degenerate container (0, >1 or untyped starts) is never a candidate —
   * correcting it is the lint's job (4d), not the simulator's. */
  esubStart?: EsubStartInfo;
  isStart: boolean;
  isEnd: boolean;
}

/**
 * The typed start of an eligible event-subprocess shell (ES-5). Derived with
 * the core single-source helpers (`isEventSubprocess`/`startIsInterrupting`,
 * reforço 9 da ES-1) — never a local predicate.
 */
export interface EsubStartInfo {
  startId: string;
  /** Event kind of the start (`message`, `signal`, `error`, `timer`, …). */
  kind: string;
  /** Named-definition ref the start matches on; absent on an ERROR start =
   * the DECLARED catch-all (same tiering as E-6 boundaries). */
  ref?: string;
  /** Resolved definition name for UI labels (falls back to the ref). */
  refLabel?: string;
  /** From `startIsInterrupting` (OMG default true). */
  interrupting: boolean;
}

/**
 * A choice the engine is blocked on. The host must resolve it with
 * {@link Decision} before the simulation can advance further.
 */
export interface PendingChoice {
  /** The gateway node requiring a decision. */
  nodeId: string;
  /** `exclusive`/`eventBased` pick exactly one; `inclusive` picks ≥1. */
  kind: Extract<GatewayKind, 'exclusive' | 'inclusive' | 'eventBased'>;
  /** Whether more than one option may be selected (OR-split only). */
  multiple: boolean;
  options: { edgeId: string; targetId: string; label: string }[];
  /** True for the OR-split — the panel must show the approximation notice. */
  approximate: boolean;
}

/** A boundary event that can be fired while a token rests on its host. */
export interface BoundaryOption {
  host: string;
  boundary: string;
  interrupting: boolean;
  label: string;
  /** Event kind of the boundary (`timer`, `message`, `error`…), when any. */
  eventKind?: string;
  /** Named-definition reference the boundary matches on (E-6). */
  eventRef?: string;
  /** Error boundary WITHOUT errorRef — the DECLARED catch-all (E-6). */
  catchAll?: boolean;
}

/**
 * "Throw error" choices for one host with a resting token (E-6, §3e): the
 * user picks the ERROR (by named definition), the ENGINE resolves the
 * boundary by matching — the inverse of the manual boundary card. The
 * `errorRef: undefined` entry is the UNCATALOGUED error (reforço 10), the UI
 * path that exercises the catch-all.
 */
export interface ErrorThrowOption {
  host: string;
  hostLabel: string;
  options: Array<{ errorRef?: string; label?: string }>;
}

/**
 * The predicted destination of ONE escalation option, computed WITHOUT firing
 * (Handoff 18 §5e reforço 7) so the «Escalar» card shows the user, per option,
 * WHERE the escalation would land and in which MODE — glyph+text, informed
 * decision before the throw.
 */
export type EscalationDestination =
  | { kind: 'boundary' | 'esubStart'; label: string; interrupting: boolean }
  /** No eligible catch — the escalation dissolves (legal in the OMG). */
  | { kind: 'dissolve' }
  /** >1 candidate in the winning tier — firing will BLOCK (declared). */
  | { kind: 'ambiguous'; candidates: string[] };

/** "Throw escalation" card (§5e): one per host with a resting token; the
 * options are the DISTINCT catchable refs + the uncatalogued escalation, each
 * carrying its predicted {@link EscalationDestination}. */
export interface EscalationThrowOption {
  host: string;
  hostLabel: string;
  options: Array<{ escalationRef?: string; label?: string; destination: EscalationDestination }>;
}

/**
 * A timer/conditional event subprocess the user may fire MANUALLY (ES-5, §4e):
 * those kinds NEVER auto-fire in simulation — the card is the declared manual
 * decision (molde {@link BoundaryOption}). The mode is shown so the user
 * decides informed (reforço 10): interrupting cancels the scope's tokens.
 */
export interface EventSubprocessOption {
  sub: string;
  subLabel: string;
  startId: string;
  /** `timer` or `conditional` — the kinds without a throw counterpart. */
  kind: string;
  interrupting: boolean;
}

/** A decision applied to the engine; the ordered list of these IS a scenario. */
export type Decision =
  | { kind: 'exclusive' | 'eventBased'; gateway: string; edge: string }
  | { kind: 'inclusive'; gateway: string; edges: string[] }
  | { kind: 'boundary'; host: string; boundary: string }
  | { kind: 'decision'; node: string; context: Record<string, number | string | boolean> }
  // E-6 (§3e): thrown events — the engine resolves the destination by
  // matching; serialized in scenarios and replayed through the SAME matching.
  | { kind: 'error'; host: string; errorRef?: string }
  // Handoff 18 §5e: escalation throw — resolved through the SAME total order as
  // error, but with no destination = DISSOLVE (a declared no-op, not a stop).
  | { kind: 'escalation'; host: string; escalationRef?: string }
  | { kind: 'signal'; ref: string }
  | { kind: 'message'; ref: string }
  // ES-5 (§4e): manual firing of a timer/conditional event subprocess. WHEN
  // the user fired is part of the scenario (an interrupting fire cancels
  // whatever is live at that moment), so the decision is anchored to the
  // trail position — replay advances up to `atStep` before applying it.
  | { kind: 'eventSubprocess'; sub: string; atStep: number };

/**
 * Outcome of evaluating a node's decision table (Handoff 9 SF-2). Produced by
 * the injected {@link DecisionEvaluator} — the engine itself knows nothing
 * about S-FEEL or DMN.
 */
export interface DecisionOutcome {
  /** Output values, keyed by output name — recorded in the trail. */
  outputs?: Record<string, number | string | boolean>;
  /** 0-based index of the rule that fired. */
  ruleIndex?: number;
  /** True when no rule matched (a declared non-result, not a guess). */
  noMatch?: boolean;
  /** Declared honest failure (cerca §1.6) — the token stops with this. */
  nonSimulable?: { cell: string; reason: string };
}

/**
 * HOST-injected decision support (Handoff 9 SF-2, same injection pattern as
 * Signer/AnchorAdapter): lets a `businessRuleTask` route through a real
 * decision table without the engine importing `dmn` or `sfeel`. The
 * `@buildtovalue/dmn` package ships an S-FEEL-backed implementation.
 */
export interface DecisionEvaluator {
  /** True when `nodeId` carries a decision table this evaluator can run. */
  hasDecision(nodeId: string): boolean;
  /** Input variable names — the prompt card asks the user for these. */
  inputsOf(nodeId: string): string[];
  evaluate(
    nodeId: string,
    context: Record<string, number | string | boolean>,
  ): DecisionOutcome;
}

/** A businessRuleTask waiting for its decision inputs (like PendingChoice). */
export interface PendingDecisionInput {
  nodeId: string;
  label: string;
  /** Input variable names to collect from the user. */
  inputs: string[];
}

/**
 * A token stopped on a declared non-simulable decision (§5): the honest
 * warning names the cell and the reason; the session does not proceed past it.
 */
export interface BlockedDecision {
  nodeId: string;
  cell: string;
  reason: string;
}

/** One entry in the session trail — the mono log the panel renders. */
export interface TransitionRecord {
  /** Monotonic step index within the session. */
  step: number;
  /** Machine-readable transition kind. */
  type:
    | 'move' // token traversed one edge
    | 'split' // a split produced N tokens
    | 'join-wait' // a token arrived at a sync join, still waiting
    | 'join-fire' // a sync join completed
    | 'boundary' // a boundary event fired
    | 'event' // a thrown error/signal/message resolved by MATCHING (E-6, §3e)
    | 'decision' // a businessRuleTask decision table fired (SF-2)
    | 'decision-blocked' // declared non-simulable decision — token stopped (§5)
    | 'end'; // a token reached an end/sink and was consumed
  /** Human-readable description (localized by the host, English here). */
  message: string;
  nodeId?: string;
  edgeId?: string;
  /** Set on `join-fire`/`join-wait` from an approximate OR-join. */
  approximate?: boolean;
}

/** A token currently resting at a node, awaiting the next micro-step. */
export interface Token {
  id: string;
  nodeId: string;
}

/** A serializable snapshot of everything the overlay renders. */
export interface SimulationState {
  tokens: Token[];
  /** Sync-join arrivals: join node id → set of incoming edge ids delivered. */
  joinArrivals: Record<string, string[]>;
  /** Edges traversed so far this session (green stroke; also feeds coverage). */
  traversedEdges: string[];
  /** Nodes a token has rested on this session. */
  visitedNodes: string[];
  trail: TransitionRecord[];
  complete: boolean;
  /** True when the frontier is stuck with tokens but no legal move (deadlock). */
  deadlocked: boolean;
  pendingChoice: PendingChoice | null;
  boundaryOptions: BoundaryOption[];
  /** "Throw error" cards per host with a resting token (E-6, §3e). */
  errorThrowOptions: ErrorThrowOption[];
  /** "Throw escalation" cards per host with a resting token (Handoff 18 §5e). */
  escalationThrowOptions: EscalationThrowOption[];
  /** Manual timer/conditional event-subprocess cards (ES-5, §4e). */
  eventSubprocessOptions: EventSubprocessOption[];
  /** A businessRuleTask waiting for decision inputs (SF-2), if any. */
  pendingDecisionInput: PendingDecisionInput | null;
  /** Token stopped on a declared non-simulable decision (§5), if any. */
  blockedDecision: BlockedDecision | null;
}

/** Options for constructing an engine. */
export interface SimulationOptions {
  /**
   * Scope to simulate: `undefined` (default) is the top process level. A
   * sub-process id restricts the graph to that scope. Sub-process token
   * descent is not modeled in v1 (see limitations.md).
   */
  scope?: string;
  /** HOST-injected decision-table support for businessRuleTask (SF-2). */
  decisions?: DecisionEvaluator;
}
