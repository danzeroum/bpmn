# simulation/src

## Classes

### CoverageTracker

Tracks which structural paths a set of sessions has exercised. Held by the
host across engine resets, so "restart" keeps coverage (Handoff 7A §3.1). A
path counts as covered once a session's traversed edges include all of it.

#### Constructors

##### Constructor

```ts
new CoverageTracker(graph): CoverageTracker;
```

###### Parameters

###### graph

[`SimGraph`](#simgraph)

###### Returns

[`CoverageTracker`](#coveragetracker)

#### Properties

##### paths

```ts
readonly paths: CoveragePath[];
```

#### Accessors

##### summary

###### Get Signature

```ts
get summary(): CoverageSummary;
```

###### Returns

[`CoverageSummary`](#coveragesummary)

#### Methods

##### record()

```ts
record(traversedEdges): string[];
```

Fold a completed session's traversed edges in; returns newly covered ids.

###### Parameters

###### traversedEdges

`Iterable`\<`string`\>

###### Returns

`string`[]

##### isCovered()

```ts
isCovered(pathId): boolean;
```

###### Parameters

###### pathId

`string`

###### Returns

`boolean`

***

### SimulationEngine

Headless BPMN token engine. Small-step and deterministic: every call to
[advance](#advance) fires exactly one token by one hop, and every branching
point is resolved by an explicit [Decision](#decision). The ordered list of
decisions IS the scenario ([scenario](#scenario)), so [SimulationEngine.replay](#replay)
reproduces a run bit-for-bit.

Exact semantics for **XOR, AND and event-based** gateways and boundary
events. **OR (inclusive)** uses a dominator-based structural convergence
rule (see dominates and SimulationEngine.orJoinReady): the
join fires once no live token can still reach it *without* having already
passed through it. This is re-evaluated after every step, so a branch that
diverges away from the join no longer strands it. The `approximate` flag is
retained because a fully token-state-exact OR-join is undecidable in the
general case; see `docs/limitations.md`. Never mutates the diagram.

#### Constructors

##### Constructor

```ts
new SimulationEngine(diagram, options?): SimulationEngine;
```

###### Parameters

###### diagram

`BpmnDiagram`

###### options?

[`SimulationOptions`](#simulationoptions) = `{}`

###### Returns

[`SimulationEngine`](#simulationengine)

#### Properties

##### graph

```ts
readonly graph: SimGraph;
```

#### Accessors

##### hasApproximateSemantics

###### Get Signature

```ts
get hasApproximateSemantics(): boolean;
```

True when any inclusive (OR) gateway participates: OR is approximate.

###### Returns

`boolean`

##### state

###### Get Signature

```ts
get state(): SimulationState;
```

###### Returns

[`SimulationState`](#simulationstate)

##### transitions

###### Get Signature

```ts
get transitions(): TransitionRecord[];
```

The complete session trail (the human-readable transition log).

###### Returns

[`TransitionRecord`](#transitionrecord)[]

##### complete

###### Get Signature

```ts
get complete(): boolean;
```

All tokens consumed and no token stuck at a sync join.

###### Returns

`boolean`

##### deadlocked

###### Get Signature

```ts
get deadlocked(): boolean;
```

Tokens are gone but some are absorbed at a sync join that will never
complete — the deadlock the soundness analysis predicts.

###### Returns

`boolean`

##### pendingChoice

###### Get Signature

```ts
get pendingChoice(): PendingChoice | null;
```

The first branch decision the engine is blocked on, if any.

###### Returns

[`PendingChoice`](#pendingchoice-1) \| `null`

##### boundaryOptions

###### Get Signature

```ts
get boundaryOptions(): BoundaryOption[];
```

Boundary events that can be fired right now (a token rests on their
host). E-6 (§3e): ERROR boundaries leave this manual list — the user
throws the ERROR ([errorThrowOptions](#errorthrowoptions) + [throwError](#throwerror)) and the
engine resolves the boundary by matching. `fireBoundary` itself still
accepts them (old scenarios replay unchanged).

###### Returns

[`BoundaryOption`](#boundaryoption)[]

##### errorThrowOptions

###### Get Signature

```ts
get errorThrowOptions(): ErrorThrowOption[];
```

"Throw error" cards (E-6): one per host with a resting token and ≥1 error
boundary. The options are the DISTINCT named definitions its boundaries
match on, plus the UNCATALOGUED error (`errorRef: undefined`, reforço 10)
— the UI path that exercises the declared catch-all.

###### Returns

[`ErrorThrowOption`](#errorthrowoption)[]

##### canAdvance

###### Get Signature

```ts
get canAdvance(): boolean;
```

A token exists that can be advanced without a decision.

###### Returns

`boolean`

##### pendingDecisionInput

###### Get Signature

```ts
get pendingDecisionInput(): PendingDecisionInput | null;
```

A businessRuleTask waiting for its decision inputs (SF-2), if any.

###### Returns

[`PendingDecisionInput`](#pendingdecisioninput-1) \| `null`

##### scenario

###### Get Signature

```ts
get scenario(): Scenario;
```

The serializable scenario: the ordered decisions plus provenance.

###### Returns

[`Scenario`](#scenario-1)

#### Methods

##### reset()

```ts
reset(): void;
```

Reset to the initial marking (a token on each start event). Coverage is
tracked externally, so callers keep it across resets (Handoff 7A §3.1).

###### Returns

`void`

##### advance()

```ts
advance(): StepResult;
```

Advance the first decision-free token by one hop. No-op when the only
tokens sit at a split (resolve with [choose](#choose)) or the run is done.

###### Returns

[`StepResult`](#stepresult)

##### choose()

```ts
choose(decision): StepResult;
```

Resolve the pending branch decision and move the token(s).

###### Parameters

###### decision

[`Decision`](#decision)

###### Returns

[`StepResult`](#stepresult)

##### fireBoundary()

```ts
fireBoundary(boundaryId): StepResult;
```

Fire a boundary event on the host a token currently rests on.

###### Parameters

###### boundaryId

`string`

###### Returns

[`StepResult`](#stepresult)

##### throwError()

```ts
throwError(host, errorRef?): StepResult;
```

Throw an error on a host: the USER picks the error (a named definition id
or the uncatalogued `undefined`), the ENGINE resolves the destination by
MATCHING — a specific `errorRef` match beats the declared catch-all
(documented precedence: specific + catch-all present is NOT ambiguity);
genuinely ambiguous or uncaught throws are DECLARED stops naming node,
reason and candidates ([BlockedDecision](#blockeddecision)) — never a guess (§5).

###### Parameters

###### host

`string`

###### errorRef?

`string`

###### Returns

[`StepResult`](#stepresult)

##### throwSignal()

```ts
throwSignal(ref): StepResult;
```

Broadcast a signal by named definition: EVERY waiting catch that matches
advances — deterministic, no ambiguity possible. Zero recipients is a
DECLARED no-op in the trail, never a guessed route.

###### Parameters

###### ref

`string`

###### Returns

[`StepResult`](#stepresult)

##### throwMessage()

```ts
throwMessage(ref): StepResult;
```

Deliver a message by named definition: a SINGLE destination. More than
one waiting candidate means runtime correlation — not simulable, so the
stop is DECLARED naming the candidates (see limitations.md); zero is a
declared no-op.

###### Parameters

###### ref

`string`

###### Returns

[`StepResult`](#stepresult)

##### replay()

```ts
static replay(
   diagram, 
   scenario, 
   options?): SimulationEngine;
```

Rebuild a run deterministically from a scenario. Auto-advances between
recorded decisions; applies each decision at the point it becomes due.

###### Parameters

###### diagram

`BpmnDiagram`

###### scenario

[`Scenario`](#scenario-1)

###### options?

`Omit`\<[`SimulationOptions`](#simulationoptions), `"scope"`\> = `{}`

###### Returns

[`SimulationEngine`](#simulationengine)

***

### SimulationError

#### Extends

- `BpmnError`

#### Constructors

##### Constructor

```ts
new SimulationError(message): SimulationError;
```

###### Parameters

###### message

`string`

###### Returns

[`SimulationError`](#simulationerror)

###### Overrides

```ts
BpmnError.constructor
```

#### Properties

##### code

```ts
readonly code: string;
```

###### Inherited from

```ts
BpmnError.code
```

## Interfaces

### CoveragePath

One structural route through the graph, from a start to a terminal.

#### Properties

##### id

```ts
id: string;
```

Stable signature (the traversed edge ids joined) — dedupe key.

##### label

```ts
label: string;
```

Human-readable label: the node labels along the route.

##### edges

```ts
edges: string[];
```

Ordered sequence-flow edge ids that define the route.

***

### CoverageSummary

Snapshot of coverage for the panel checklist (Handoff 7A §3.3).

#### Properties

##### total

```ts
total: number;
```

##### covered

```ts
covered: number;
```

##### truncated

```ts
truncated: boolean;
```

True when path enumeration hit the safety cap (see [MAX\_PATHS](#max_paths)).

##### paths

```ts
paths: CoveragePath & object[];
```

***

### StepResult

What a single call to [SimulationEngine.advance](#advance) / choose produced.

#### Properties

##### moved

```ts
moved: boolean;
```

A token changed position (moved, split, joined or was consumed).

##### transitions

```ts
transitions: TransitionRecord[];
```

The transitions appended to the trail by this step.

***

### Scenario

A replayable simulation scenario (the roteiro) — canonical JSON.

#### Properties

##### diagramId

```ts
diagramId: string;
```

##### versionId

```ts
versionId: string;
```

##### semanticVersion

```ts
semanticVersion: string;
```

##### scope

```ts
scope: string | null;
```

Simulated scope, or `null` for the top process level.

##### decisions

```ts
decisions: Decision[];
```

***

### SimGraph

The control-flow graph the token engine walks. It is built from a diagram
using the **same flow-node / flow-edge classification the soundness analysis
uses** (Handoff 7 §7.2): both import it from `@buildtovalue/core`
(`model/flow.ts`), so the coverage checklist and the deadlock verdict agree
with soundness by construction. `tests/soundnessAgreement.test.ts` keeps
pinning the resulting adjacencies to each other end-to-end.

#### Properties

##### scope

```ts
scope: string | undefined;
```

##### nodes

```ts
nodes: Map<string, SimNode>;
```

##### edges

```ts
edges: Map<string, SimEdge>;
```

##### starts

```ts
starts: string[];
```

##### boundariesByHost

```ts
boundariesByHost: Map<string, string[]>;
```

Boundary event ids grouped by their host activity id.

***

### SessionCoverage

The path-coverage a session recorded, in compact serializable form.

#### Properties

##### covered

```ts
covered: number;
```

##### total

```ts
total: number;
```

##### exercised

```ts
exercised: string[];
```

Stable signatures of the exercised structural paths.

***

### SimulationSession

A recorded simulation session — the serializable artifact the host registers
in the ledger and turns into SACM evidence (Handoff 7A §3.5): the roteiro
(scenario), the coverage it closed, the diagram version it ran on, and the
author/timestamp. Neutral JSON data — it never imports `audit`/`library`;
the host adapters map it into those systems by injection.

#### Properties

##### diagramId

```ts
diagramId: string;
```

##### versionId

```ts
versionId: string;
```

##### semanticVersion

```ts
semanticVersion: string;
```

##### scenario

```ts
scenario: Scenario;
```

##### scenarioHash

```ts
scenarioHash: string;
```

Short content hash of the scenario ("roteiro #hash").

##### coverage

```ts
coverage: SessionCoverage;
```

##### author

```ts
author: string;
```

##### timestamp

```ts
timestamp: string;
```

ISO-8601 timestamp, supplied by the host — the package never reads a clock.

***

### SimEdge

A sequence flow in the simulation graph.

#### Properties

##### id

```ts
id: string;
```

##### source

```ts
source: string;
```

##### target

```ts
target: string;
```

##### label

```ts
label: string;
```

Label shown on the gateway choice card; falls back to the target label.

***

### SimNode

A flow node in the simulation graph.

#### Properties

##### id

```ts
id: string;
```

##### type

```ts
type: string;
```

##### label

```ts
label: string;
```

##### gateway?

```ts
optional gateway?: GatewayKind;
```

Present when the node is a gateway (controls split/join semantics).

##### outgoing

```ts
outgoing: string[];
```

Outgoing sequence-flow edge ids, in diagram order.

##### incoming

```ts
incoming: string[];
```

Incoming sequence-flow edge ids.

##### boundaryHost?

```ts
optional boundaryHost?: string;
```

Host activity id when this node is a boundary event.

##### interrupting?

```ts
optional interrupting?: boolean;
```

Interrupting boundary (cancels the host) vs non-interrupting (spawns).

##### eventKind?

```ts
optional eventKind?: string;
```

Event kind (`properties.eventDefinition`) — E-6 matching input.

##### eventRef?

```ts
optional eventRef?: string;
```

Named-definition reference (`properties.eventDefinitionRef`) — the
matching KEY (3a ids; E-3 `gov-*` mirrors match identically).

##### eventRefLabel?

```ts
optional eventRefLabel?: string;
```

Resolved definition name for UI labels (falls back to the ref).

##### isStart

```ts
isStart: boolean;
```

##### isEnd

```ts
isEnd: boolean;
```

***

### PendingChoice

A choice the engine is blocked on. The host must resolve it with
[Decision](#decision) before the simulation can advance further.

#### Properties

##### nodeId

```ts
nodeId: string;
```

The gateway node requiring a decision.

##### kind

```ts
kind: "exclusive" | "inclusive" | "eventBased";
```

`exclusive`/`eventBased` pick exactly one; `inclusive` picks ≥1.

##### multiple

```ts
multiple: boolean;
```

Whether more than one option may be selected (OR-split only).

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

True for the OR-split — the panel must show the approximation notice.

***

### BoundaryOption

A boundary event that can be fired while a token rests on its host.

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

##### eventKind?

```ts
optional eventKind?: string;
```

Event kind of the boundary (`timer`, `message`, `error`…), when any.

##### eventRef?

```ts
optional eventRef?: string;
```

Named-definition reference the boundary matches on (E-6).

##### catchAll?

```ts
optional catchAll?: boolean;
```

Error boundary WITHOUT errorRef — the DECLARED catch-all (E-6).

***

### ErrorThrowOption

"Throw error" choices for one host with a resting token (E-6, §3e): the
user picks the ERROR (by named definition), the ENGINE resolves the
boundary by matching — the inverse of the manual boundary card. The
`errorRef: undefined` entry is the UNCATALOGUED error (reforço 10), the UI
path that exercises the catch-all.

#### Properties

##### host

```ts
host: string;
```

##### hostLabel

```ts
hostLabel: string;
```

##### options

```ts
options: object[];
```

###### errorRef?

```ts
optional errorRef?: string;
```

###### label?

```ts
optional label?: string;
```

***

### DecisionOutcome

Outcome of evaluating a node's decision table (Handoff 9 SF-2). Produced by
the injected [DecisionEvaluator](#decisionevaluator) — the engine itself knows nothing
about S-FEEL or DMN.

#### Properties

##### outputs?

```ts
optional outputs?: Record<string, string | number | boolean>;
```

Output values, keyed by output name — recorded in the trail.

##### ruleIndex?

```ts
optional ruleIndex?: number;
```

0-based index of the rule that fired.

##### noMatch?

```ts
optional noMatch?: boolean;
```

True when no rule matched (a declared non-result, not a guess).

##### nonSimulable?

```ts
optional nonSimulable?: object;
```

Declared honest failure (cerca §1.6) — the token stops with this.

###### cell

```ts
cell: string;
```

###### reason

```ts
reason: string;
```

***

### DecisionEvaluator

HOST-injected decision support (Handoff 9 SF-2, same injection pattern as
Signer/AnchorAdapter): lets a `businessRuleTask` route through a real
decision table without the engine importing `dmn` or `sfeel`. The
`@buildtovalue/dmn` package ships an S-FEEL-backed implementation.

#### Methods

##### hasDecision()

```ts
hasDecision(nodeId): boolean;
```

True when `nodeId` carries a decision table this evaluator can run.

###### Parameters

###### nodeId

`string`

###### Returns

`boolean`

##### inputsOf()

```ts
inputsOf(nodeId): string[];
```

Input variable names — the prompt card asks the user for these.

###### Parameters

###### nodeId

`string`

###### Returns

`string`[]

##### evaluate()

```ts
evaluate(nodeId, context): DecisionOutcome;
```

###### Parameters

###### nodeId

`string`

###### context

`Record`\<`string`, `number` \| `string` \| `boolean`\>

###### Returns

[`DecisionOutcome`](#decisionoutcome)

***

### PendingDecisionInput

A businessRuleTask waiting for its decision inputs (like PendingChoice).

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

Input variable names to collect from the user.

***

### BlockedDecision

A token stopped on a declared non-simulable decision (§5): the honest
warning names the cell and the reason; the session does not proceed past it.

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

### TransitionRecord

One entry in the session trail — the mono log the panel renders.

#### Properties

##### step

```ts
step: number;
```

Monotonic step index within the session.

##### type

```ts
type: 
  | "event"
  | "decision"
  | "end"
  | "move"
  | "split"
  | "join-wait"
  | "join-fire"
  | "boundary"
  | "decision-blocked";
```

Machine-readable transition kind.

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

Set on `join-fire`/`join-wait` from an approximate OR-join.

***

### Token

A token currently resting at a node, awaiting the next micro-step.

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

### SimulationState

A serializable snapshot of everything the overlay renders.

#### Properties

##### tokens

```ts
tokens: Token[];
```

##### joinArrivals

```ts
joinArrivals: Record<string, string[]>;
```

Sync-join arrivals: join node id → set of incoming edge ids delivered.

##### traversedEdges

```ts
traversedEdges: string[];
```

Edges traversed so far this session (green stroke; also feeds coverage).

##### visitedNodes

```ts
visitedNodes: string[];
```

Nodes a token has rested on this session.

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

True when the frontier is stuck with tokens but no legal move (deadlock).

##### pendingChoice

```ts
pendingChoice: PendingChoice | null;
```

##### boundaryOptions

```ts
boundaryOptions: BoundaryOption[];
```

##### errorThrowOptions

```ts
errorThrowOptions: ErrorThrowOption[];
```

"Throw error" cards per host with a resting token (E-6, §3e).

##### pendingDecisionInput

```ts
pendingDecisionInput: PendingDecisionInput | null;
```

A businessRuleTask waiting for decision inputs (SF-2), if any.

##### blockedDecision

```ts
blockedDecision: BlockedDecision | null;
```

Token stopped on a declared non-simulable decision (§5), if any.

***

### SimulationOptions

Options for constructing an engine.

#### Properties

##### scope?

```ts
optional scope?: string;
```

Scope to simulate: `undefined` (default) is the top process level. A
sub-process id restricts the graph to that scope. Sub-process token
descent is not modeled in v1 (see limitations.md).

##### decisions?

```ts
optional decisions?: DecisionEvaluator;
```

HOST-injected decision-table support for businessRuleTask (SF-2).

## Type Aliases

### GatewayKind

```ts
type GatewayKind = "exclusive" | "parallel" | "inclusive" | "eventBased";
```

The control-flow role a node plays in the token semantics. Derived once from
the BPMN node type and its fan-in/fan-out when the graph is built.

***

### Decision

```ts
type Decision = 
  | {
  kind: "exclusive" | "eventBased";
  gateway: string;
  edge: string;
}
  | {
  kind: "inclusive";
  gateway: string;
  edges: string[];
}
  | {
  kind: "boundary";
  host: string;
  boundary: string;
}
  | {
  kind: "decision";
  node: string;
  context: Record<string, number | string | boolean>;
}
  | {
  kind: "error";
  host: string;
  errorRef?: string;
}
  | {
  kind: "signal";
  ref: string;
}
  | {
  kind: "message";
  ref: string;
};
```

A decision applied to the engine; the ordered list of these IS a scenario.

## Variables

### MAX\_PATHS

```ts
const MAX_PATHS: 1000 = 1000;
```

Safety cap: inclusive/boundary branching can blow up combinatorially.

## Functions

### isFlowNode()

```ts
function isFlowNode(node): boolean;
```

#### Parameters

##### node

`BpmnNode`

#### Returns

`boolean`

***

### flowScopeOf()

```ts
function flowScopeOf(diagram, node): string | undefined;
```

Scope a node's flow runs in: a boundary event works in its host's scope.

#### Parameters

##### diagram

`BpmnDiagram`

##### node

`BpmnNode`

#### Returns

`string` \| `undefined`

***

### enumerateStructuralPaths()

```ts
function enumerateStructuralPaths(graph): CoveragePath[];
```

Enumerates the distinct structural paths through a simulation graph — the
checklist the coverage panel shows. This is the **same graph the soundness
analysis reasons over** (Handoff 7 §7.2): each XOR / event-based / inclusive
branch and each boundary event is a fork; a parallel branch is followed like
any other edge (a single session that fans out covers every branch it runs).
Cycles are cut the first time an edge repeats, so enumeration always
terminates.

Inclusive splits are enumerated one branch at a time (not the power set) —
an intentional approximation kept in step with the approximate OR semantics
and documented in `docs/limitations.md`.

#### Parameters

##### graph

[`SimGraph`](#simgraph)

#### Returns

[`CoveragePath`](#coveragepath)[]

***

### gatewayKindOf()

```ts
function gatewayKindOf(type): GatewayKind | undefined;
```

Resolves the gateway control-flow role for a node type (undefined if none).

#### Parameters

##### type

`string`

#### Returns

[`GatewayKind`](#gatewaykind) \| `undefined`

***

### buildSimGraph()

```ts
function buildSimGraph(diagram, scope?): SimGraph;
```

Builds the simulation graph for one scope of a diagram (the top process level
by default). Closed elements are excluded; boundary events are recorded
against their host instead of wired as sequence flow — the engine moves the
token onto them when the boundary is fired, matching BPMN attachment
semantics.

#### Parameters

##### diagram

`BpmnDiagram`

##### scope?

`string` \| `undefined`

#### Returns

[`SimGraph`](#simgraph)

***

### canonicalizeScenario()

```ts
function canonicalizeScenario(scenario): string;
```

Canonical JSON for a scenario: keys in a fixed order and decisions in a
stable shape, so the same run always serializes byte-for-byte the same. This
is what gets stored as a versioned scenario artifact and hashed for the
"roteiro #hash" evidence in the SACM report (Handoff 7A §3.5).

#### Parameters

##### scenario

[`Scenario`](#scenario-1)

#### Returns

`string`

***

### hashScenario()

```ts
function hashScenario(scenario): Promise<string>;
```

Short, stable content hash of a scenario (first 12 hex chars of SHA-256).

#### Parameters

##### scenario

[`Scenario`](#scenario-1)

#### Returns

`Promise`\<`string`\>

***

### buildSession()

```ts
function buildSession(
   scenario, 
   coverage, 
meta): Promise<SimulationSession>;
```

Builds a [SimulationSession](#simulationsession) from a scenario and the coverage summary
at the moment of registration. `author`/`timestamp` come from the host so the
package stays deterministic and clock-free.

#### Parameters

##### scenario

[`Scenario`](#scenario-1)

##### coverage

[`CoverageSummary`](#coveragesummary)

##### meta

###### author

`string`

###### timestamp

`string`

#### Returns

`Promise`\<[`SimulationSession`](#simulationsession)\>

***

### canonicalizeSession()

```ts
function canonicalizeSession(session): string;
```

Canonical JSON for a session (stable key order) — for hashing / storage.

#### Parameters

##### session

[`SimulationSession`](#simulationsession)

#### Returns

`string`

***

### coveragePercent()

```ts
function coveragePercent(coverage): number;
```

Coverage as a percentage 0–100 (0 when there are no structural paths).

#### Parameters

##### coverage

[`SessionCoverage`](#sessioncoverage)

#### Returns

`number`
