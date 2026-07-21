# agentflow/src

## Classes

### LangGraphImportError

Thrown when a LangGraph node cannot be mapped (unknown type) — the import
fails loudly rather than dropping semantics.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new LangGraphImportError(message, nodeId): LangGraphImportError;
```

###### Parameters

###### message

`string`

###### nodeId

`string`

###### Returns

[`LangGraphImportError`](#langgraphimporterror)

###### Overrides

```ts
Error.constructor
```

#### Properties

##### nodeId

```ts
readonly nodeId: string;
```

***

### AgentRefError

Thrown when a reference is structurally invalid (no `@`, empty id, or a
version that is not a run of dot-separated integers).

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new AgentRefError(message, input): AgentRefError;
```

###### Parameters

###### message

`string`

###### input

[`RefInput`](#refinput)

###### Returns

[`AgentRefError`](#agentreferror)

###### Overrides

```ts
Error.constructor
```

#### Properties

##### input

```ts
readonly input: RefInput;
```

## Interfaces

### AutonomyDefinition

One row of the normative scale (§4).

#### Properties

##### level

```ts
level: AutonomyLevel;
```

##### name

```ts
name: string;
```

Canonical English name (localized by the host at the edge).

##### definition

```ts
definition: string;
```

Objective definition — what the graph must look like at this level.

##### gate

```ts
gate: GateRequirement;
```

Downstream-gate obligation.

***

### LangGraphNode

One node of the LangGraph JSON subset.

#### Properties

##### id

```ts
id: string;
```

##### type

```ts
type: string;
```

Must be `llm` | `tool` | `decision` to import.

##### data?

```ts
optional data?: Record<string, unknown>;
```

***

### LangGraphEdge

One edge of the LangGraph JSON subset.

#### Properties

##### source

```ts
source: string;
```

##### target

```ts
target: string;
```

##### conditional?

```ts
optional conditional?: boolean;
```

True for a decision/routing edge (LangGraph conditional edge).

##### data?

```ts
optional data?: object;
```

###### edgeType?

```ts
optional edgeType?: string;
```

###### when?

```ts
optional when?: string;
```

***

### LangGraphJson

The LangGraph JSON document subset we read/write. Extra top-level keys are
tolerated (and, on import, declared as ignored).

#### Indexable

```ts
[key: string]: unknown
```

#### Properties

##### id?

```ts
optional id?: string;
```

##### name?

```ts
optional name?: string;
```

##### version?

```ts
optional version?: string;
```

##### nodes

```ts
nodes: LangGraphNode[];
```

##### edges

```ts
edges: LangGraphEdge[];
```

##### input\_schema?

```ts
optional input_schema?: SchemaShape;
```

##### output\_schema?

```ts
optional output_schema?: SchemaShape;
```

***

### LangGraphImportResult

#### Properties

##### workflow

```ts
workflow: AgentWorkflow;
```

##### warnings

```ts
warnings: string[];
```

Declared, human-readable notes for every ignored out-of-subset field.

***

### LangGraphExportResult

#### Properties

##### json

```ts
json: LangGraphJson;
```

##### warnings

```ts
warnings: string[];
```

Declared notes for every agentflow construct with no LangGraph form.

***

### AgentRef

A parsed, normalized reference — always a full semantic version.

#### Properties

##### id

```ts
id: string;
```

Bare id, e.g. "agnt-rsch" or "prm:research".

##### version

```ts
version: string;
```

Full `major.minor.patch`.

***

### ParsedRef

Outcome of parsing: the normalized ref plus any non-fatal normalizations.

#### Properties

##### ref

```ts
ref: AgentRef;
```

##### warnings

```ts
warnings: string[];
```

Human-readable notes, e.g. an abbreviated version that was expanded.

***

### Token

A token currently resting at a node — the render cursor.

#### Properties

##### id

```ts
id: string;
```

##### nodeId

```ts
nodeId: string;
```

***

### PendingChoice

A blocked interactive choice — shape parity only (agent mock is deterministic).

#### Properties

##### nodeId

```ts
nodeId: string;
```

##### kind

```ts
kind: "exclusive" | "inclusive" | "eventBased";
```

##### multiple

```ts
multiple: boolean;
```

##### options

```ts
options: object[];
```

###### edgeId

```ts
edgeId: string;
```

###### targetId

```ts
targetId: string;
```

###### label

```ts
label: string;
```

##### approximate

```ts
approximate: boolean;
```

***

### BoundaryOption

A fireable boundary event — shape parity only.

#### Properties

##### host

```ts
host: string;
```

##### boundary

```ts
boundary: string;
```

##### interrupting

```ts
interrupting: boolean;
```

##### label

```ts
label: string;
```

***

### PendingDecisionInput

A businessRuleTask awaiting inputs — shape parity only.

#### Properties

##### nodeId

```ts
nodeId: string;
```

##### label

```ts
label: string;
```

##### inputs

```ts
inputs: string[];
```

***

### TransitionRecord

One entry in the run trail — the mono log the panel renders. Identical to the
H7 record so the same component paints it. Agent runs emit the subset
`move` / `decision` / `decision-blocked` / `end`; the other members exist for
shape parity.

#### Properties

##### step

```ts
step: number;
```

Monotonic step index within the session.

##### type

```ts
type: 
  | "decision"
  | "end"
  | "move"
  | "split"
  | "join-wait"
  | "join-fire"
  | "boundary"
  | "decision-blocked";
```

##### message

```ts
message: string;
```

Human-readable description (localized by the host, English here).

##### nodeId?

```ts
optional nodeId?: string;
```

##### edgeId?

```ts
optional edgeId?: string;
```

##### approximate?

```ts
optional approximate?: boolean;
```

***

### BlockedDecision

A declared honest stop (§1.2 / §3). Retry exhausted, an unmatched decision
route, or a condition the mock cannot evaluate all land here — the run never
guesses a route (same discipline as S-FEEL's `nonSimulable`). Structurally
identical to the H7 `BlockedDecision`: `cell` names WHAT blocked (the route,
the error boundary, the condition), `reason` carries the human explanation
including any retry count.

#### Properties

##### nodeId

```ts
nodeId: string;
```

##### cell

```ts
cell: string;
```

##### reason

```ts
reason: string;
```

***

### SimulationState

A serializable snapshot of the whole run — the shared render contract.

#### Properties

##### tokens

```ts
tokens: Token[];
```

##### joinArrivals

```ts
joinArrivals: Record<string, string[]>;
```

Sync-join arrivals — always empty for an agent run (no joins).

##### traversedEdges

```ts
traversedEdges: string[];
```

Edges traversed so far (synthesized ids `from->to`).

##### visitedNodes

```ts
visitedNodes: string[];
```

Nodes a token rested on this run.

##### trail

```ts
trail: TransitionRecord[];
```

##### complete

```ts
complete: boolean;
```

##### deadlocked

```ts
deadlocked: boolean;
```

True only if the frontier stalls with no legal move; honest stops use
`blockedDecision` instead.

##### pendingChoice

```ts
pendingChoice: PendingChoice | null;
```

##### boundaryOptions

```ts
boundaryOptions: BoundaryOption[];
```

##### pendingDecisionInput

```ts
pendingDecisionInput: PendingDecisionInput | null;
```

##### blockedDecision

```ts
blockedDecision: BlockedDecision | null;
```

***

### NodeFixture

Per-node mock fixtures (cerca §2 determinism): outputs are declared, never
random. `outputs[i]` is the node's structured output on its i-th visit (the
last entry repeats if a node is visited more often). `fails` is the number of
consecutive execution failures before the node succeeds — it drives the
`errorBoundary` decorator; without one, the first failure is a hard stop.

#### Properties

##### outputs?

```ts
optional outputs?: Record<string, unknown>[];
```

##### fails?

```ts
optional fails?: number;
```

***

### SimulateOptions

Options for [simulate](#simulate).

#### Properties

##### fixtures?

```ts
optional fixtures?: Fixtures;
```

Per-node mock outputs; a node with none produces an empty output.

##### maxSteps?

```ts
optional maxSteps?: number;
```

Safety cap on micro-steps (default 10_000) — a malformed graph blocks
honestly rather than looping forever.

***

### ToolSchemaField

One field of a tool's input/output shape — the honest JSON-Schema subset
(`type`, `required`, `enum`, `items`, `properties`; anything else is out of
scope until SL-4's `SchemaNode`). Deliberately minimal and self-contained.

#### Properties

##### type

```ts
type: string;
```

##### required?

```ts
optional required?: boolean;
```

##### enum?

```ts
optional enum?: unknown[];
```

##### items?

```ts
optional items?: ToolSchemaField;
```

##### properties?

```ts
optional properties?: ToolSchema;
```

***

### ToolContract

The TOOL artifact of the Library (cerca §2.1 — a decorator/artifact, never a
fourth node type). Stored by versioned ref; the BPMN keeps the ref + local
config, the snapshot is read-only degraded.

#### Properties

##### kind

```ts
kind: "ToolContract";
```

##### id

```ts
id: string;
```

Bare id, e.g. "tool:browser-search" (the `tool:` prefix is part of the id).

##### version

```ts
version: string;
```

Full `major.minor.patch`.

##### name

```ts
name: string;
```

Machine name, e.g. "browser_search" (AgentO `usesTool`).

##### capability

```ts
capability: string;
```

One-line capability, in business language, e.g. "buscar na web".

##### inputSchema

```ts
inputSchema: ToolSchema;
```

##### outputSchema

```ts
outputSchema: ToolSchema;
```

##### effect

```ts
effect: ToolEffect;
```

##### dataScope

```ts
dataScope: string;
```

Data classification of the payload, e.g. "publico-sem-pii".

##### authorization

```ts
authorization: ToolAuthorization;
```

##### evidenceRequired

```ts
evidenceRequired: string;
```

Evidence the tool must attach, e.g. "nenhuma" (free-form; backend-owned).

##### simulation

```ts
simulation: string;
```

Simulation contract, e.g. "fixture-obrigatoria".

##### errors?

```ts
optional errors?: string[];
```

Declared error classes, e.g. ["timeout", "validation", "rate-limit"].

##### defaultFixture?

```ts
optional defaultFixture?: Record<string, unknown>;
```

Deterministic fixture used when no scenario fixture is supplied.

***

### ToolParamsMismatch

How a node's params diverge from a tool contract's `inputSchema`.

#### Properties

##### missingRequired

```ts
missingRequired: string[];
```

Required input keys the node did not supply.

##### unknownParams

```ts
unknownParams: string[];
```

Node param keys the contract does not declare.

***

### LlmConfig

LLM node config. `structuredOutput` forces JSON mode (§1.4).

#### Properties

##### model

```ts
model: string;
```

Model id, e.g. "gpt-4o".

##### promptRef

```ts
promptRef: string;
```

Versioned ref to a btv:prompt artifact of the Library, e.g. "prm:research@2.0.0".

##### structuredOutput?

```ts
optional structuredOutput?: boolean;
```

True → the model must emit structured JSON. Required when a structured
decision consumes this node (validation rule 3, §1.4).

***

### ToolConfig

Tool (MCP) node config.

#### Properties

##### usesTool

```ts
usesTool: string;
```

The versioned tool contract invoked (AgentO `usesTool`), a `tool:*@semver`
ref such as "tool:browser-search@1.2.0" (Squad Lane SL-1, cerca §2.1/§2.2).
Validated by `validateGraph` (`TOOL_REF_INVALID`) and resolved to a
[ToolContract](#toolcontract) through the injected ToolProvider.

##### params?

```ts
optional params?: Record<string, unknown>;
```

Call parameters; values may reference upstream outputs (`{{node.output.x}}`).

##### timeoutMs?

```ts
optional timeoutMs?: number;
```

Hard timeout in milliseconds.

***

### DecisionRoute

One branch of a decision. `next` is a node id or the sink `"end"`.
`maxRetries` bounds a route that loops back (validation rule 1, §1.4): a
retry route WITHOUT it is a graph error.

#### Properties

##### next

```ts
next: string;
```

##### maxRetries?

```ts
optional maxRetries?: number;
```

***

### DecisionConfig

Decision node config. The condition MUST evaluate structured output
(`output.is_complete === true`), never an implicit metric — `confidence`
does not exist in the APIs (cerca §1.4, honest stop criterion).

#### Properties

##### condition

```ts
condition: string;
```

##### onTrue

```ts
onTrue: DecisionRoute;
```

##### onFalse

```ts
onFalse: DecisionRoute;
```

***

### MemoryDecorator

Short/long conversational memory (decorator, not a node).

#### Properties

##### type

```ts
type: "memory";
```

##### scope

```ts
scope: "short" | "long";
```

##### expiry?

```ts
optional expiry?: string;
```

Optional TTL, e.g. "6h".

***

### PlannerDecorator

Planning strategy (decorator, not a node).

#### Properties

##### type

```ts
type: "planner";
```

##### strategy?

```ts
optional strategy?: "static" | "dynamic";
```

`static` is the default; `dynamic` re-plans (relates to autonomy 5).

***

### ErrorBoundaryDecorator

Bounded error handling (decorator, not a node). When active, the react
layer (A-5) PROPOSES a BPMN boundary event on the agentTask — an undoable
command, never silent (§5).

#### Properties

##### type

```ts
type: "errorBoundary";
```

##### maxRetries

```ts
maxRetries: number;
```

##### backoff?

```ts
optional backoff?: "fixed" | "exponential";
```

***

### LlmNode

An LLMCall node (AgentO naming).

#### Extends

- `AgentNodeBase`

#### Properties

##### id

```ts
id: string;
```

###### Inherited from

```ts
AgentNodeBase.id
```

##### decorators?

```ts
optional decorators?: Decorator[];
```

###### Inherited from

```ts
AgentNodeBase.decorators
```

##### type

```ts
type: "llm";
```

##### config

```ts
config: LlmConfig;
```

***

### ToolNode

A ToolCall node (AgentO naming).

#### Extends

- `AgentNodeBase`

#### Properties

##### id

```ts
id: string;
```

###### Inherited from

```ts
AgentNodeBase.id
```

##### decorators?

```ts
optional decorators?: Decorator[];
```

###### Inherited from

```ts
AgentNodeBase.decorators
```

##### type

```ts
type: "tool";
```

##### config

```ts
config: ToolConfig;
```

***

### DecisionNode

A Decision node — the honest stop + routing (§1.4).

#### Extends

- `AgentNodeBase`

#### Properties

##### id

```ts
id: string;
```

###### Inherited from

```ts
AgentNodeBase.id
```

##### decorators?

```ts
optional decorators?: Decorator[];
```

###### Inherited from

```ts
AgentNodeBase.decorators
```

##### type

```ts
type: "decision";
```

##### config

```ts
config: DecisionConfig;
```

***

### AgentEdge

A directed edge. For `delegate`, `to` is a versioned agent ref
(`agnt-verify@1.0.0`) rather than a local node id. `when` labels a
conditional edge (e.g. `"retry"` for the decision back-edge).

#### Properties

##### from

```ts
from: string;
```

##### to

```ts
to: string;
```

##### edgeType

```ts
edgeType: EdgeType;
```

##### when?

```ts
optional when?: string;
```

***

### AgentWorkflow

The AgentWorkflow — the versioned artifact whose source of truth is the
Library (cerca §1.1); the BPMN export may embed a snapshot for degraded
read only, never as the source of truth.

#### Properties

##### kind

```ts
kind: "AgentWorkflow";
```

##### id

```ts
id: string;
```

Bare id (e.g. "agnt-rsch"); the `agnt-`/`prm:` prefix is a naming
convention, not syntax (see ref.ts).

##### version

```ts
version: string;
```

Full semantic version, e.g. "2.1.0".

##### name

```ts
name: string;
```

##### autonomyLevel

```ts
autonomyLevel: AutonomyLevel;
```

##### inputSchema

```ts
inputSchema: SchemaShape;
```

##### outputSchema

```ts
outputSchema: SchemaShape;
```

##### nodes

```ts
nodes: AgentNode[];
```

##### edges

```ts
edges: AgentEdge[];
```

***

### ValidationIssue

A single validation finding.

#### Properties

##### code

```ts
code: string;
```

Stable machine code, e.g. "RETRY_WITHOUT_MAX".

##### severity

```ts
severity: "error" | "warning";
```

##### message

```ts
message: string;
```

English message; the host localizes at the edge.

##### nodeId?

```ts
optional nodeId?: string;
```

The offending node, when the issue is node-scoped.

##### remediation?

```ts
optional remediation?: string;
```

Actionable fix — errors that block promotion always carry one (§1.5).

***

### ValidateOptions

Injected, degradable integrations (cerca §1.7).

#### Properties

##### resolveDelegate?

```ts
optional resolveDelegate?: (ref) => boolean;
```

Resolves a delegate reference to another AgentWorkflow. Injected by the
host (registry). Absent or returning false → the delegate is a warning,
not an error (§3.4).

###### Parameters

###### ref

[`AgentRef`](#agentref)

###### Returns

`boolean`

##### resolveTool?

```ts
optional resolveTool?: ResolveTool;
```

Resolves a `tool:*@semver` ref to its [ToolContract](#toolcontract) — the injected
`ToolProvider` (Squad Lane SL-2). Absent → tool-contract checks degrade to
the structural ref check only; present but returning `undefined` → a
declared `TOOL_UNRESOLVED` warning (cerca §2.4, never silent).

## Type Aliases

### GateRequirement

```ts
type GateRequirement = "required" | "optional" | "none";
```

Whether a downstream btv:gate is required at this level.

***

### RefInput

```ts
type RefInput = 
  | string
  | {
  id: string;
  version: string;
};
```

The input shapes [parseRef](#parseref) accepts.

***

### GatewayKind

```ts
type GatewayKind = "exclusive" | "parallel" | "inclusive" | "eventBased";
```

BPMN gateway roles — carried for shape parity; unused by an agent run.

***

### Fixtures

```ts
type Fixtures = Record<string, NodeFixture>;
```

Fixtures keyed by node id.

***

### ToolEffect

```ts
type ToolEffect = 
  | "read"
  | "propose"
  | "notify"
  | "write-reversible"
  | "write-irreversible"
  | "external-commitment";
```

What a tool DOES when invoked (cerca §2.8). Risk classifies, permission
decides, effect explains — the effect never grants authorization on its own.

***

### ToolAuthorization

```ts
type ToolAuthorization = "automatica" | "gate" | "proibida";
```

The governance decision for a tool (cerca §2.8) — a field of its OWN, never
inferred from the effect. `gate` means a human gate must cover the call
before the effect; `proibida` bans the tool outright.

***

### ToolSchema

```ts
type ToolSchema = Record<string, ToolSchemaField>;
```

A tool input/output shape: property name → field descriptor.

***

### ResolveTool

```ts
type ResolveTool = (ref) => ToolContract | undefined;
```

Resolves a versioned tool ref to its contract — INJECTED by the host (SL-2's
`ToolProvider` implements it). Absent → tool-contract checks degrade to the
structural ref check only (never an error); present but returning `undefined`
→ a declared `TOOL_UNRESOLVED` warning (cerca §2.4, never silent).

#### Parameters

##### ref

[`AgentRef`](#agentref)

#### Returns

[`ToolContract`](#toolcontract) \| `undefined`

***

### NodeType

```ts
type NodeType = "llm" | "tool" | "decision";
```

Exactly three node types — never a fourth (cerca §1.3). Memory, Planner and
ErrorBoundary are DECORATORS (properties of a node), not nodes of their own.

***

### DecoratorType

```ts
type DecoratorType = "memory" | "planner" | "errorBoundary";
```

The three decorator kinds. A decorator is a property, never a node (§1.3).

***

### EdgeType

```ts
type EdgeType = "toolCall" | "data" | "delegate";
```

Edge semantics. `toolCall` (solid) invokes a tool; `data` carries a value
(incl. the retry back-edge, `when: "retry"`); `delegate` (⤳, a2a:1.0)
references ANOTHER agent by versioned ref — semantics only, no protocol in
v1 (cerca §0/§3).

***

### Decorator

```ts
type Decorator = 
  | MemoryDecorator
  | PlannerDecorator
  | ErrorBoundaryDecorator;
```

***

### AgentNode

```ts
type AgentNode = 
  | LlmNode
  | ToolNode
  | DecisionNode;
```

***

### SchemaShape

```ts
type SchemaShape = Record<string, string>;
```

A minimal input/output shape: property name → type token
(`"string"`, `"string[]"`, `"boolean"`). Deliberately plain — no JSON
Schema, no `@type` (§1.6). Must be non-empty (validation rule 5).

***

### AutonomyLevel

```ts
type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;
```

The normative autonomy scale (§4); see autonomy.ts for the definitions.

## Variables

### AUTONOMY\_SCALE

```ts
const AUTONOMY_SCALE: readonly AutonomyDefinition[];
```

The full scale, index === level.

***

### APPROVAL\_GATE\_AGENT

```ts
const APPROVAL_GATE_AGENT: AgentWorkflow;
```

Approval Gate Agent — autonomy 1 (Loop-free); the ★ default.

***

### RESEARCH\_AGENT

```ts
const RESEARCH_AGENT: AgentWorkflow;
```

Research Agent — autonomy 2 (Bounded Loop); the prototype pattern (§3).

***

### DOCUMENT\_REVIEW\_AGENT

```ts
const DOCUMENT_REVIEW_AGENT: AgentWorkflow;
```

Document Review Agent — autonomy 3 (Decision Tree).

***

### DEFAULT\_TEMPLATE\_ID

```ts
const DEFAULT_TEMPLATE_ID: string = APPROVAL_GATE_AGENT.id;
```

The id of the ★ default template surfaced first in the palette (§6).

***

### TEMPLATES

```ts
const TEMPLATES: readonly AgentWorkflow[];
```

All templates, in palette order (default first).

***

### END\_ROUTE

```ts
const END_ROUTE: "end" = 'end';
```

The sink every terminating route points at.

## Functions

### gateRequirement()

```ts
function gateRequirement(level): GateRequirement;
```

The gate obligation for a level (§4): ≤3 required, 4 optional (warning),
5 none (permanent inspector warning). Pure — the reachability check is
core's (A-3).

#### Parameters

##### level

[`AutonomyLevel`](#autonomylevel)

#### Returns

[`GateRequirement`](#gaterequirement)

***

### requiresDownstreamGate()

```ts
function requiresDownstreamGate(level): boolean;
```

True when a level demands a reachable downstream gate (levels 0–3).

#### Parameters

##### level

[`AutonomyLevel`](#autonomylevel)

#### Returns

`boolean`

***

### minCoherentLevel()

```ts
function minCoherentLevel(wf): AutonomyLevel;
```

The minimum autonomy level the GRAPH itself justifies — "o grafo é quem
manda". Level 5 (self-modifying) cannot be inferred from structure and is a
declared-only ceiling; level 0 (manual) is likewise a declared floor a graph
with nodes cannot force below 1.

#### Parameters

##### wf

[`AgentWorkflow`](#agentworkflow)

#### Returns

[`AutonomyLevel`](#autonomylevel)

***

### autonomyCoherence()

```ts
function autonomyCoherence(wf): ValidationIssue[];
```

Coherence check (§4): the declared `autonomyLevel` must not be LOWER than
the level the graph justifies (e.g. level 1 with a retry loop is incoherent).
Declaring a higher level is allowed — it is a more conservative claim.

#### Parameters

##### wf

[`AgentWorkflow`](#agentworkflow)

#### Returns

[`ValidationIssue`](#validationissue)[]

***

### nodeIndex()

```ts
function nodeIndex(wf): Map<string, AgentNode>;
```

id → node, for O(1) lookup.

#### Parameters

##### wf

[`AgentWorkflow`](#agentworkflow)

#### Returns

`Map`\<`string`, [`AgentNode`](#agentnode)\>

***

### hasDelegateEdge()

```ts
function hasDelegateEdge(wf): boolean;
```

True when the workflow has any `delegate` edge (→ autonomy level 4).

#### Parameters

##### wf

[`AgentWorkflow`](#agentworkflow)

#### Returns

`boolean`

***

### decisionRoutes()

```ts
function decisionRoutes(node): object[];
```

The two routes of a decision, labeled.

#### Parameters

##### node

[`DecisionNode`](#decisionnode)

#### Returns

`object`[]

***

### internalSuccessors()

```ts
function internalSuccessors(
   wf, 
   id, 
   index?): string[];
```

Internal control-flow successors of a node (node ids only; `"end"` and
delegate targets are dropped). Decisions use their config routes; other
nodes use their non-delegate outgoing edges.

#### Parameters

##### wf

[`AgentWorkflow`](#agentworkflow)

##### id

`string`

##### index?

`Map`\<`string`, [`AgentNode`](#agentnode)\> = `...`

#### Returns

`string`[]

***

### canReach()

```ts
function canReach(
   wf, 
   from, 
   target, 
   index?): boolean;
```

True when `target` is reachable from `from` along internal successors
(path length ≥ 1, so a node reaches itself only through a real cycle).

#### Parameters

##### wf

[`AgentWorkflow`](#agentworkflow)

##### from

`string`

##### target

`string`

##### index?

`Map`\<`string`, [`AgentNode`](#agentnode)\> = `...`

#### Returns

`boolean`

***

### loopComponents()

```ts
function loopComponents(wf, index?): string[][];
```

Strongly connected components with ≥1 internal edge (Tarjan). A returned
component is either a multi-node cycle or a single self-looping node — the
exact set of "loop" nodes. Trivial single-node components are omitted.

#### Parameters

##### wf

[`AgentWorkflow`](#agentworkflow)

##### index?

`Map`\<`string`, [`AgentNode`](#agentnode)\> = `...`

#### Returns

`string`[][]

***

### hasRetryLoop()

```ts
function hasRetryLoop(wf): boolean;
```

True when the internal graph contains a retry loop (→ autonomy level ≥ 2).

#### Parameters

##### wf

[`AgentWorkflow`](#agentworkflow)

#### Returns

`boolean`

***

### isBranchingDecision()

```ts
function isBranchingDecision(wf): boolean;
```

True when some decision genuinely branches into distinct forward paths (→
autonomy level 3): both routes are forward (neither loops back to the
decision), their targets differ, and at least one target is a real node
(not the sink). A retry decision (one route loops back) or a pure
terminator (both routes end) does not count.

#### Parameters

##### wf

[`AgentWorkflow`](#agentworkflow)

#### Returns

`boolean`

***

### importLangGraph()

```ts
function importLangGraph(json): LangGraphImportResult;
```

Imports a LangGraph JSON subset into an AgentWorkflow. Out-of-subset
top-level keys are ignored and DECLARED in `warnings`; an unmappable node
type throws [LangGraphImportError](#langgraphimporterror) naming the node. `autonomyLevel` is
recomputed from the graph (it is not part of the subset).

#### Parameters

##### json

[`LangGraphJson`](#langgraphjson)

#### Returns

[`LangGraphImportResult`](#langgraphimportresult)

***

### exportLangGraph()

```ts
function exportLangGraph(workflow): LangGraphExportResult;
```

Exports an AgentWorkflow to the LangGraph JSON subset. Constructs with no
LangGraph representation are omitted and DECLARED in `warnings`:
`autonomyLevel` (always), decorators, and `delegate` edges.

#### Parameters

##### workflow

[`AgentWorkflow`](#agentworkflow)

#### Returns

[`LangGraphExportResult`](#langgraphexportresult)

***

### parseRef()

```ts
function parseRef(input): ParsedRef;
```

Parses any accepted reference shape into a normalized [AgentRef](#agentref).
Throws [AgentRefError](#agentreferror) for structurally invalid input; abbreviated
versions are normalized and surfaced in `warnings`, not rejected.

#### Parameters

##### input

[`RefInput`](#refinput)

#### Returns

[`ParsedRef`](#parsedref)

***

### toRef()

```ts
function toRef(input): AgentRef;
```

Parses and discards warnings — for callers that only want the ref.

#### Parameters

##### input

[`RefInput`](#refinput)

#### Returns

[`AgentRef`](#agentref)

***

### formatRef()

```ts
function formatRef(ref): string;
```

Formats a ref back to its canonical `id@version` storage string.

#### Parameters

##### ref

[`AgentRef`](#agentref)

#### Returns

`string`

***

### isValidRef()

```ts
function isValidRef(input): boolean;
```

True when `input` parses as a valid reference (no throw).

#### Parameters

##### input

[`RefInput`](#refinput)

#### Returns

`boolean`

***

### simulate()

```ts
function simulate(wf, options?): SimulationState;
```

Runs a deterministic mock simulation of `wf` and returns the final
[SimulationState](#simulationstate). The trail is the ordered record of every micro-step;
an honest stop lands in `blockedDecision`, a clean finish sets `complete`.

#### Parameters

##### wf

[`AgentWorkflow`](#agentworkflow)

##### options?

[`SimulateOptions`](#simulateoptions) = `{}`

#### Returns

[`SimulationState`](#simulationstate)

***

### effectRequiresGate()

```ts
function effectRequiresGate(effect): boolean;
```

Pure predicate (the `requiresDownstreamGate` mold): true when a tool with this
effect may only run behind a human gate — a `write-irreversible` or
`external-commitment` effect cannot run `automatica` (cerca §2.9).

This is a CLASSIFIER only. Whether a covering gate is actually on the path
before the effect (`EFFECT_NEEDS_GATE` / `GATE_NOT_COVERING`) is a decision of
the surrounding BPMN process — it lives in `@buildtovalue/core` over
`reachableGateFrom` (Squad Lane SL-12), which consumes this predicate the same
way the autonomy→gate rule consumes `gateRequirement`. The headless agentflow
cannot see the process and must not emit that rule (it would fire always or
never — the acidity fence, cerca §2.3).

#### Parameters

##### effect

[`ToolEffect`](#tooleffect)

#### Returns

`boolean`

***

### isToolRef()

```ts
function isToolRef(input): boolean;
```

True when `input` is a well-formed versioned TOOL reference — a parseable
`id@semver` whose id carries the `tool:` prefix (cerca §2.1/§2.2). A bare
capability name like "browser_search" is NOT a tool ref.

#### Parameters

##### input

[`RefInput`](#refinput)

#### Returns

`boolean`

***

### matchToolParams()

```ts
function matchToolParams(params, inputSchema): ToolParamsMismatch;
```

Compares a tool node's call params against a contract `inputSchema` (SL-1).
Keys only — values are template references (`{{node.output.x}}`), so a value
type-check would be dishonest. Every REQUIRED input must be present, and every
supplied param must be declared by the contract.

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

##### inputSchema

[`ToolSchema`](#toolschema)

#### Returns

[`ToolParamsMismatch`](#toolparamsmismatch)

***

### validateGraph()

```ts
function validateGraph(wf, options?): ValidationIssue[];
```

Validates an AgentWorkflow against the §3 rules, the §1.4 honest-stop
prohibition and the §4 autonomy coherence rule. Pure and deterministic —
issue order is stable (rule order, then node/edge order).

#### Parameters

##### wf

[`AgentWorkflow`](#agentworkflow)

##### options?

[`ValidateOptions`](#validateoptions) = `{}`

#### Returns

[`ValidationIssue`](#validationissue)[]

***

### isValid()

```ts
function isValid(wf, options?): boolean;
```

Convenience: true when validation produced no `error`-severity issue.

#### Parameters

##### wf

[`AgentWorkflow`](#agentworkflow)

##### options?

[`ValidateOptions`](#validateoptions) = `{}`

#### Returns

`boolean`
