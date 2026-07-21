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
  /**
   * Squad Lane SL-3 (additive) — the provider is ALWAYS host-injected; this is a
   * label ("host-injetado"), never an endpoint or key (cerca §2.7).
   */
  provider?: string;
  /** Cheaper/secondary model tried on failure (a label, not a runtime). */
  fallbackModel?: string;
  /** Sampling temperature (modeling value). */
  temperature?: number;
  /** Projected output-token ceiling per call — feeds the budget projection. */
  maxOutputTokens?: number;
}

/**
 * Governed budget for an AgentWorkflow (Squad Lane SL-3). Autonomy ≥ 2 without a
 * budget is a `BUDGET_MISSING` warning; the simulation stops honestly
 * (`BUDGET_EXCEEDED`) when a projected dimension overflows. All optional so the
 * field is purely additive (no existing artifact breaks — MINOR).
 */
export interface AgentBudget {
  maxTokens?: number;
  maxCostBRL?: number;
  maxWallTimeMs?: number;
  maxSteps?: number;
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
 * An honest subset of JSON Schema (Squad Lane SL-4) — a field descriptor with
 * only `type`, `required`, `enum`, `items`, `properties`. ANYTHING outside this
 * set is declared in a warning (`SCHEMA_UNSUPPORTED_KEYWORD`), never silently
 * honored — we do not claim to support JSON Schema we cannot evaluate.
 */
export interface SchemaNode {
  type: string;
  required?: boolean;
  enum?: unknown[];
  items?: SchemaNode;
  properties?: Record<string, SchemaNode>;
}

/**
 * One field of a {@link SchemaShape}: the legacy plain type token (`"string"`,
 * `"string[]"`, `"boolean"`) OR a {@link SchemaNode}. The union is purely
 * ADDITIVE (SL-4, MINOR) — every existing string-token schema stays valid and
 * byte-stable; readers normalize a string to `{ type }` via `normalizeSchema`.
 */
export type SchemaField = string | SchemaNode;

/**
 * A minimal input/output shape: property name → {@link SchemaField}. Must be
 * non-empty (validation rule 5). The plain-string form is the Handoff 12
 * baseline; the {@link SchemaNode} form is the SL-4 honest JSON-Schema subset.
 */
export type SchemaShape = Record<string, SchemaField>;

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
  /** Governed budget (Squad Lane SL-3). Autonomy ≥ 2 without one warns
   * (`BUDGET_MISSING`); the simulation stops honestly on projected overflow. */
  budget?: AgentBudget;
}
