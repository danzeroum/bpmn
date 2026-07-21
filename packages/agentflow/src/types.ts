/**
 * @buildtovalue/agentflow — the headless model of a governed AI-agent
 * sub-workflow (Handoff 12).
 *
 * The whole package operates on this plain abstract graph plus injected
 * integrations — it imports NOTHING from the ecosystem (independence test,
 * same acidity standard as `sfeel`/`replay`). The registry, ledger, library
 * and react layers plug in by injection so the graph model can be validated,
 * simulated (A-2) and edited without depending on any of them.
 *
 * Property names align with the AgentO/AIAO vocabulary (`LLMCall`, `ToolCall`,
 * `usesTool`, …) but we make NO JSON-LD claim: there is deliberately no
 * `@context`/`@type` (cerca §1.6 — we do not assert a semantic URI we cannot
 * resolve). See README for the vocabulary alignment.
 */

/**
 * Exactly three node types — never a fourth (cerca §1.3). Memory, Planner and
 * ErrorBoundary are DECORATORS (properties of a node), not nodes of their own.
 */
export type NodeType = 'llm' | 'tool' | 'decision';

/** The three decorator kinds. A decorator is a property, never a node (§1.3). */
export type DecoratorType = 'memory' | 'planner' | 'errorBoundary';

/**
 * Edge semantics. `toolCall` (solid) invokes a tool; `data` carries a value
 * (incl. the retry back-edge, `when: "retry"`); `delegate` (⤳, a2a:1.0)
 * references ANOTHER agent by versioned ref — semantics only, no protocol in
 * v1 (cerca §0/§3).
 */
export type EdgeType = 'toolCall' | 'data' | 'delegate';

/** LLM node config. `structuredOutput` forces JSON mode (§1.4). */
export interface LlmConfig {
  /** Model id, e.g. "gpt-4o". */
  model: string;
  /** Versioned ref to a btv:prompt artifact of the Library, e.g. "prm:research@2.0.0". */
  promptRef: string;
  /** True → the model must emit structured JSON. Required when a structured
   * decision consumes this node (validation rule 3, §1.4). */
  structuredOutput?: boolean;
}

/** Tool (MCP) node config. */
export interface ToolConfig {
  /**
   * The versioned tool contract invoked (AgentO `usesTool`), a `tool:*@semver`
   * ref such as "tool:browser-search@1.2.0" (Squad Lane SL-1, cerca §2.1/§2.2).
   * Validated by `validateGraph` (`TOOL_REF_INVALID`) and resolved to a
   * {@link ToolContract} through the injected ToolProvider.
   */
  usesTool: string;
  /** Call parameters; values may reference upstream outputs (`{{node.output.x}}`). */
  params?: Record<string, unknown>;
  /** Hard timeout in milliseconds. */
  timeoutMs?: number;
}

/**
 * One branch of a decision. `next` is a node id or the sink `"end"`.
 * `maxRetries` bounds a route that loops back (validation rule 1, §1.4): a
 * retry route WITHOUT it is a graph error.
 */
export interface DecisionRoute {
  next: string;
  maxRetries?: number;
}

/** The sink every terminating route points at. */
export const END_ROUTE = 'end';

/**
 * Decision node config. The condition MUST evaluate structured output
 * (`output.is_complete === true`), never an implicit metric — `confidence`
 * does not exist in the APIs (cerca §1.4, honest stop criterion).
 */
export interface DecisionConfig {
  condition: string;
  onTrue: DecisionRoute;
  onFalse: DecisionRoute;
}

/** Short/long conversational memory (decorator, not a node). */
export interface MemoryDecorator {
  type: 'memory';
  scope: 'short' | 'long';
  /** Optional TTL, e.g. "6h". */
  expiry?: string;
}

/** Planning strategy (decorator, not a node). */
export interface PlannerDecorator {
  type: 'planner';
  /** `static` is the default; `dynamic` re-plans (relates to autonomy 5). */
  strategy?: 'static' | 'dynamic';
}

/**
 * Bounded error handling (decorator, not a node). When active, the react
 * layer (A-5) PROPOSES a BPMN boundary event on the agentTask — an undoable
 * command, never silent (§5).
 */
export interface ErrorBoundaryDecorator {
  type: 'errorBoundary';
  maxRetries: number;
  backoff?: 'fixed' | 'exponential';
}

export type Decorator = MemoryDecorator | PlannerDecorator | ErrorBoundaryDecorator;

interface AgentNodeBase {
  id: string;
  decorators?: Decorator[];
}

/** An LLMCall node (AgentO naming). */
export interface LlmNode extends AgentNodeBase {
  type: 'llm';
  config: LlmConfig;
}

/** A ToolCall node (AgentO naming). */
export interface ToolNode extends AgentNodeBase {
  type: 'tool';
  config: ToolConfig;
}

/** A Decision node — the honest stop + routing (§1.4). */
export interface DecisionNode extends AgentNodeBase {
  type: 'decision';
  config: DecisionConfig;
}

export type AgentNode = LlmNode | ToolNode | DecisionNode;

/**
 * A directed edge. For `delegate`, `to` is a versioned agent ref
 * (`agnt-verify@1.0.0`) rather than a local node id. `when` labels a
 * conditional edge (e.g. `"retry"` for the decision back-edge).
 */
export interface AgentEdge {
  from: string;
  to: string;
  edgeType: EdgeType;
  when?: string;
}

/**
 * A minimal input/output shape: property name → type token
 * (`"string"`, `"string[]"`, `"boolean"`). Deliberately plain — no JSON
 * Schema, no `@type` (§1.6). Must be non-empty (validation rule 5).
 */
export type SchemaShape = Record<string, string>;

/** The normative autonomy scale (§4); see autonomy.ts for the definitions. */
export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * The AgentWorkflow — the versioned artifact whose source of truth is the
 * Library (cerca §1.1); the BPMN export may embed a snapshot for degraded
 * read only, never as the source of truth.
 */
export interface AgentWorkflow {
  kind: 'AgentWorkflow';
  /** Bare id (e.g. "agnt-rsch"); the `agnt-`/`prm:` prefix is a naming
   * convention, not syntax (see ref.ts). */
  id: string;
  /** Full semantic version, e.g. "2.1.0". */
  version: string;
  name: string;
  autonomyLevel: AutonomyLevel;
  inputSchema: SchemaShape;
  outputSchema: SchemaShape;
  nodes: AgentNode[];
  edges: AgentEdge[];
}
