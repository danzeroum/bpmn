# react/src/agent

## Interfaces

### AgentSimulationRecord

A finished agent-simulation session handed to the host for the ledger (§7).

#### Properties

##### workflowRef

```ts
workflowRef: string;
```

##### steps

```ts
steps: number;
```

##### complete

```ts
complete: boolean;
```

##### blocked?

```ts
optional blocked?: object;
```

###### nodeId

```ts
nodeId: string;
```

###### reason

```ts
reason: string;
```

##### author

```ts
author: string;
```

##### timestamp

```ts
timestamp: string;
```

***

### AgentStudioProps

`@buildtovalue/react/agent` — opt-in subpath for the Agent Studio UI (see
./simulation.ts for the rationale).

#### Properties

##### open

```ts
open: boolean;
```

Whether the modal is open (registers on the Esc dismissal stack).

##### workflow

```ts
workflow: AgentWorkflow;
```

The sub-workflow being edited (source of truth: the Library).

##### workflowRef?

```ts
optional workflowRef?: string;
```

Versioned ref shown in the header, e.g. `agnt-rsch@2.1.0`.

##### lifecycleStatus?

```ts
optional lifecycleStatus?: string;
```

Lifecycle seal text (already localized by the host), e.g. `CANDIDATA`.

##### openedFrom?

```ts
optional openedFrom?: string;
```

The BPMN node label the Studio was opened from.

##### onSave

```ts
onSave: (workflow) => void;
```

Persist the edited sub-workflow to the Library (never the XML — §1.1).

###### Parameters

###### workflow

`AgentWorkflow`

###### Returns

`void`

##### onClose

```ts
onClose: () => void;
```

Close the modal (Esc routes here before any Designer dismissal).

###### Returns

`void`

##### agentTaskId?

```ts
optional agentTaskId?: string;
```

The macro agentTask node id — enables the error-boundary proposal (§5).

##### simulationFixtures?

```ts
optional simulationFixtures?: Fixtures;
```

Per-node mock fixtures for the simulation (§7); default empty → the
decision blocks honestly on absent structured output.

##### onRecordSimulation?

```ts
optional onRecordSimulation?: (record) => void;
```

Record a finished simulation session to the ledger (§7). Button hidden
when absent. `author`/`timestamp` come from the host (clock-free).

###### Parameters

###### record

[`AgentSimulationRecord`](#agentsimulationrecord)

###### Returns

`void`

##### author?

```ts
optional author?: string;
```

##### timestamp?

```ts
optional timestamp?: string;
```

##### toolProvider?

```ts
optional toolProvider?: ToolProvider;
```

Squad Lane SL-2 — resolves `tool:*@semver` bindings to their contracts and
(optionally) lists the bindable catalog for the inspector selector. Absent
→ the tool binding degrades to a typed text field; the graph still
validates, just without contract-aware checks (cerca §1.7/§2.4).

***

### EditEffect

One editor action's effect, for N-3 event emission from the modal.

#### Properties

##### event

```ts
event: "element.added" | "element.changed" | "element.removed";
```

##### kind

```ts
kind: "node" | "edge";
```

##### id?

```ts
optional id?: string;
```

##### elementType?

```ts
optional elementType?: string;
```

***

### EditResult

#### Properties

##### workflow

```ts
workflow: AgentWorkflow;
```

##### effect

```ts
effect: EditEffect;
```

***

### AgentEditorState

#### Properties

##### past

```ts
past: AgentWorkflow[];
```

##### present

```ts
present: AgentWorkflow;
```

##### future

```ts
future: AgentWorkflow[];
```

##### lastEffect

```ts
lastEffect: EditEffect | null;
```

The last effect, so the view can emit the matching N-3 event.

##### historyOp

```ts
historyOp: "reset" | "apply" | "undo" | "redo" | null;
```

Bumped on undo/redo so the view can emit command.undone, etc.

***

### NodeLayout

#### Properties

##### id

```ts
id: string;
```

##### x

```ts
x: number;
```

##### y

```ts
y: number;
```

##### width

```ts
width: number;
```

##### height

```ts
height: number;
```

***

### ToolProvider

Squad Lane SL-2 (Handoff 22) — the host-injected tool provider. It IMPLEMENTS
the headless `ResolveTool` seam defined in `@buildtovalue/agentflow` (types
flow down react → agentflow) and adds an optional `list()` that powers the
inspector's selector/autocomplete. Injected as a prop on `AgentStudio`
(the `AIProvider`/H9 mold): absent → the binding degrades to a typed text
field, present-but-unresolvable → a declared `TOOL_UNRESOLVED` warning, never
silence (cerca §2.4).

#### Properties

##### resolve

```ts
resolve: ResolveTool;
```

Resolve a `tool:*@semver` ref to its contract (or `undefined`).

#### Methods

##### list()?

```ts
optional list(): readonly ToolContract[];
```

The bindable catalog, for the inspector selector. Omit → free-text only.

###### Returns

readonly `ToolContract`[]

## Type Aliases

### AgentEditorAction

```ts
type AgentEditorAction = 
  | {
  type: "apply";
  result: EditResult;
}
  | {
  type: "undo";
}
  | {
  type: "redo";
}
  | {
  type: "reset";
  workflow: AgentWorkflow;
};
```

## Functions

### AgentStudio()

```ts
function AgentStudio(props): Element | null;
```

Agent Studio (Handoff 12 A-4) — the modal sub-workflow editor over the
Designer. Its edit history is an ISOLATED stack (undo here never touches the
BPMN diagram behind it); every edit emits the matching N-3 catalog event
from inside the modal (never a silent hole in the bus); every string is
localized; Esc closes the modal via the single dismissal stack before any
Designer dismissal.

#### Parameters

##### props

[`AgentStudioProps`](#agentstudioprops)

#### Returns

`Element` \| `null`

***

### proposeErrorBoundaryCommand()

```ts
function proposeErrorBoundaryCommand(diagram, hostId): Command | null;
```

Agent Lane (Handoff 12 §5) — the ONE undoable command that PROPOSES an error
boundary event on the macro agentTask when the sub-workflow carries an
errorBoundary decorator. It reuses N-1's parametric boundary anchoring
(`attachBoundaryCommand` + `boundaryNodePosition`): a boundary event node is
created and attached to the host in a single composite, so one undo removes
the whole proposal. Returns `null` when the host node is absent (nothing to
anchor to) — the Studio then simply doesn't offer the proposal.

The command is NEVER dispatched silently: the Studio shows an accept/refuse
card and only executes this on accept.

#### Parameters

##### diagram

`BpmnDiagram`

##### hostId

`string`

#### Returns

`Command` \| `null`

***

### nextNodeId()

```ts
function nextNodeId(workflow, type): string;
```

Deterministic node id: `<type>-<n>` where n avoids collisions.

#### Parameters

##### workflow

`AgentWorkflow`

##### type

`NodeType`

#### Returns

`string`

***

### addNode()

```ts
function addNode(workflow, type): EditResult;
```

Adds a node of `type` with default config.

#### Parameters

##### workflow

`AgentWorkflow`

##### type

`NodeType`

#### Returns

[`EditResult`](#editresult)

***

### updateNodeConfig()

```ts
function updateNodeConfig(
   workflow, 
   id, 
   patch): EditResult;
```

Replaces a node's config (shallow merge into the existing config).

#### Parameters

##### workflow

`AgentWorkflow`

##### id

`string`

##### patch

`Record`\<`string`, `unknown`\>

#### Returns

[`EditResult`](#editresult)

***

### removeNode()

```ts
function removeNode(workflow, id): EditResult;
```

Removes a node and every edge touching it.

#### Parameters

##### workflow

`AgentWorkflow`

##### id

`string`

#### Returns

[`EditResult`](#editresult)

***

### addEdge()

```ts
function addEdge(
   workflow, 
   from, 
   to, 
   edgeType): EditResult;
```

Adds an edge (skips exact duplicates).

#### Parameters

##### workflow

`AgentWorkflow`

##### from

`string`

##### to

`string`

##### edgeType

`EdgeType`

#### Returns

[`EditResult`](#editresult)

***

### toggleDecorator()

```ts
function toggleDecorator(
   workflow, 
   id, 
   type): EditResult;
```

Toggles a decorator on a node (adds a default of that type, or removes it).

#### Parameters

##### workflow

`AgentWorkflow`

##### id

`string`

##### type

`DecoratorType`

#### Returns

[`EditResult`](#editresult)

***

### agentEditorReducer()

```ts
function agentEditorReducer(state, action): AgentEditorState;
```

Reducer for the isolated history — the modal's own command/undo stack.

#### Parameters

##### state

[`AgentEditorState`](#agenteditorstate)

##### action

[`AgentEditorAction`](#agenteditoraction)

#### Returns

[`AgentEditorState`](#agenteditorstate)

***

### initEditorState()

```ts
function initEditorState(workflow): AgentEditorState;
```

#### Parameters

##### workflow

`AgentWorkflow`

#### Returns

[`AgentEditorState`](#agenteditorstate)

***

### layoutWorkflow()

```ts
function layoutWorkflow(workflow): NodeLayout[];
```

A simple deterministic layered layout: entry-first BFS assigns columns,
siblings stack in rows. No coordinates live in the schema (§3 is a pure
graph), so the Studio derives them — same input → same layout.

#### Parameters

##### workflow

`AgentWorkflow`

#### Returns

[`NodeLayout`](#nodelayout)[]

***

### createToolProvider()

```ts
function createToolProvider(contracts): ToolProvider;
```

Builds a [ToolProvider](#toolprovider-1) over a contract list (exact `id@version` match).
The host wires the SAME list into the Biblioteca via `toolAdapter` so the
catalog and the binding never disagree (one registry, not two).

#### Parameters

##### contracts

readonly `ToolContract`[]

#### Returns

[`ToolProvider`](#toolprovider-1)
