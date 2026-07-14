# soundness/src

## Interfaces

### FlowEdge

The sequence-flow graph the soundness rules run on. Built once per
validation (Handoff 4 §C1) and analyzed per SCOPE: the top process level
and each sub-process form their own subgraph, so every rule traverses the
F7 hierarchy without special cases.

Structural analysis only — adjacency, reachability, SCCs. Never state
space (§3 do handoff).

#### Properties

##### edgeId

```ts
edgeId: string;
```

##### source

```ts
source: string;
```

##### target

```ts
target: string;
```

##### implicit?

```ts
optional implicit?: boolean;
```

True for the synthetic host → boundary-event edge (not a real flow).

***

### ScopeGraph

#### Properties

##### scope

```ts
scope: string | undefined;
```

Sub-process id, or `undefined` for the top process level.

##### nodes

```ts
nodes: Map<string, BpmnNode>;
```

Flow nodes in this scope, by id.

##### out

```ts
out: Map<string, FlowEdge[]>;
```

##### in

```ts
in: Map<string, FlowEdge[]>;
```

##### starts

```ts
starts: string[];
```

Start events of this scope.

##### ends

```ts
ends: string[];
```

Nodes that terminate this scope: its end events, or — BPMN allows an
implicit end — the sink nodes (no outgoing flow) when it has none.

***

### SoundnessRuleDefinition

#### Properties

##### code

```ts
code: 
  | "SND_DEADLOCK_JOIN"
  | "SND_UNMATCHED_SPLIT"
  | "SND_NO_PATH_TO_END"
  | "SND_INFINITE_LOOP"
  | "SND_DEAD_BRANCH"
  | "SND_BOUNDARY_NO_OUTFLOW"
  | "SND_EVENT_GW_TARGETS"
  | "SND_LANE_NO_ACTOR"
  | "SND_IMPLICIT_MERGE";
```

##### defaultSeverity

```ts
defaultSeverity: IssueSeverity;
```

##### title

```ts
title: Record<SoundnessLocale, string>;
```

One-line description of what the rule detects, per locale.

***

### SoundnessOptions

#### Properties

##### severityOverrides?

```ts
optional severityOverrides?: Partial<Record<
  | "SND_DEADLOCK_JOIN"
  | "SND_UNMATCHED_SPLIT"
  | "SND_NO_PATH_TO_END"
  | "SND_INFINITE_LOOP"
  | "SND_DEAD_BRANCH"
  | "SND_BOUNDARY_NO_OUTFLOW"
  | "SND_EVENT_GW_TARGETS"
  | "SND_LANE_NO_ACTOR"
| "SND_IMPLICIT_MERGE", IssueSeverity>>;
```

Per-code severity adjustments (companies tune without forking).

##### disabled?

```ts
optional disabled?: (
  | "SND_DEADLOCK_JOIN"
  | "SND_UNMATCHED_SPLIT"
  | "SND_NO_PATH_TO_END"
  | "SND_INFINITE_LOOP"
  | "SND_DEAD_BRANCH"
  | "SND_BOUNDARY_NO_OUTFLOW"
  | "SND_EVENT_GW_TARGETS"
  | "SND_LANE_NO_ACTOR"
  | "SND_IMPLICIT_MERGE")[];
```

Codes to skip entirely.

##### locale?

```ts
optional locale?: SoundnessLocale;
```

Message language. Default 'en'.

## Type Aliases

### SoundnessCode

```ts
type SoundnessCode = typeof SOUNDNESS_CODES[number];
```

***

### SoundnessLocale

```ts
type SoundnessLocale = "en" | "pt";
```

## Variables

### SOUNDNESS\_CODES

```ts
const SOUNDNESS_CODES: readonly ["SND_DEADLOCK_JOIN", "SND_UNMATCHED_SPLIT", "SND_NO_PATH_TO_END", "SND_INFINITE_LOOP", "SND_DEAD_BRANCH", "SND_BOUNDARY_NO_OUTFLOW", "SND_EVENT_GW_TARGETS", "SND_LANE_NO_ACTOR", "SND_IMPLICIT_MERGE"];
```

Stable rule codes (Handoff 4 §C1) — never renumber or reuse.

***

### SOUNDNESS\_RULES

```ts
const SOUNDNESS_RULES: SoundnessRuleDefinition[];
```

## Functions

### isFlowEdge()

```ts
function isFlowEdge(edge): boolean;
```

#### Parameters

##### edge

`BpmnEdge`

#### Returns

`boolean`

***

### buildScopeGraphs()

```ts
function buildScopeGraphs(diagram): ScopeGraph[];
```

Builds the per-scope flow graphs for a diagram. Closed (removed) elements
are excluded — soundness describes the process as it will run. Boundary
events get a synthetic incoming edge from their host so reachability sees
them (control arrives via the attachment, not a sequence flow).

#### Parameters

##### diagram

`BpmnDiagram`

#### Returns

[`ScopeGraph`](#scopegraph)[]

***

### reachableFrom()

```ts
function reachableFrom(graph, seeds): Set<string>;
```

Forward reachability from a seed set (BFS, O(V+E)).

#### Parameters

##### graph

[`ScopeGraph`](#scopegraph)

##### seeds

`Iterable`\<`string`\>

#### Returns

`Set`\<`string`\>

***

### coReachableTo()

```ts
function coReachableTo(graph, seeds): Set<string>;
```

Backward reachability towards a seed set (BFS over incoming edges).

#### Parameters

##### graph

[`ScopeGraph`](#scopegraph)

##### seeds

`Iterable`\<`string`\>

#### Returns

`Set`\<`string`\>

***

### cyclicComponents()

```ts
function cyclicComponents(graph): string[][];
```

Strongly connected components (Tarjan, iterative — no recursion so deep
chains can't overflow the stack). Returns only the components that form a
real cycle: two or more nodes, or a single node with a self-loop.

#### Parameters

##### graph

[`ScopeGraph`](#scopegraph)

#### Returns

`string`[][]

***

### soundnessPromotionRule()

```ts
function soundnessPromotionRule(options?): PromotionRule;
```

Promotion gate (Handoff 4 §C2): soundness ERRORS block promotion to
`active` through the existing LifecycleEngine mechanism — drop it into
`lifecycleConfig.promotionRules` and `evaluateGates`/`promote` enforce it
like any other gate. Warnings and info never block (§3 do handoff).

```ts
new LifecycleEngine({ promotionRules: [soundnessPromotionRule()] })
```

#### Parameters

##### options?

[`SoundnessOptions`](#soundnessoptions) = `{}`

#### Returns

`PromotionRule`

***

### analyzeSoundness()

```ts
function analyzeSoundness(diagram, options?): ValidationIssue[];
```

Runs the full soundness analysis: one graph build, every enabled rule,
O(V+E) each — never state-space search (§3). Standalone entry point;
`soundnessRules()` wraps the same analysis for the plugin system.

#### Parameters

##### diagram

`BpmnDiagram`

##### options?

[`SoundnessOptions`](#soundnessoptions) = `{}`

#### Returns

`ValidationIssue`[]

***

### soundnessRules()

```ts
function soundnessRules(options?): ValidationRule[];
```

The soundness analysis in the plugin `validationRules` format — drop it
into a `BpmnPlugin` (react) or a `ValidationEngine` (CLI/headless) and the
existing integration paths pick it up with no new code:

```ts
const plugin = { id: 'soundness', validationRules: soundnessRules() };
```

Returned as a single composite rule so the (per-validation) graph build
runs once, not nine times.

#### Parameters

##### options?

[`SoundnessOptions`](#soundnessoptions) = `{}`

#### Returns

`ValidationRule`[]

## References

### isFlowNode

Re-exports [isFlowNode](../simulation/src.md#isflownode)

***

### flowScopeOf

Re-exports [flowScopeOf](../simulation/src.md#flowscopeof)
