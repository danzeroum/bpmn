# react/src

## Classes

### ShapeErrorBoundary

Editor resilience (Handoff 4 §D1): a shape that throws is replaced by an
error placeholder sized to the node bounds — the canvas, the sibling nodes
and the toolbar all survive. Because the model is immutable, any edit
produces a new `node` object, which resets the boundary and retries the
real shape automatically.

#### Extends

- `Component`\<[`ShapeErrorBoundaryProps`](#shapeerrorboundaryprops), `ShapeErrorBoundaryState`\>

#### Constructors

##### Constructor

```ts
new ShapeErrorBoundary(props): ShapeErrorBoundary;
```

###### Parameters

###### props

[`ShapeErrorBoundaryProps`](#shapeerrorboundaryprops)

###### Returns

[`ShapeErrorBoundary`](#shapeerrorboundary)

###### Inherited from

```ts
Component<ShapeErrorBoundaryProps, ShapeErrorBoundaryState>.constructor
```

##### Constructor

```ts
new ShapeErrorBoundary(props, context): ShapeErrorBoundary;
```

###### Parameters

###### props

[`ShapeErrorBoundaryProps`](#shapeerrorboundaryprops)

###### context

`any`

###### Returns

[`ShapeErrorBoundary`](#shapeerrorboundary)

###### Deprecated

###### See

[React Docs](https://legacy.reactjs.org/docs/legacy-context.html)

###### Inherited from

```ts
Component<ShapeErrorBoundaryProps, ShapeErrorBoundaryState>.constructor
```

#### Properties

##### state

```ts
state: ShapeErrorBoundaryState;
```

###### Overrides

```ts
Component.state
```

#### Methods

##### getDerivedStateFromError()

```ts
static getDerivedStateFromError(error): Partial<ShapeErrorBoundaryState>;
```

###### Parameters

###### error

`Error`

###### Returns

`Partial`\<`ShapeErrorBoundaryState`\>

##### componentDidCatch()

```ts
componentDidCatch(error): void;
```

Catches exceptions generated in descendant components. Unhandled exceptions will cause
the entire component tree to unmount.

###### Parameters

###### error

`Error`

###### Returns

`void`

###### Overrides

```ts
Component.componentDidCatch
```

##### componentDidUpdate()

```ts
componentDidUpdate(): void;
```

Called immediately after updating occurs. Not called for the initial render.

The snapshot is only present if getSnapshotBeforeUpdate is present and returns non-null.

###### Returns

`void`

###### Overrides

```ts
Component.componentDidUpdate
```

##### render()

```ts
render(): 
  | string
  | number
  | boolean
  | Element
  | Iterable<ReactNode, any, any>
  | null
  | undefined;
```

###### Returns

  \| `string`
  \| `number`
  \| `boolean`
  \| `Element`
  \| `Iterable`\<`ReactNode`, `any`, `any`\>
  \| `null`
  \| `undefined`

###### Overrides

```ts
Component.render
```

## Interfaces

### BpmnDesignerProps

#### Extended by

- [`BpmnEditorProps`](#bpmneditorprops)

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

Initial diagram. Subsequent edits flow through the command stack.

##### plugins?

```ts
optional plugins?: BpmnPlugin[];
```

##### onChange?

```ts
optional onChange?: (diagram) => void;
```

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`void`

##### readOnly?

```ts
optional readOnly?: boolean;
```

##### children?

```ts
optional children?: ReactNode;
```

Extra UI rendered inside the designer chrome (Palette, Toolbar,
PropertiesPanel, MiniMap are exported separately and can be composed
freely; `<BpmnEditor>` bundles the default arrangement).

##### overlay?

```ts
optional overlay?: ReactNode;
```

Extra SVG overlay content in world coordinates.

##### showClosed?

```ts
optional showClosed?: boolean;
```

Render closed (removedInVersion) elements. Default true.

##### messages?

```ts
optional messages?: Messages;
```

Injected UI dictionary (Handoff 11 N-6). Omitted → English. The host owns
locale choice: pass `PT_BR` (or a custom dictionary) to switch languages;
missing keys fall back to English. There is no automatic locale detection.

***

### BpmnEditorProps

#### Extends

- [`BpmnDesignerProps`](#bpmndesignerprops)

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

Initial diagram. Subsequent edits flow through the command stack.

###### Inherited from

[`BpmnDesignerProps`](#bpmndesignerprops).[`diagram`](#diagram)

##### plugins?

```ts
optional plugins?: BpmnPlugin[];
```

###### Inherited from

[`BpmnDesignerProps`](#bpmndesignerprops).[`plugins`](#plugins)

##### onChange?

```ts
optional onChange?: (diagram) => void;
```

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`void`

###### Inherited from

[`BpmnDesignerProps`](#bpmndesignerprops).[`onChange`](#onchange)

##### readOnly?

```ts
optional readOnly?: boolean;
```

###### Inherited from

[`BpmnDesignerProps`](#bpmndesignerprops).[`readOnly`](#readonly)

##### children?

```ts
optional children?: ReactNode;
```

Extra UI rendered inside the designer chrome (Palette, Toolbar,
PropertiesPanel, MiniMap are exported separately and can be composed
freely; `<BpmnEditor>` bundles the default arrangement).

###### Inherited from

[`BpmnDesignerProps`](#bpmndesignerprops).[`children`](#children)

##### overlay?

```ts
optional overlay?: ReactNode;
```

Extra SVG overlay content in world coordinates.

###### Inherited from

[`BpmnDesignerProps`](#bpmndesignerprops).[`overlay`](#overlay)

##### showClosed?

```ts
optional showClosed?: boolean;
```

Render closed (removedInVersion) elements. Default true.

###### Inherited from

[`BpmnDesignerProps`](#bpmndesignerprops).[`showClosed`](#showclosed)

##### messages?

```ts
optional messages?: Messages;
```

Injected UI dictionary (Handoff 11 N-6). Omitted → English. The host owns
locale choice: pass `PT_BR` (or a custom dictionary) to switch languages;
missing keys fall back to English. There is no automatic locale detection.

###### Inherited from

[`BpmnDesignerProps`](#bpmndesignerprops).[`messages`](#messages)

##### toolbarExtra?

```ts
optional toolbarExtra?: ReactNode;
```

Extra toolbar content.

##### hidePalette?

```ts
optional hidePalette?: boolean;
```

Hide individual chrome pieces.

##### hideInspector?

```ts
optional hideInspector?: boolean;
```

##### hideMiniMap?

```ts
optional hideMiniMap?: boolean;
```

***

### CanvasProps

#### Properties

##### overlay?

```ts
optional overlay?: ReactNode;
```

Extra SVG content rendered on the overlay layer (world coordinates).

##### showClosed?

```ts
optional showClosed?: boolean;
```

Show closed (removedInVersion) elements. Default true.

***

### EdgeRendererProps

#### Properties

##### edge

```ts
edge: BpmnEdge;
```

##### source

```ts
source: BpmnNode | undefined;
```

##### target

```ts
target: BpmnNode | undefined;
```

##### selected

```ts
selected: boolean;
```

##### hovered?

```ts
optional hovered?: boolean;
```

Route handles + manual badge show on hover as well as selection (R-3).

##### liveWaypoints?

```ts
optional liveWaypoints?: Point[] | null;
```

Live route while its own waypoint/segment is being dragged (R-3).

##### readOnly?

```ts
optional readOnly?: boolean;
```

##### interactions?

```ts
optional interactions?: object;
```

###### onNodePointerDown

```ts
onNodePointerDown: (event, nodeId) => void;
```

Node body pointerdown → select + begin (potential) drag.

###### Parameters

###### event

`PointerEvent`

###### nodeId

`string`

###### Returns

`void`

###### onPortPointerDown

```ts
onPortPointerDown: (event, nodeId) => void;
```

Port pointerdown → begin a connection gesture.

###### Parameters

###### event

`PointerEvent`

###### nodeId

`string`

###### Returns

`void`

###### onNodeDoubleClick

```ts
onNodeDoubleClick: (event, nodeId) => void;
```

Node double-click. One navigation gesture for the whole family (Handoff
5 §7.6): on an EXPANDED sub-process' title strip it drills down; on the
body (and every other node) it begins inline label editing — rename
stays discoverable via body double-click and the inspector's Label field.

###### Parameters

###### event

###### stopPropagation

() => `void`

###### clientX?

`number`

###### clientY?

`number`

###### nodeId

`string`

###### Returns

`void`

###### onResizePointerDown

```ts
onResizePointerDown: (event, nodeId, corner) => void;
```

Resize-handle pointerdown → begin a resize gesture.

###### Parameters

###### event

`PointerEvent`

###### nodeId

`string`

###### corner

[`ResizeCorner`](#resizecorner)

###### Returns

`void`

###### onEdgeHandlePointerDown

```ts
onEdgeHandlePointerDown: (event, edgeId, index, base) => void;
```

Route-handle pointerdown → begin dragging an existing waypoint (R-3).

###### Parameters

###### event

`PointerEvent`

###### edgeId

`string`

###### index

`number`

###### base

`Point`[]

###### Returns

`void`

###### onEdgeSegmentPointerDown

```ts
onEdgeSegmentPointerDown: (event, edgeId, segIndex, base) => void;
```

Segment pointerdown → insert a bend at the pointer and drag it (R-3). The
gesture only authors a manual route once the drag threshold is crossed.

###### Parameters

###### event

`PointerEvent`

###### edgeId

`string`

###### segIndex

`number`

###### base

`Point`[]

###### Returns

`void`

###### onEdgeWaypointDoubleClick

```ts
onEdgeWaypointDoubleClick: (event, edgeId, index, base) => void;
```

Double-click an interior waypoint → remove it (stays manual, undoable).

###### Parameters

###### event

###### stopPropagation

() => `void`

###### edgeId

`string`

###### index

`number`

###### base

`Point`[]

###### Returns

`void`

###### onCanvasPointerDown

```ts
onCanvasPointerDown: (event) => void;
```

Empty-canvas pointerdown → pan (middle button / space) or lasso (left).

###### Parameters

###### event

`PointerEvent`

###### Returns

`void`

###### onPointerMove

```ts
onPointerMove: (event) => void;
```

###### Parameters

###### event

`PointerEvent`

###### Returns

`void`

###### onPointerUp

```ts
onPointerUp: (event) => void;
```

###### Parameters

###### event

`PointerEvent`

###### Returns

`void`

###### cancelGestures

```ts
cancelGestures: () => void;
```

###### Returns

`void`

###### setPanKey

```ts
setPanKey: (held) => void;
```

###### Parameters

###### held

`boolean`

###### Returns

`void`

###### onNodeContextMenu

```ts
onNodeContextMenu: (event, nodeId) => void;
```

###### Parameters

###### event

`PointerEvent`\<`Element`\> \| `MouseEvent`\<`Element`, `MouseEvent`\>

###### nodeId

`string`

###### Returns

`void`

###### onEdgeContextMenu

```ts
onEdgeContextMenu: (event, edgeId) => void;
```

###### Parameters

###### event

`PointerEvent`\<`Element`\> \| `MouseEvent`\<`Element`, `MouseEvent`\>

###### edgeId

`string`

###### Returns

`void`

###### onCanvasContextMenu

```ts
onCanvasContextMenu: (event) => void;
```

###### Parameters

###### event

`PointerEvent`\<`Element`\> \| `MouseEvent`\<`Element`, `MouseEvent`\>

###### Returns

`void`

###### openContextMenuForSelection

```ts
openContextMenuForSelection: () => void;
```

N-5 keyboard (Menu / Shift+F10): opens for the first selected element.

###### Returns

`void`

###### armLongPress

```ts
armLongPress: (event, kind, targetId) => void;
```

###### Parameters

###### event

`PointerEvent`

###### kind

`"node"` \| `"edge"`

###### targetId

`string`

###### Returns

`void`

###### cancelLongPress

```ts
cancelLongPress: () => void;
```

###### Returns

`void`

###### centerOfNode

```ts
centerOfNode: (nodeId) => Point;
```

###### Parameters

###### nodeId

`string`

###### Returns

`Point`

##### sourceOffset

```ts
sourceOffset: object;
```

Drag offsets applied to endpoints while their node is being dragged.

###### dx

```ts
dx: number;
```

###### dy

```ts
dy: number;
```

##### targetOffset

```ts
targetOffset: object;
```

###### dx

```ts
dx: number;
```

###### dy

```ts
dy: number;
```

##### onSelect

```ts
onSelect: (edgeId, additive) => void;
```

###### Parameters

###### edgeId

`string`

###### additive

`boolean`

###### Returns

`void`

##### onHoverChange?

```ts
optional onHoverChange?: (edgeId, hovered) => void;
```

###### Parameters

###### edgeId

`string`

###### hovered

`boolean`

###### Returns

`void`

##### focused?

```ts
optional focused?: boolean;
```

Roving keyboard focus target (tabIndex 0 vs -1).

##### onFocus?

```ts
optional onFocus?: () => void;
```

###### Returns

`void`

***

### NodeRendererProps

#### Properties

##### node

```ts
node: BpmnNode;
```

##### selected

```ts
selected: boolean;
```

##### editable

```ts
editable: boolean;
```

##### interactions

```ts
interactions: object;
```

###### onNodePointerDown

```ts
onNodePointerDown: (event, nodeId) => void;
```

Node body pointerdown → select + begin (potential) drag.

###### Parameters

###### event

`PointerEvent`

###### nodeId

`string`

###### Returns

`void`

###### onPortPointerDown

```ts
onPortPointerDown: (event, nodeId) => void;
```

Port pointerdown → begin a connection gesture.

###### Parameters

###### event

`PointerEvent`

###### nodeId

`string`

###### Returns

`void`

###### onNodeDoubleClick

```ts
onNodeDoubleClick: (event, nodeId) => void;
```

Node double-click. One navigation gesture for the whole family (Handoff
5 §7.6): on an EXPANDED sub-process' title strip it drills down; on the
body (and every other node) it begins inline label editing — rename
stays discoverable via body double-click and the inspector's Label field.

###### Parameters

###### event

###### stopPropagation

() => `void`

###### clientX?

`number`

###### clientY?

`number`

###### nodeId

`string`

###### Returns

`void`

###### onResizePointerDown

```ts
onResizePointerDown: (event, nodeId, corner) => void;
```

Resize-handle pointerdown → begin a resize gesture.

###### Parameters

###### event

`PointerEvent`

###### nodeId

`string`

###### corner

[`ResizeCorner`](#resizecorner)

###### Returns

`void`

###### onEdgeHandlePointerDown

```ts
onEdgeHandlePointerDown: (event, edgeId, index, base) => void;
```

Route-handle pointerdown → begin dragging an existing waypoint (R-3).

###### Parameters

###### event

`PointerEvent`

###### edgeId

`string`

###### index

`number`

###### base

`Point`[]

###### Returns

`void`

###### onEdgeSegmentPointerDown

```ts
onEdgeSegmentPointerDown: (event, edgeId, segIndex, base) => void;
```

Segment pointerdown → insert a bend at the pointer and drag it (R-3). The
gesture only authors a manual route once the drag threshold is crossed.

###### Parameters

###### event

`PointerEvent`

###### edgeId

`string`

###### segIndex

`number`

###### base

`Point`[]

###### Returns

`void`

###### onEdgeWaypointDoubleClick

```ts
onEdgeWaypointDoubleClick: (event, edgeId, index, base) => void;
```

Double-click an interior waypoint → remove it (stays manual, undoable).

###### Parameters

###### event

###### stopPropagation

() => `void`

###### edgeId

`string`

###### index

`number`

###### base

`Point`[]

###### Returns

`void`

###### onCanvasPointerDown

```ts
onCanvasPointerDown: (event) => void;
```

Empty-canvas pointerdown → pan (middle button / space) or lasso (left).

###### Parameters

###### event

`PointerEvent`

###### Returns

`void`

###### onPointerMove

```ts
onPointerMove: (event) => void;
```

###### Parameters

###### event

`PointerEvent`

###### Returns

`void`

###### onPointerUp

```ts
onPointerUp: (event) => void;
```

###### Parameters

###### event

`PointerEvent`

###### Returns

`void`

###### cancelGestures

```ts
cancelGestures: () => void;
```

###### Returns

`void`

###### setPanKey

```ts
setPanKey: (held) => void;
```

###### Parameters

###### held

`boolean`

###### Returns

`void`

###### onNodeContextMenu

```ts
onNodeContextMenu: (event, nodeId) => void;
```

###### Parameters

###### event

`PointerEvent`\<`Element`\> \| `MouseEvent`\<`Element`, `MouseEvent`\>

###### nodeId

`string`

###### Returns

`void`

###### onEdgeContextMenu

```ts
onEdgeContextMenu: (event, edgeId) => void;
```

###### Parameters

###### event

`PointerEvent`\<`Element`\> \| `MouseEvent`\<`Element`, `MouseEvent`\>

###### edgeId

`string`

###### Returns

`void`

###### onCanvasContextMenu

```ts
onCanvasContextMenu: (event) => void;
```

###### Parameters

###### event

`PointerEvent`\<`Element`\> \| `MouseEvent`\<`Element`, `MouseEvent`\>

###### Returns

`void`

###### openContextMenuForSelection

```ts
openContextMenuForSelection: () => void;
```

N-5 keyboard (Menu / Shift+F10): opens for the first selected element.

###### Returns

`void`

###### armLongPress

```ts
armLongPress: (event, kind, targetId) => void;
```

###### Parameters

###### event

`PointerEvent`

###### kind

`"node"` \| `"edge"`

###### targetId

`string`

###### Returns

`void`

###### cancelLongPress

```ts
cancelLongPress: () => void;
```

###### Returns

`void`

###### centerOfNode

```ts
centerOfNode: (nodeId) => Point;
```

###### Parameters

###### nodeId

`string`

###### Returns

`Point`

##### dx

```ts
dx: number;
```

Visual drag offset applied while the gesture is in progress.

##### dy

```ts
dy: number;
```

##### connectHover

```ts
connectHover: "valid" | "invalid" | null;
```

##### resizeRect

```ts
resizeRect: 
  | {
  x: number;
  y: number;
  width: number;
  height: number;
}
  | null;
```

Live rect override while a resize gesture is in progress.

##### editing

```ts
editing: boolean;
```

True when this node's label is being edited inline.

##### focused?

```ts
optional focused?: boolean;
```

Roving keyboard focus target (tabIndex 0 vs -1).

***

### ShapeErrorBoundaryProps

#### Properties

##### node

```ts
node: BpmnNode;
```

##### onError

```ts
onError: (meta) => void;
```

Observability sink — receives `shape.render.error`.

###### Parameters

###### meta

###### nodeId

`string`

###### nodeType

`string`

###### message

`string`

###### Returns

`void`

##### children

```ts
children: ReactNode;
```

***

### LayoutMove

One node the layout wants to move — feeds the preview ghosts and the fade.

#### Properties

##### id

```ts
id: string;
```

##### from

```ts
from: Point;
```

##### to

```ts
to: Point;
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

### LayoutProposal

The pending auto-layout, waiting for Aplicar/Recusar (Handoff 14 §1e).

#### Properties

##### command

```ts
command: Command;
```

ONE undoable composite: node moves + rigid 📍 translations.

##### moved

```ts
moved: LayoutMove[];
```

##### reroutedCount

```ts
reroutedCount: number;
```

Auto-routed edges touching moved nodes — they re-route on apply.

##### manualCount

```ts
manualCount: number;
```

Manual 📍 routes rigidly translated (PRESERVED, never re-routed).

##### baseDiagram

```ts
baseDiagram: BpmnDiagram;
```

The diagram the proposal was computed against — a stale proposal
(diagram changed while the card was open) must be discarded.

***

### EdgeReroute

One rerouted edge produced by a host-node move (Handoff 10 R-2b).

#### Properties

##### edgeId

```ts
edgeId: string;
```

##### waypoints

```ts
waypoints: Point[];
```

Fresh A* waypoints, cached back onto the edge inside the move command.

##### routed

```ts
routed: boolean;
```

`false` = no corridor found (fallback state).

##### previewPath

```ts
previewPath: string;
```

Default-router path at the final positions — the fading crossfade layer.

***

### AutoRoute

A fresh auto route produced by the batch router (Handoff 10 R-4).

#### Properties

##### edgeId

```ts
edgeId: string;
```

##### waypoints

```ts
waypoints: Point[];
```

##### routed

```ts
routed: boolean;
```

***

### ClearRoutingResult

Counts a "Limpar roteamento" run reports in its toast (§1.4).

#### Properties

##### commands

```ts
commands: Command[];
```

##### reoptimized

```ts
reoptimized: number;
```

Auto edges re-optimized.

##### preserved

```ts
preserved: number;
```

Manual routes left untouched (0 when `includeManual`).

***

### ManualTranslation

One manual edge translated by a host-node move (Handoff 10 R-3).

#### Properties

##### edgeId

```ts
edgeId: string;
```

##### waypoints

```ts
waypoints: Point[];
```

##### collides

```ts
collides: boolean;
```

The translated route now crosses a shape — flag ⚠, never re-route.

***

### GlobalCommandContext

Global (toolbar-level) commands of the registry (Handoff 15 §2f): the
actions that need no element target — undo/redo, viewport, arrange
proposal, exports, find. Presence rules mirror the Toolbar's own guards
(disabled undo → absent here; unarrangeable diagram → absent), which is the
palette's `when()` for built-ins. Labels reuse the cmdk.* dictionary keys,
`shortcut` is display notation only — dispatch stays in
`useKeyboardShortcuts` (its catalog is the cheatsheet's other half).

#### Extends

- [`MenuBuildContext`](#menubuildcontext)

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### undo

```ts
undo: () => void;
```

###### Returns

`void`

##### redo

```ts
redo: () => void;
```

###### Returns

`void`

##### canUndo

```ts
canUndo: boolean;
```

##### canRedo

```ts
canRedo: boolean;
```

##### announceVeto?

```ts
optional announceVeto?: (reason) => void;
```

🔒 channel for declined inserts (Handoff 18 §5b reforço 7). Optional:
contexts that only ENUMERATE commands (the cheatsheet) never insert, so
they may omit it; the ⌘K runner falls back to a no-op when absent.

###### Parameters

###### reason

`string`

###### Returns

`void`

##### execute

```ts
execute: (command) => RuleVerdict;
```

###### Parameters

###### command

`Command`

###### Returns

`RuleVerdict`

###### Inherited from

[`MenuBuildContext`](#menubuildcontext).[`execute`](#execute-1)

##### store

```ts
store: CanvasStore;
```

###### Inherited from

[`MenuBuildContext`](#menubuildcontext).[`store`](#store-1)

##### config

```ts
config: EditorConfig;
```

###### Inherited from

[`MenuBuildContext`](#menubuildcontext).[`config`](#config-1)

##### t

```ts
t: TFunction;
```

###### Inherited from

[`MenuBuildContext`](#menubuildcontext).[`t`](#t-1)

***

### RegisteredGlobalCommand

One executable entry of the registry (menu row / palette row).

#### Extends

- [`RegisteredMenuItem`](#registeredmenuitem)

#### Properties

##### shortcut?

```ts
optional shortcut?: string;
```

Display shortcut (notation), when the command also has a key binding.

##### id

```ts
id: string;
```

###### Inherited from

[`RegisteredMenuItem`](#registeredmenuitem).[`id`](#id-2)

##### label

```ts
label: string;
```

###### Inherited from

[`RegisteredMenuItem`](#registeredmenuitem).[`label`](#label-1)

##### section?

```ts
optional section?: string;
```

Section kicker (plugin id) — undefined for built-ins.

###### Inherited from

[`RegisteredMenuItem`](#registeredmenuitem).[`section`](#section-1)

##### run

```ts
run: () => void;
```

###### Returns

`void`

###### Inherited from

[`RegisteredMenuItem`](#registeredmenuitem).[`run`](#run-1)

***

### MenuBuildContext

THE command registry of the editor surfaces (Handoff 15 §2f, V-0 decisão 4):
the ContextMenu's conditional built-ins extracted VERBATIM into a pure
builder — proven identical by tests/menuRegistryEquivalence.test.tsx, which
was frozen BEFORE this extraction (N-7 discipline). The ContextMenu, the
Ctrl/Cmd+K command palette and the "?" cheatsheet all consume THIS source —
no surface defines its own items, so they can never drift apart.

Rules carried over unchanged:
- Every action dispatches COMMANDS through `execute` — never a direct
  diagram mutation.
- `when()` of plugin items is evaluated against the REAL target context.

#### Extended by

- [`GlobalCommandContext`](#globalcommandcontext)

#### Properties

##### execute

```ts
execute: (command) => RuleVerdict;
```

###### Parameters

###### command

`Command`

###### Returns

`RuleVerdict`

##### store

```ts
store: CanvasStore;
```

##### config

```ts
config: EditorConfig;
```

##### t

```ts
t: TFunction;
```

***

### RegisteredMenuItem

One executable entry of the registry (menu row / palette row).

#### Extended by

- [`RegisteredGlobalCommand`](#registeredglobalcommand)

#### Properties

##### id

```ts
id: string;
```

##### label

```ts
label: string;
```

##### section?

```ts
optional section?: string;
```

Section kicker (plugin id) — undefined for built-ins.

##### run

```ts
run: () => void;
```

###### Returns

`void`

***

### DiagramContextValue

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### stack

```ts
stack: CommandStack;
```

##### execute

```ts
execute: (command) => RuleVerdict;
```

###### Parameters

###### command

`Command`

###### Returns

`RuleVerdict`

##### undo

```ts
undo: () => void;
```

###### Returns

`void`

##### redo

```ts
redo: () => void;
```

###### Returns

`void`

##### canUndo

```ts
canUndo: boolean;
```

##### canRedo

```ts
canRedo: boolean;
```

##### lastVeto

```ts
lastVeto: string | null;
```

Reason of the most recent vetoed command (cleared on next success).

##### announceVeto

```ts
announceVeto: (reason) => void;
```

Declared GESTURE veto channel (Handoff 17 ES-3): surfaces a veto that
happened OUTSIDE the command stack (a rejected connect drop, a Tab on the
event-subprocess shell) on the SAME 🔒 surface as `lastVeto`, with the
same lifecycle — replaced by the next veto, cleared by the next
successful command. Never a silent gesture, never an unbounded channel.

###### Parameters

###### reason

`string`

###### Returns

`void`

##### replaceDiagram

```ts
replaceDiagram: (diagram) => void;
```

Replaces the whole diagram (import) and clears history.

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`void`

***

### DiagramProviderProps

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### ruleEngine?

```ts
optional ruleEngine?: RuleEngine;
```

##### edgeRouter?

```ts
optional edgeRouter?: EdgeRouterFn;
```

The editor's default router (Handoff 10 R-2b). When present, A* routes for
`astar` edges without waypoints are DERIVED — not committed — into the
initial diagram (and on every `replaceDiagram`), so cached waypoints exist
before the first render without an undo entry or ledger record. Omitted →
no derivation (non-astar editors pay nothing).

##### onChange?

```ts
optional onChange?: (diagram) => void;
```

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`void`

##### emitEditorEvent?

```ts
optional emitEditorEvent?: EmitEditorEvent;
```

N-3: the editor's typed event channel. When present, the provider emits
`diagram.loaded`, `command.executed|undone` and the `element.*` family;
omitted → no emissions (the channel stays an injected callback).

##### children

```ts
children: ReactNode;
```

***

### EditorConfig

#### Properties

##### registry

```ts
registry: NodeTypeRegistry;
```

##### shapes

```ts
shapes: Record<string, ShapeComponent>;
```

##### paletteItems

```ts
paletteItems: PaletteItem[];
```

##### paletteGroups

```ts
paletteGroups: PaletteGroup[];
```

Palette section headers, in display order; merged across plugins.

##### edgeStyles

```ts
edgeStyles: Record<string, EdgeStyle>;
```

Domain edge styles keyed by `edge.type`, merged across plugins.

##### inspectorSections

```ts
inspectorSections: InspectorSection[];
```

Plugin inspector sections, in registration order.

##### ruleEngine

```ts
ruleEngine: RuleEngine;
```

##### validationEngine

```ts
validationEngine: ValidationEngine;
```

##### lifecycleEngine

```ts
lifecycleEngine: LifecycleEngine;
```

##### edgeRouter

```ts
edgeRouter: EdgeRouterFn;
```

##### plugins

```ts
plugins: BpmnPlugin[];
```

##### preferredTypes

```ts
preferredTypes: string[];
```

Custom types (from plugins) preferred when importing XML.

##### emitEditorEvent

```ts
emitEditorEvent: <T>(type, meta?) => void;
```

Emits a catalog event (Handoff 11 N-3 — see EDITOR_EVENTS and the semver
stability contract) to every plugin `onEditorEvent` handler (no-op when
none is registered). The timestamp is stamped here so all handlers see
the same event object. Deprecated aliases fan out automatically with a
single console warning per session.

###### Type Parameters

###### T

`T` *extends* 
  \| `"command.undone"`
  \| `"review.changes.requested"`
  \| `"command.executed"`
  \| `"import.warning"`
  \| `"diagram.loaded"`
  \| `"element.added"`
  \| `"element.changed"`
  \| `"element.removed"`
  \| `"edge.connected"`
  \| `"selection.changed"`
  \| `"validation.changed"`
  \| `"promotion.completed"`
  \| `"render.slow"`
  \| `"shape.render.error"`
  \| `"review.thread.opened"`
  \| `"review.thread.resolved"`

###### Parameters

###### type

`T`

###### meta?

[`EditorEventPayloads`](#editoreventpayloads)\[`T`\]

###### Returns

`void`

##### autosave

```ts
autosave: boolean;
```

Autosave + recovery banner + beforeunload guard toggle. Default true.

##### engine

```ts
engine: EngineBridge | null;
```

Execution-engine bridge (Handoff 14 §1f); null → no "Execução" tab.

##### eventDefinitionResolver

```ts
eventDefinitionResolver: EventDefinitionResolver | null;
```

Governed event-definition resolver (Handoff 16 §3b); null → declared degradation.

***

### ShortcutCatalogEntry

The declared shortcut catalog (Handoff 15 §2f) — the "?" cheatsheet renders
FROM this table, and the anti-drift sweep test (cheatsheet.test) asserts
every key literal the handler below matches appears in some entry's
`matches`. Add a branch → add (or extend) an entry, or the test fails.

#### Properties

##### id

```ts
id: string;
```

##### keys

```ts
keys: string;
```

Display combo, e.g. 'Ctrl/⌘+Z'. Key names are notation, not prose.

##### labelKey

```ts
labelKey: string;
```

i18n key (shortcuts.*) of the description.

##### matches

```ts
matches: readonly string[];
```

Raw `event.key` literals the handler matches (sweep-test contract).

***

### ShapeProps

#### Properties

##### node

```ts
node: BpmnNode;
```

##### selected

```ts
selected: boolean;
```

***

### InspectorSection

A plugin-contributed inspector section (Handoff 5 wireframe 2d): rendered
inside the PropertiesPanel under the built-in fields whenever the selected
node matches `appliesTo` — e.g. the DMN "Decisão" section on
businessRuleTask.

#### Properties

##### id

```ts
id: string;
```

##### appliesTo

```ts
appliesTo: (node) => boolean;
```

###### Parameters

###### node

`BpmnNode`

###### Returns

`boolean`

##### component

```ts
component: ComponentType<{
  node: BpmnNode;
}>;
```

***

### PaletteBuildContext

What a composite palette item's [PaletteItem.build](#build) factory receives:
the CURRENT diagram, the node-type registry and the insertion position the
host computed (viewport center + snap/jitter). `t` resolves i18n defaults
(e.g. the E-2 default definition names).

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### registry

```ts
registry: NodeTypeRegistry;
```

##### x

```ts
x: number;
```

##### y

```ts
y: number;
```

##### t

```ts
t: (key, params?) => string;
```

###### Parameters

###### key

`string`

###### params?

`Record`\<`string`, `string` \| `number`\>

###### Returns

`string`

***

### PaletteItem

#### Properties

##### id

```ts
id: string;
```

##### label

```ts
label: string;
```

##### nodeType

```ts
nodeType: string;
```

##### icon?

```ts
optional icon?: ReactNode;
```

Small SVG/emoji/text icon rendered in the palette button.

##### defaultProperties?

```ts
optional defaultProperties?: Record<string, unknown>;
```

##### group?

```ts
optional group?: string;
```

Id of the `PaletteGroup` this item renders under. Ungrouped items are
appended after all groups, preserving pre-group behavior.

##### build?

```ts
optional build?: (ctx) => PaletteInsertResult;
```

COMPOSITE factory (Handoff 17 ES-2, documented public surface): when
present, inserting this item executes the returned command (usually a
`compositeCommand` — one undo) instead of a plain addNode, and selects
`selectId` afterwards. The palette click AND the ⌘K entry resolve through
this ONE factory (`paletteInsertCommand`) — never two code paths. A build
may DECLINE the insert (Handoff 18 §5b reforço 7: a boundary dropped away
from a host) by returning `{ veto }` — the caller announces it on the 🔒
channel instead of creating an orphan node.

###### Parameters

###### ctx

[`PaletteBuildContext`](#palettebuildcontext)

###### Returns

[`PaletteInsertResult`](#paletteinsertresult)

***

### PaletteGroup

Palette section header. Groups render in registration order (built-ins
first, then plugins); a plugin re-registering an existing id replaces it
in place. Colors should be `var(--x, #hex)` like everywhere else.

#### Properties

##### id

```ts
id: string;
```

##### label

```ts
label: string;
```

##### badge?

```ts
optional badge?: string;
```

Small pill after the label (e.g. a feature tag like 'F6').

##### headerColor?

```ts
optional headerColor?: string;
```

Header text color override (defaults to the muted text color).

##### itemBackground?

```ts
optional itemBackground?: string;
```

Resting background of the group's items.

##### itemHoverBackground?

```ts
optional itemHoverBackground?: string;
```

Hover background of the group's items.

***

### EdgeRouterContext

Optional routing context (Handoff 10 R-2a). Obstacle-avoiding routers (the
built-in `astar`) read the other node bounds and already-routed edges from
here; the cheap built-ins (`bezier`/`orthogonal`/`straight`) ignore it. The
parameter is optional, so a pre-existing two-argument `(source, target)`
router keeps working unchanged.

#### Properties

##### obstacles

```ts
obstacles: Rect[];
```

Node bounds to route around (excludes the two endpoints).

##### routedEdges

```ts
routedEdges: Point[][];
```

Waypoints of already-routed edges, for the crossing cost.

***

### EditorEventPayloads

Typed payloads, one per catalog event. Hosts narrow `event.meta` by
`event.type`; the emit side is typed against this map.

#### Properties

##### diagram.loaded

```ts
diagram.loaded: object;
```

A diagram entered the editor (mount or `replaceDiagram`/import).

###### diagramId

```ts
diagramId: string;
```

###### name

```ts
name: string;
```

###### nodes

```ts
nodes: number;
```

###### edges

```ts
edges: number;
```

##### element.added

```ts
element.added: object;
```

A node/edge was added by a command.

###### id?

```ts
optional id?: string;
```

###### elementType?

```ts
optional elementType?: string;
```

###### kind

```ts
kind: "node" | "edge";
```

##### element.changed

```ts
element.changed: object;
```

A node/edge changed (update/move/resize/attach…); composites report coarse.

###### id?

```ts
optional id?: string;
```

###### elementType?

```ts
optional elementType?: string;
```

###### composite?

```ts
optional composite?: boolean;
```

###### description?

```ts
optional description?: string;
```

##### element.removed

```ts
element.removed: object;
```

A node/edge was removed by a command.

###### id?

```ts
optional id?: string;
```

###### elementType?

```ts
optional elementType?: string;
```

###### kind

```ts
kind: "node" | "edge";
```

##### edge.connected

```ts
edge.connected: object;
```

The connect gesture created an edge.

###### edgeType

```ts
edgeType: string;
```

###### sourceId

```ts
sourceId: string;
```

###### targetId

```ts
targetId: string;
```

##### selection.changed

```ts
selection.changed: object;
```

The canvas selection changed.

###### selectedIds

```ts
selectedIds: string[];
```

##### command.executed

```ts
command.executed: object;
```

A command was applied (redo re-emits it — a redo re-executes).

###### commandId

```ts
commandId: string;
```

###### description

```ts
description: string;
```

###### auditType?

```ts
optional auditType?: string;
```

##### command.undone

```ts
command.undone: object;
```

The last command was undone.

###### description?

```ts
optional description?: string;
```

##### validation.changed

```ts
validation.changed: object;
```

A Validate pass produced a (possibly different) issue set.

###### errors

```ts
errors: number;
```

###### warnings

```ts
warnings: number;
```

###### codes

```ts
codes: string[];
```

##### promotion.completed

```ts
promotion.completed: object;
```

The formal promotion flow activated a version.

###### semanticVersion

```ts
semanticVersion: string;
```

###### status

```ts
status: string;
```

###### ledgerHash?

```ts
optional ledgerHash?: string;
```

##### import.warning

```ts
import.warning: object;
```

The HOST's XML import produced a warning (hosts emit this one).

###### message

```ts
message: string;
```

##### render.slow

```ts
render.slow: object;
```

A frame took longer than the render budget.

###### frameMs

```ts
frameMs: number;
```

##### shape.render.error

```ts
shape.render.error: object;
```

A shape component threw during render (error boundary caught it).

###### nodeId

```ts
nodeId: string;
```

###### nodeType

```ts
nodeType: string;
```

###### message

```ts
message: string;
```

##### review.thread.opened

```ts
review.thread.opened: object;
```

A review thread was opened on an element (Handoff 15 §2c).

###### threadId

```ts
threadId: string;
```

###### elementId

```ts
elementId: string;
```

##### review.thread.resolved

```ts
review.thread.resolved: object;
```

A review thread was resolved (Handoff 15 §2c).

###### threadId

```ts
threadId: string;
```

##### review.changes.requested

```ts
review.changes.requested: object;
```

A signed "request changes" was issued (Handoff 15 §2e — emitted by V-6).

###### versionId

```ts
versionId: string;
```

###### threadRefs

```ts
threadRefs: string[];
```

***

### MenuTarget

Context-menu invocation target (Handoff 11 N-5): what was right-clicked /
long-pressed / keyboard-opened, with enough context for `when()` guards.

#### Properties

##### kind

```ts
kind: "node" | "edge" | "canvas";
```

##### id?

```ts
optional id?: string;
```

The node/edge id (absent for the empty canvas).

##### point

```ts
point: object;
```

World coordinates of the invocation point.

###### x

```ts
x: number;
```

###### y

```ts
y: number;
```

##### diagram

```ts
diagram: BpmnDiagram;
```

##### selectedIds

```ts
selectedIds: string[];
```

***

### ContextMenuItem

One pluggable context-menu item (Handoff 11 N-5). The contract is
deliberately narrow: `run` receives ONLY a command dispatcher — actions go
through commands (undoable, audited); there is no direct state access.

#### Extended by

- [`ContextPadItem`](#contextpaditem)

#### Properties

##### id

```ts
id: string;
```

##### label

```ts
label: string;
```

##### when?

```ts
optional when?: (target) => boolean;
```

Guard: the item only renders when it returns true (omitted → always).

###### Parameters

###### target

[`MenuTarget`](#menutarget)

###### Returns

`boolean`

##### run

```ts
run: (target, api) => void;
```

Dispatches commands through `execute` — the menu never mutates state.

###### Parameters

###### target

[`MenuTarget`](#menutarget)

###### api

###### execute

(`command`) => `unknown`

###### Returns

`void`

***

### ContextPadItem

One pluggable context-pad action (Handoff 14 §1a) — the pad's 5th slot.
Same narrow contract as [ContextMenuItem](#contextmenuitem), plus a single-character
glyph rendered inside the pad button (an emoji or symbol; the full label
stays in the tooltip/aria).

#### Extends

- [`ContextMenuItem`](#contextmenuitem)

#### Properties

##### id

```ts
id: string;
```

###### Inherited from

[`ContextMenuItem`](#contextmenuitem).[`id`](#id-8)

##### label

```ts
label: string;
```

###### Inherited from

[`ContextMenuItem`](#contextmenuitem).[`label`](#label-4)

##### when?

```ts
optional when?: (target) => boolean;
```

Guard: the item only renders when it returns true (omitted → always).

###### Parameters

###### target

[`MenuTarget`](#menutarget)

###### Returns

`boolean`

###### Inherited from

[`ContextMenuItem`](#contextmenuitem).[`when`](#when)

##### run

```ts
run: (target, api) => void;
```

Dispatches commands through `execute` — the menu never mutates state.

###### Parameters

###### target

[`MenuTarget`](#menutarget)

###### api

###### execute

(`command`) => `unknown`

###### Returns

`void`

###### Inherited from

[`ContextMenuItem`](#contextmenuitem).[`run`](#run-2)

##### glyph

```ts
glyph: string;
```

One character/emoji drawn in the 26px button (e.g. '🤖').

***

### EditorEvent

Editor observability event (Handoff 2 §2, catalog completed in Handoff 11
N-3). `type` is one of [EDITOR\_EVENTS](#editor_events) — or a deprecated alias from
[DEPRECATED\_EVENT\_ALIASES](#deprecated_event_aliases) during its grace minor. The host decides
what to do with it (log, measure lead time, count import warnings). No
telemetry, no deps.

#### Properties

##### type

```ts
type: string;
```

##### ts

```ts
ts: number;
```

Epoch milliseconds.

##### meta?

```ts
optional meta?: Record<string, unknown>;
```

***

### EdgeStyle

Declarative styling for a domain edge type (keyed by `edge.type`). The
EdgeRenderer applies it in the resting state and composes it with the two
states that always win: `closed` (retired) and `selected`. Colors should be
`var(--btv-*, #hex)` so dark mode and export stay correct.

#### Properties

##### stroke

```ts
stroke: string;
```

Line color.

##### strokeWidth?

```ts
optional strokeWidth?: number;
```

Resting line width (selected still renders at 2.5). Default 1.5.

##### dash?

```ts
optional dash?: string;
```

SVG dash array, e.g. '5,4'. Solid when omitted.

##### marker?

```ts
optional marker?: "none" | "filled" | "open" | "double-chevron" | "disc";
```

Arrowhead at the target end. Default 'filled'. 'disc' is the DMN
authority-requirement tip (filled circle r 3.5).

##### routing?

```ts
optional routing?: "straight";
```

Routing override for this edge type: 'straight' draws a border-anchored
line (DMN DRD requirement edges). Default: the editor's router.

##### midDecoration?

```ts
optional midDecoration?: "purpose-chip" | "check-disc";
```

Optional decoration drawn at the edge midpoint.

***

### BpmnPlugin

Declarative extension unit. Everything is optional — a plugin can add a
single validation rule or a whole domain vocabulary (node types + shapes +
palette + rules + XML mapping preferences).

#### Properties

##### id

```ts
id: string;
```

##### name?

```ts
optional name?: string;
```

##### colorWheelDegree?

```ts
optional colorWheelDegree?: number;
```

The 40°-step of the 9-hue BTV wheel this domain/notation family claims
(Handoff 5 §7.3-7.4, e.g. DMN = 185, Healthcare = 305; free: 65, 105).
Two registered plugins on the same step trigger a build warning in
`resolveEditorConfig`.

##### bodyColor?

```ts
optional bodyColor?: string;
```

Declared body color of the domain (a `var(--…, #hex)` expression). The
plugin lint rejects gold and green as body colors — they are reserved
for governance/value and approval/selection (§10.3).

##### nodeTypes?

```ts
optional nodeTypes?: NodeTypeDefinition[];
```

Domain node types registered into the editor's NodeTypeRegistry.

##### shapes?

```ts
optional shapes?: Record<string, ShapeComponent>;
```

Shape components keyed by node type.

##### paletteItems?

```ts
optional paletteItems?: PaletteItem[];
```

Extra palette entries.

##### inspectorSections?

```ts
optional inspectorSections?: InspectorSection[];
```

Inspector sections rendered for matching selected nodes.

##### paletteGroups?

```ts
optional paletteGroups?: PaletteGroup[];
```

Palette section headers for this plugin's items.

##### edgeStyles?

```ts
optional edgeStyles?: Record<string, EdgeStyle>;
```

Visual styles for domain edge types, keyed by `edge.type`.

##### validationRules?

```ts
optional validationRules?: ValidationRule[];
```

Domain validation rules appended to the ValidationEngine.

##### registerRules?

```ts
optional registerRules?: (engine) => void;
```

Hook to register governance rules (`*.pre` hooks) on the RuleEngine.

###### Parameters

###### engine

`RuleEngine`

###### Returns

`void`

##### lifecycleConfig?

```ts
optional lifecycleConfig?: LifecycleConfig;
```

Lifecycle configuration override (first plugin providing one wins).

##### edgeRouter?

```ts
optional edgeRouter?: 
  | "straight"
  | "astar"
  | "bezier"
  | "orthogonal"
  | EdgeRouterFn;
```

Edge routing override: built-in name or custom function. `astar` is the
obstacle-avoiding router (Handoff 10); `straight` is the plain direct line.

##### onBeforeSave?

```ts
optional onBeforeSave?: (diagram) => BpmnDiagram;
```

Transforms the diagram before it is exported/saved.

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`BpmnDiagram`

##### onAfterLoad?

```ts
optional onAfterLoad?: (diagram) => BpmnDiagram;
```

Transforms the diagram right after an import/load.

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`BpmnDiagram`

##### onEditorEvent?

```ts
optional onEditorEvent?: EditorEventHandler;
```

Observability sink — receives editor events (all providers are called).

##### contextMenuItems?

```ts
optional contextMenuItems?: (target) => ContextMenuItem[];
```

Pluggable context-menu items (Handoff 11 N-5): called with the invocation
target; returned items render in the plugin's own section (kicker = the
plugin id), after each item's `when()` guard. Actions dispatch commands
only — the menu never mutates state directly.

###### Parameters

###### target

[`MenuTarget`](#menutarget)

###### Returns

[`ContextMenuItem`](#contextmenuitem)[]

##### contextPadItems?

```ts
optional contextPadItems?: (target) => ContextPadItem[];
```

Context-pad slot (Handoff 14 §1a): the FIRST returned item (after `when`
filtering) takes the pad's 5th button; the rest are reachable via ⋯,
which opens the full context menu.

###### Parameters

###### target

[`MenuTarget`](#menutarget)

###### Returns

[`ContextPadItem`](#contextpaditem)[]

##### autosave?

```ts
optional autosave?: boolean;
```

Editor resilience opt-out: `false` disables autosave, the recovery
banner and the beforeunload guard. Default true; last plugin wins.

##### engine?

```ts
optional engine?: EngineBridge;
```

Execution-engine bridge (Handoff 14 §1f): registering one turns on the
"Execução" tab of the properties panel for executable activities. First
plugin providing one wins (same rule as `lifecycleConfig`). Actual
deployment stays HOST-owned and GATED — see [EngineBridge](#enginebridge).

##### eventDefinitionResolver?

```ts
optional eventDefinitionResolver?: EventDefinitionResolver;
```

Governed event-definition resolution (Handoff 16 §3b): registering one
turns on the "Da Biblioteca" section of the event picker and the
vigência chip/seal on the canvas. First plugin providing one wins. The
editor NEVER consults a registry — resolution is host-owned; without a
resolver the degradation is declared (binding renders as text + notice).

***

### EventDefinitionCatalogEntry

One catalog entry the picker's Biblioteca section lists.

#### Extended by

- [`ResolvedEventDefinition`](#resolvedeventdefinition)

#### Properties

##### name

```ts
name: string;
```

Artifact name — the `nome` half of `nome@semver`.

##### semanticVersion

```ts
semanticVersion: string;
```

##### status

```ts
status: string;
```

Lifecycle status of that version ('active' = VIGENTE seal).

***

### ResolvedEventDefinition

A governed ref resolved to its definition payload.

#### Extends

- [`EventDefinitionCatalogEntry`](#eventdefinitioncatalogentry)

#### Properties

##### name

```ts
name: string;
```

Artifact name — the `nome` half of `nome@semver`.

###### Inherited from

[`EventDefinitionCatalogEntry`](#eventdefinitioncatalogentry).[`name`](#name-1)

##### semanticVersion

```ts
semanticVersion: string;
```

###### Inherited from

[`EventDefinitionCatalogEntry`](#eventdefinitioncatalogentry).[`semanticVersion`](#semanticversion)

##### status

```ts
status: string;
```

Lifecycle status of that version ('active' = VIGENTE seal).

###### Inherited from

[`EventDefinitionCatalogEntry`](#eventdefinitioncatalogentry).[`status`](#status)

##### definition

```ts
definition: object;
```

###### name

```ts
name: string;
```

###### errorCode?

```ts
optional errorCode?: string;
```

###### escalationCode?

```ts
optional escalationCode?: string;
```

***

### EventDefinitionResolver

Host-injected resolver of governed event-definition refs (§3b — the
resolveCallActivities/EngineBridge mold): SYNCHRONOUS, the host preloads.
`ref` is the canonical `nome@semver` string. The BINDING PINS the exact
version: a newer artifact version never moves an existing binding — only
an explicit ref change does (audited by the host's ledger glue).

#### Methods

##### list()

```ts
list(kind): EventDefinitionCatalogEntry[];
```

Entries offered in the picker's "Da Biblioteca" section, per kind.

###### Parameters

###### kind

`"error"` \| `"message"` \| `"signal"` \| `"escalation"`

###### Returns

[`EventDefinitionCatalogEntry`](#eventdefinitioncatalogentry)[]

##### resolve()

```ts
resolve(ref, kind): ResolvedEventDefinition | undefined;
```

Resolve a pinned `nome@semver` ref; undefined → SIG_REF_MISSING.

###### Parameters

###### ref

`string`

###### kind

`"error"` \| `"message"` \| `"signal"` \| `"escalation"`

###### Returns

[`ResolvedEventDefinition`](#resolvedeventdefinition) \| `undefined`

***

### EngineBridge

Execution-engine bridge (Handoff 14 §1f). The editor renders the
"Execução" tab (progressive disclosure: essentials visible, the rest
foldable) and GATES deploy: only an ACTIVE (VIGENTE) **and signed** version
may deploy; anything else gets the "⚑ Deploy bloqueado → Ir para promoção"
card. The signature truth and the deploy transport are host-owned —
network integration is deliberately out of editor scope (§3).

#### Properties

##### id

```ts
id: string;
```

Engine id, e.g. 'zeebe', 'camunda7'. Prefixes default property keys.

##### name?

```ts
optional name?: string;
```

Display name in the tab header, e.g. 'Camunda 8 (Zeebe)'.

##### jobTypeKey?

```ts
optional jobTypeKey?: string;
```

Property key of the ESSENTIAL job-type binding. Default `<id>:taskDefinitionType`.

##### retriesKey?

```ts
optional retriesKey?: string;
```

Property key of the retries field. Default `<id>:retries`.

##### payloadKey?

```ts
optional payloadKey?: string;
```

Event I/O keys (Handoff 16 E-4, §3c) — the engine names WHERE the props
live; WHICH events carry them is OMG semantics (`eventExecutionModeOf`).
Payload mappings (throw events only). Default `<id>:payload`.

##### errorCodeVariableKey?

```ts
optional errorCodeVariableKey?: string;
```

Error-code capture variable (error catches only). Default `<id>:errorCodeVariable`.

##### errorMessageVariableKey?

```ts
optional errorMessageVariableKey?: string;
```

Error-message capture variable (error catches only). Default `<id>:errorMessageVariable`.

##### isSigned?

```ts
optional isSigned?: (diagram) => boolean;
```

Host-owned truth: is the CURRENT version's activation signed (identity
package / host ledger)? Gates deploy together with `status === 'active'`.
Absent → treated as NOT signed (deploy stays blocked).

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`boolean`

##### deploy?

```ts
optional deploy?: (diagram) => void | Promise<void>;
```

Deploy transport — only invoked when the gate passes.

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`void` \| `Promise`\<`void`\>

##### onRequestPromotion?

```ts
optional onRequestPromotion?: () => void;
```

"Ir para promoção →" navigation on the blocked card (host-owned).

###### Returns

`void`

***

### ReplayVersion

A version the log can be filtered to, with its bound-run count (bindRun).

#### Properties

##### versionId

```ts
versionId: string;
```

##### semanticVersion

```ts
semanticVersion: string;
```

##### status?

```ts
optional status?: string;
```

e.g. 'candidate' — shown as "candidata" instead of a run count.

##### runCount

```ts
runCount: number;
```

Executions bound to this version (bindRun) — "N execuções".

##### traces

```ts
traces: Trace[];
```

The traces of the runs bound to this version.

***

### BpmnReplayProps

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### traces?

```ts
optional traces?: Trace[];
```

Flat traces (7B-2 mode). Ignored when `versions` is provided.

##### versions?

```ts
optional versions?: ReplayVersion[];
```

Versions with bound runs for the header selector (Handoff 7B-3).

##### candidate?

```ts
optional candidate?: object;
```

The candidate whose promotion the comparison argues for.

###### semanticVersion

```ts
semanticVersion: string;
```

###### change

```ts
change: string;
```

##### onAttachAnalysis?

```ts
optional onAttachAnalysis?: (analysis) => void;
```

Attach the comparative analysis to the candidate's promotion request.

###### Parameters

###### analysis

`ReplayAnalysis`

###### Returns

`void`

##### author?

```ts
optional author?: string;
```

Author recorded on the attached analysis.

##### fileName?

```ts
optional fileName?: string;
```

##### plugins?

```ts
optional plugins?: BpmnPlugin[];
```

##### onExit?

```ts
optional onExit?: () => void;
```

###### Returns

`void`

##### now?

```ts
optional now?: () => string;
```

ISO clock for the attached analysis (injectable for tests).

###### Returns

`string`

***

### ReplayOverlaySvgProps

#### Properties

##### log

```ts
log: AggregatedLog;
```

##### selectedDeviation

```ts
selectedDeviation: number | null;
```

##### onSelectDeviation

```ts
onSelectDeviation: (index) => void;
```

###### Parameters

###### index

`number`

###### Returns

`void`

##### variantTokenNodeId

```ts
variantTokenNodeId: string | null;
```

***

### ReplayComparison

#### Properties

##### headline

```ts
headline: string;
```

##### candidateSemanticVersion

```ts
candidateSemanticVersion: string;
```

##### attached

```ts
attached: boolean;
```

##### onAttach?

```ts
optional onAttach?: () => void;
```

Attaches the analysis to the candidate's promotion; absent → no button.

###### Returns

`void`

***

### ReplayPanelProps

#### Properties

##### fileName

```ts
fileName: string;
```

##### log

```ts
log: AggregatedLog;
```

##### nodeLabel

```ts
nodeLabel: (id) => string;
```

###### Parameters

###### id

`string`

###### Returns

`string`

##### selectedDeviation

```ts
selectedDeviation: number | null;
```

##### onSelectDeviation

```ts
onSelectDeviation: (index) => void;
```

###### Parameters

###### index

`number`

###### Returns

`void`

##### playingVariant

```ts
playingVariant: number | null;
```

##### onPlayVariant

```ts
onPlayVariant: (index) => void;
```

###### Parameters

###### index

`number`

###### Returns

`void`

##### onStopVariant

```ts
onStopVariant: () => void;
```

###### Returns

`void`

##### comparison?

```ts
optional comparison?: ReplayComparison;
```

Comparison card "antes de aprovar a vX" + attach action (Handoff 7B-3).

***

### UseReplayResult

#### Properties

##### graph

```ts
graph: ReplayGraph;
```

##### log

```ts
log: AggregatedLog;
```

##### selectedDeviation

```ts
selectedDeviation: number | null;
```

Index of the deviation highlighted on the canvas / panel, or null.

##### selectDeviation

```ts
selectDeviation: (index) => void;
```

###### Parameters

###### index

`number` \| `null`

###### Returns

`void`

##### playingVariant

```ts
playingVariant: number | null;
```

Index of the variant currently playing, or null.

##### variantTokenNodeId

```ts
variantTokenNodeId: string | null;
```

Node id the variant token currently sits on (null when idle).

##### playVariant

```ts
playVariant: (index) => void;
```

###### Parameters

###### index

`number`

###### Returns

`void`

##### stopVariant

```ts
stopVariant: () => void;
```

###### Returns

`void`

##### formatMs

```ts
formatMs: (ms) => string;
```

Node id → resolved variant node sequence (for the overlay).

###### Parameters

###### ms

`number`

###### Returns

`string`

***

### ReviewMessage

ReviewStore — the host-injected comment contract (Handoff 15 §2c, V-4).
Same mold as `AIProvider`/`AnchorAdapter`/`EngineBridge`: the editor NEVER
persists review data — threads live wherever the host decides (its ledger,
its backend), reachable only through this contract. Without an injected
store the review surface simply does not exist (declared degradation,
cerca §1.5). Nothing here ever touches the BPMN model — review stays out
of the XML by construction (cerca §1.2).

The contract is SYNCHRONOUS with a `subscribe` seam (registered decision):
`list()` must return a STABLE array identity until a mutation happens —
the UI reads it through `useSyncExternalStore`. Hosts with async backends
wrap this with an optimistic in-memory mirror (the reference
implementation below is exactly that mirror).

#### Properties

##### id

```ts
id: string;
```

##### author

```ts
author: string;
```

Author id — `ia.copilot@…` authors render the ✦ mixed-authorship seal.

##### text

```ts
text: string;
```

##### at

```ts
at: string;
```

ISO timestamp.

##### aiAssisted?

```ts
optional aiAssisted?: boolean;
```

AI-drafted then human-committed (C4 discipline) — also renders ✦.

***

### ReviewThread

#### Properties

##### id

```ts
id: string;
```

##### elementId

```ts
elementId: string;
```

The ANCHOR: element id, never x/y — pins follow moves/layout for free.

##### versionRef

```ts
versionRef: string;
```

The version under review this thread belongs to.

##### resolved

```ts
resolved: boolean;
```

##### messages

```ts
messages: ReviewMessage[];
```

##### dismissed?

```ts
optional dismissed?: object;
```

Dismissed WITHOUT resolving (Handoff 15 §2d): releases the approval gate
but is never silent — the justification is mandatory (min 10 chars) and
the host records its own ledger entry (`reviewThreadDismissedEntry`).

###### by

```ts
by: string;
```

###### justification

```ts
justification: string;
```

***

### ReviewStore

#### Methods

##### list()

```ts
list(): readonly ReviewThread[];
```

Stable snapshot of every thread (open, resolved AND orphaned).

###### Returns

readonly [`ReviewThread`](#reviewthread)[]

##### open()

```ts
open(elementId, message): ReviewThread;
```

Opens a thread anchored to an element; returns it.

###### Parameters

###### elementId

`string`

###### message

`Pick`\<[`ReviewMessage`](#reviewmessage), `"author"` \| `"text"` \| `"aiAssisted"`\>

###### Returns

[`ReviewThread`](#reviewthread)

##### reply()

```ts
reply(threadId, message): ReviewThread;
```

Appends a reply to a thread; returns the updated thread.

###### Parameters

###### threadId

`string`

###### message

`Pick`\<[`ReviewMessage`](#reviewmessage), `"author"` \| `"text"` \| `"aiAssisted"`\>

###### Returns

[`ReviewThread`](#reviewthread)

##### resolve()

```ts
resolve(threadId): ReviewThread;
```

Marks a thread resolved; returns the updated thread.

###### Parameters

###### threadId

`string`

###### Returns

[`ReviewThread`](#reviewthread)

##### dismiss()?

```ts
optional dismiss(
   threadId, 
   by, 
   justification): ReviewThread;
```

Dismisses WITHOUT resolving (gate release with audit trail, §2d).
Implementations MUST reject justifications shorter than
[MIN\_DISMISS\_JUSTIFICATION](#min_dismiss_justification). Optional — absent hides the action.

###### Parameters

###### threadId

`string`

###### by

`string`

###### justification

`string`

###### Returns

[`ReviewThread`](#reviewthread)

##### subscribe()?

```ts
optional subscribe(cb): () => void;
```

Change notification (external edits, other reviewers).

###### Parameters

###### cb

() => `void`

###### Returns

() => `void`

***

### BpmnSimulatorProps

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### plugins?

```ts
optional plugins?: BpmnPlugin[];
```

##### onExit?

```ts
optional onExit?: () => void;
```

Leaves simulation mode (the "Sair da simulação" control).

###### Returns

`void`

##### onRecord?

```ts
optional onRecord?: (session) => void | Promise<void>;
```

Register the session in the ledger (Handoff 7A-3). Receives the built
SimulationSession (roteiro + coverage + version + author/timestamp);
the host maps it to a ledger entry / SACM evidence / library artifact by
injection. Button hides when absent.

###### Parameters

###### session

`SimulationSession`

###### Returns

`void` \| `Promise`\<`void`\>

##### onEscalationThrown?

```ts
optional onEscalationThrown?: (info) => void | Promise<void>;
```

Fired when the user THROWS an escalation from the «Escalate» card (Handoff
18 §5e, path a — the engine stays pure). The host maps it to a ledger
append (`escalationRaisedEntry`): `ESCALATION_RAISED` means the escalation
ACTUALLY happened. Carries the host node, the chosen ref, and the PREDICTED
destination so the entry's `target` names where it landed. Same injection
pattern as [onRecord](#onrecord).

###### Parameters

###### info

###### host

`string`

###### escalationRef?

`string`

###### destination

`EscalationDestination`

###### Returns

`void` \| `Promise`\<`void`\>

##### onCompensationTriggered?

```ts
optional onCompensationTriggered?: (info) => void | Promise<void>;
```

Fired when the user COMPENSATES from the «Compensate» card (Handoff 19 §6e,
path a — the engine stays pure). Carries the EXECUTED plan (`compensated` in
reverse order + `uncompensated` declared) so the host appends
`compensationTriggeredEntry`. Fired ONLY when the compensation actually ran:
a blocked specific target (non-compensable) appends NOTHING (reforço 8).

###### Parameters

###### info

###### scope

`string`

###### compensated

`object`[]

###### uncompensated

`object`[]

###### Returns

`void` \| `Promise`\<`void`\>

##### author?

```ts
optional author?: string;
```

Author recorded on the session (defaults to "anônimo").

##### recordedInfo?

```ts
optional recordedInfo?: ReactNode;
```

Confirmation content after a successful registration. When omitted a
default confirmation (roteiro #hash + the SACM evidence line) is shown.

##### decisions?

```ts
optional decisions?: DecisionEvaluator;
```

HOST-injected decision-table support (Handoff 9 SF-2) — e.g.
`createSfeelDecisionSupport(diagram)` from `@buildtovalue/dmn`. Without it
businessRuleTask is an ordinary activity (declared degradation).

***

### GatewayChoiceCardProps

#### Properties

##### choice

```ts
choice: PendingChoice;
```

##### gatewayLabel

```ts
gatewayLabel: string;
```

##### onChoose

```ts
onChoose: (decision) => void;
```

###### Parameters

###### decision

`Decision`

###### Returns

`void`

***

### SimulationOverlaySvgProps

#### Properties

##### tokenNodeIds

```ts
tokenNodeIds: string[];
```

Node ids currently holding a resting token.

##### traversedEdges

```ts
traversedEdges: string[];
```

Edge ids exercised this session (green stroke).

##### travels

```ts
travels: TokenTravel[];
```

##### clearTravel

```ts
clearTravel: (key) => void;
```

###### Parameters

###### key

`number`

###### Returns

`void`

***

### SimulationPanelProps

#### Properties

##### sessionNumber

```ts
sessionNumber: number;
```

##### statusLine

```ts
statusLine: string;
```

##### canAdvance

```ts
canAdvance: boolean;
```

##### onAdvance

```ts
onAdvance: () => void;
```

###### Returns

`void`

##### onReset

```ts
onReset: () => void;
```

###### Returns

`void`

##### advanceLabel

```ts
advanceLabel: string;
```

##### boundaryOptions

```ts
boundaryOptions: BoundaryOption[];
```

##### onFireBoundary

```ts
onFireBoundary: (boundaryId) => void;
```

###### Parameters

###### boundaryId

`string`

###### Returns

`void`

##### errorThrowOptions?

```ts
optional errorThrowOptions?: ErrorThrowOption[];
```

"Throw error" cards (E-6 §3e) — user picks the ERROR, engine matches.

##### onThrowError?

```ts
optional onThrowError?: (host, errorRef?) => void;
```

###### Parameters

###### host

`string`

###### errorRef?

`string`

###### Returns

`void`

##### escalationThrowOptions?

```ts
optional escalationThrowOptions?: EscalationThrowOption[];
```

"Escalate" cards (Handoff 18 §5e) — user picks the escalation, engine
matches; each option shows its PREDICTED destination + mode (reforço 7).

##### onThrowEscalation?

```ts
optional onThrowEscalation?: (host, escalationRef?) => void;
```

###### Parameters

###### host

`string`

###### escalationRef?

`string`

###### Returns

`void`

##### compensateCard?

```ts
optional compensateCard?: CompensateCard | null;
```

"Compensate" card (Handoff 19 §6d) — broadcast (default) + per compensable
activity; each option shows the SIZE/target of the reversal (reforço 10).

##### onCompensate?

```ts
optional onCompensate?: (activityRef?) => void;
```

###### Parameters

###### activityRef?

`string`

###### Returns

`void`

##### eventSubprocessOptions?

```ts
optional eventSubprocessOptions?: EventSubprocessOption[];
```

Manual timer/conditional event-subprocess cards (ES-5 §4e): those kinds
NEVER auto-fire; the mode is shown so the user decides informed.

##### onFireEventSubprocess?

```ts
optional onFireEventSubprocess?: (subId) => void;
```

###### Parameters

###### subId

`string`

###### Returns

`void`

##### stepMode

```ts
stepMode: boolean;
```

##### onToggleStepMode

```ts
onToggleStepMode: (on) => void;
```

###### Parameters

###### on

`boolean`

###### Returns

`void`

##### coverage

```ts
coverage: CoverageSummary;
```

##### trail

```ts
trail: TransitionRecord[];
```

##### hasApproximateSemantics

```ts
hasApproximateSemantics: boolean;
```

##### onRecord?

```ts
optional onRecord?: () => void;
```

Ledger registration (Handoff 7A-3). Button hides when absent.

###### Returns

`void`

##### canRecord?

```ts
optional canRecord?: boolean;
```

##### recordedInfo?

```ts
optional recordedInfo?: ReactNode;
```

***

### TokenTravel

A token journey to animate along one edge, keyed so it plays exactly once.

#### Properties

##### key

```ts
key: number;
```

##### edgeId

```ts
edgeId: string;
```

##### targetNodeId

```ts
targetNodeId: string;
```

##### durationMs

```ts
durationMs: number;
```

***

### UseSimulationResult

#### Properties

##### state

```ts
state: SimulationState;
```

##### coverage

```ts
coverage: CoverageSummary;
```

##### sessionNumber

```ts
sessionNumber: number;
```

##### stepMode

```ts
stepMode: boolean;
```

Step-by-step (no animation). Defaults on under prefers-reduced-motion.

##### setStepMode

```ts
setStepMode: (on) => void;
```

###### Parameters

###### on

`boolean`

###### Returns

`void`

##### hasApproximateSemantics

```ts
hasApproximateSemantics: boolean;
```

True when an OR gateway participates (panel shows the approximation notice).

##### canAdvance

```ts
canAdvance: boolean;
```

A decision-free token can be advanced.

##### travels

```ts
travels: TokenTravel[];
```

In-flight edge journeys for the token layer (empty in step mode).

##### clearTravel

```ts
clearTravel: (key) => void;
```

###### Parameters

###### key

`number`

###### Returns

`void`

##### statusLine

```ts
statusLine: string;
```

##### advance

```ts
advance: () => void;
```

###### Returns

`void`

##### choose

```ts
choose: (decision) => void;
```

###### Parameters

###### decision

`Decision`

###### Returns

`void`

##### fireBoundary

```ts
fireBoundary: (boundaryId) => void;
```

###### Parameters

###### boundaryId

`string`

###### Returns

`void`

##### fireEventSubprocess

```ts
fireEventSubprocess: (subId) => void;
```

Manually fire a timer/conditional event subprocess (ES-5 §4e).

###### Parameters

###### subId

`string`

###### Returns

`void`

##### reset

```ts
reset: () => void;
```

###### Returns

`void`

##### engine

```ts
engine: SimulationEngine;
```

Access the live engine (for scenario capture / ledger — Handoff 7A-3).

***

### AutosavePayload

Autosave payload (Handoff 4 §D2). The diagram is stored as its JSON model —
lossless by construction — rather than the XML export, which can degrade
unsupported elements with warnings. `hash` is the core content hash
(audit-independent), used to decide whether an autosave differs from the
loaded document: timestamps are unreliable for hosts that regenerate the
diagram on load.

#### Properties

##### savedAt

```ts
savedAt: string;
```

##### hash

```ts
hash: string;
```

##### diagram

```ts
diagram: BpmnDiagram;
```

***

### Viewport

#### Properties

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

### DragState

#### Properties

##### nodeIds

```ts
nodeIds: string[];
```

##### rootIds

```ts
rootIds: string[];
```

The nodes the user actually grabbed (before folding in ride-along
descendants and attached boundary events). Only these reparent on drop —
their descendants keep their parentId, which points inside the moved
subtree.

##### origin

```ts
origin: Point;
```

World-space pointer position when the gesture started.

##### dx

```ts
dx: number;
```

Current world-space offset applied visually to the dragged nodes.

##### dy

```ts
dy: number;
```

##### active

```ts
active: boolean;
```

True once the 4px threshold was crossed (drag vs click).

##### dropLaneId?

```ts
optional dropLaneId?: string | null;
```

Lane currently under the dragged node — the drop target for membership.

##### reparentTargetId?

```ts
optional reparentTargetId?: string | null;
```

Expanded sub-process currently under the cursor — the reparent-on-drop
target (F7). Its border highlights; the drop sets the grabbed nodes'
parentId. `null` means no container (a plain move, or a drag to top level
that clears parentId). Boundary snap takes precedence: while a boundary
snap is armed this stays null, so the two gestures never both light up.

***

### ConnectState

#### Properties

##### sourceId

```ts
sourceId: string;
```

##### sourcePoint

```ts
sourcePoint: Point;
```

##### currentPoint

```ts
currentPoint: Point;
```

##### hoverTargetId

```ts
hoverTargetId: string | null;
```

Node currently hovered as a potential target.

##### invalidReason

```ts
invalidReason: string | null;
```

Veto reason when hovering an invalid target.

***

### SelectionBoxState

#### Properties

##### start

```ts
start: Point;
```

##### current

```ts
current: Point;
```

***

### EdgeDragState

A manual-route edit in progress (Handoff 10 R-3): the user is dragging a
waypoint handle (or a freshly inserted bend). `waypoints` is the live route
with the dragged point tracking the pointer; committing turns the edge
manual in one command.

#### Properties

##### edgeId

```ts
edgeId: string;
```

##### index

```ts
index: number;
```

Index of the waypoint being dragged within `waypoints`.

##### waypoints

```ts
waypoints: Point[];
```

Working route (endpoints included); the dragged point follows the pointer.

##### origin

```ts
origin: Point;
```

World-space pointer position when the gesture started.

##### grabbed

```ts
grabbed: Point;
```

Original position of the dragged point — the drag delta is applied to it.

##### active

```ts
active: boolean;
```

True once the drag threshold was crossed (a click must not author a bend).

***

### ResizeState

#### Properties

##### nodeId

```ts
nodeId: string;
```

##### corner

```ts
corner: ResizeCorner;
```

##### initial

```ts
initial: object;
```

Node rect when the gesture started.

###### x

```ts
x: number;
```

###### y

```ts
y: number;
```

###### width

```ts
width: number;
```

###### height

```ts
height: number;
```

##### origin

```ts
origin: Point;
```

##### current

```ts
current: object;
```

Live rect applied visually while resizing.

###### x

```ts
x: number;
```

###### y

```ts
y: number;
```

###### width

```ts
width: number;
```

###### height

```ts
height: number;
```

***

### CanvasState

#### Properties

##### viewport

```ts
viewport: Viewport;
```

##### selectedIds

```ts
selectedIds: string[];
```

##### focusedElementId

```ts
focusedElementId: string | null;
```

Roving keyboard focus: the element whose <g> holds tabIndex=0.

##### alignGuides

```ts
alignGuides: object[] | null;
```

Smart alignment guides drawn while a drag magnetizes (item 2).

##### spacingBadges

```ts
spacingBadges: object[] | null;
```

Equal-spacing badges (Handoff 14 §1b) drawn alongside the guides.

##### searchOpen

```ts
searchOpen: boolean;
```

Find bar visibility (Ctrl/Cmd+F — item 4).

##### paletteOpen

```ts
paletteOpen: boolean;
```

Command palette visibility (Ctrl/Cmd+K — Handoff 15 §2f).

##### cheatsheetOpen

```ts
cheatsheetOpen: boolean;
```

Keyboard cheatsheet visibility ("?" — Handoff 15 §2f).

##### lintOpen

```ts
lintOpen: boolean;
```

Lint panel visibility — the bottom problems dock (Handoff 14 §1d).

##### layoutProposal

```ts
layoutProposal: LayoutProposalState | null;
```

Pending auto-layout proposal (Handoff 14 §1e, cerca §1.7): the canvas
shows target-position ghosts and the Aplicar/Recusar card; NOTHING moves
until the user applies. Refusing (or Esc) just clears this.

##### layoutSettle

```ts
layoutSettle: 
  | {
  ghosts: object[];
  token: number;
}
  | null;
```

160ms crossfade after applying a layout: ghosts of the OLD positions
fading out over the settled result (reduced-motion → never set).

##### searchPulse

```ts
searchPulse: 
  | {
  elementId: string;
  token: number;
}
  | null;
```

Two halo pulses around a search hit (Handoff 14 §1c). `token` re-triggers
the CSS animation on consecutive hits; null under reduced motion.

##### hoveredId

```ts
hoveredId: string | null;
```

##### hoveredEdgeId

```ts
hoveredEdgeId: string | null;
```

Edge currently hovered — reveals its route handles + manual badge (R-3).

##### dragState

```ts
dragState: DragState | null;
```

##### connectState

```ts
connectState: ConnectState | null;
```

##### selectionBox

```ts
selectionBox: SelectionBoxState | null;
```

##### resizeState

```ts
resizeState: ResizeState | null;
```

##### edgeDrag

```ts
edgeDrag: EdgeDragState | null;
```

In-progress manual-route edit (waypoint/segment drag), R-3.

##### editingNodeId

```ts
editingNodeId: string | null;
```

Id of the node whose label is being edited inline, if any.

##### isPanning

```ts
isPanning: boolean;
```

##### gridSize

```ts
gridSize: number;
```

##### snapEnabled

```ts
snapEnabled: boolean;
```

##### readOnly

```ts
readOnly: boolean;
```

##### lastCreatedNodeId

```ts
lastCreatedNodeId: string | null;
```

Node created by the last palette insert — plays the enter animation once.

##### dirtySinceExport

```ts
dirtySinceExport: boolean;
```

True when commands ran since the last explicit export (beforeunload guard).

##### drillId

```ts
drillId: string | null;
```

Sub-process being viewed in drill-down mode (null = whole process).

##### issueBadges

```ts
issueBadges: Record<string, NodeIssueBadge>;
```

Validation/soundness badges by node id (shape-state pendência §5): the
node renders a `!` disc — and the stable issue code below the shape when
present (Handoff 5 §3.2, e.g. CALL_REF_MISSING) — until the map is
cleared. Populated by Validate and the PromotionPanel's "ver no canvas".

##### dismissals

```ts
dismissals: DismissalEntry[];
```

Open overlays, bottom→top. Esc pops the top (Handoff 5 §11.1).

##### settling

```ts
settling: SettlingEntry[] | null;
```

Edges that just re-routed (Handoff 10 R-2b): their pre-A* orthogonal
preview paths, rendered on top and faded out (160ms) so the settled A*
route crossfades in underneath — never a waypoint morph. `null` (or under
`prefers-reduced-motion`) means no crossfade is playing.

##### boundarySnap

```ts
boundarySnap: BoundarySnapTarget | null;
```

Live boundary snap target (Handoff 11 N-1): while an event node drags
within the snap zone of an activity border, the host id + parametric
anchor of the candidate attachment. Drives the border highlight; the
drop commits ONE attach command.

##### contextMenu

```ts
contextMenu: ContextMenuState | null;
```

Open context menu (Handoff 11 N-5), or null.

##### editingEdgeId

```ts
editingEdgeId: string | null;
```

Edge whose label is being edited inline (N-5 "Editar rótulo").

***

### LayoutProposalState

The pending auto-layout (Handoff 14 §1e) as the store carries it. Matches
`LayoutProposal` from `canvas/arrange.ts` structurally — the store module
stays dependency-light (core types only).

#### Properties

##### command

```ts
command: Command;
```

##### moved

```ts
moved: object[];
```

###### id

```ts
id: string;
```

###### from

```ts
from: Point;
```

###### to

```ts
to: Point;
```

###### width

```ts
width: number;
```

###### height

```ts
height: number;
```

##### reroutedCount

```ts
reroutedCount: number;
```

##### manualCount

```ts
manualCount: number;
```

##### baseDiagram

```ts
baseDiagram: unknown;
```

Discard the proposal when the diagram changes underneath it.

***

### BoundarySnapTarget

#### Properties

##### hostId

```ts
hostId: string;
```

##### side

```ts
side: "left" | "right" | "top" | "bottom";
```

##### t

```ts
t: number;
```

##### point

```ts
point: Point;
```

The anchor point ON the border (world coordinates).

***

### ContextMenuState

Open context menu (Handoff 11 N-5): what was invoked and where. `client`
positions the HTML menu (viewport-relative); `world` feeds the actions
(e.g. "adicionar waypoint aqui").

#### Properties

##### kind

```ts
kind: "node" | "edge" | "canvas";
```

##### targetId?

```ts
optional targetId?: string;
```

##### client

```ts
client: Point;
```

##### world

```ts
world: Point;
```

***

### SettlingEntry

#### Properties

##### edgeId

```ts
edgeId: string;
```

##### path

```ts
path: string;
```

SVG path of the orthogonal preview at the final positions.

***

### NodeIssueBadge

#### Properties

##### severity

```ts
severity: "error" | "warning";
```

##### code?

```ts
optional code?: string;
```

Stable issue code rendered mono below the shape (optional).

***

### DismissalEntry

One entry of the SINGLE Esc dismissal stack (Handoff 5 §11.1): Esc always
closes the highest open overlay first — popover → peek → selection →
breadcrumb up. Components register while open (see `useDismissal`);
never wire independent Esc listeners.

#### Properties

##### id

```ts
id: string;
```

##### close

```ts
close: () => void;
```

###### Returns

`void`

***

### Store

Minimal external store (zero dependencies). Visual/interaction state lives
here instead of React context state so that high-frequency updates during
drag/pan re-render only the components whose *selected* slice changed —
never the whole tree.

#### Type Parameters

##### T

`T`

#### Methods

##### getState()

```ts
getState(): T;
```

###### Returns

`T`

##### setState()

```ts
setState(partial): void;
```

###### Parameters

###### partial

`Partial`\<`T`\> \| ((`previous`) => `Partial`\<`T`\>)

###### Returns

`void`

##### subscribe()

```ts
subscribe(listener): () => void;
```

###### Parameters

###### listener

() => `void`

###### Returns

() => `void`

***

### AnchorSealProps

#### Properties

##### state

```ts
state: AnchorState;
```

##### adapterId?

```ts
optional adapterId?: string;
```

Adapter id shown in the anchored seal ("git", "rfc3161", "s3").

##### head?

```ts
optional head?: string;
```

Local chain head hash (shown short).

##### anchoredHead?

```ts
optional anchoredHead?: string;
```

Anchored head hash, for the mismatch (broken) comparison.

##### onRetry?

```ts
optional onRetry?: () => void;
```

Retry handler for the pending state (↻ Retentar ancoragem).

###### Returns

`void`

##### retrying?

```ts
optional retrying?: boolean;
```

True while an anchoring attempt is in flight.

***

### CanonicalPayloadCardProps

"O que você está assinando" card (Handoff 8 §4.3, design card C): shows the
canonical payload BEFORE signing so the user sees exactly what the signature
covers. Always rendered above the sign button.

#### Properties

##### payload

```ts
payload: CanonicalApprovalPayload;
```

***

### DiffViewProps

#### Properties

##### diff

```ts
diff: BpmnDiff;
```

##### diagram?

```ts
optional diagram?: BpmnDiagram;
```

Used to resolve element labels; falls back to raw ids.

***

### EdgePedigreeStripProps

#### Properties

##### edgeId

```ts
edgeId: string;
```

Any edge of the chain — the strip walks to the root and forward.

##### onClose?

```ts
optional onClose?: () => void;
```

Host close hook; when present the strip joins the Esc dismissal stack.

###### Returns

`void`

##### ledgerHash?

```ts
optional ledgerHash?: (edge) => string | undefined;
```

Resolves the ledger hash shown on card hover (§5: hover = hash).

###### Parameters

###### edge

`BpmnEdge`

###### Returns

`string` \| `undefined`

***

### GovernanceBreadcrumbLevel

One level of the governance breadcrumb (Handoff 5 §10.3): a name plus its
governance identity — semver and vigência seal. `id` is what `onNavigate`
receives (null conventionally means the root surface).

#### Properties

##### id

```ts
id: string | null;
```

##### label

```ts
label: string;
```

##### semanticVersion?

```ts
optional semanticVersion?: string;
```

##### status?

```ts
optional status?: VersionStatus;
```

***

### GovernanceBreadcrumbProps

#### Properties

##### levels

```ts
levels: GovernanceBreadcrumbLevel[];
```

Trail from the root to the current level (last = current, not a link).

##### onNavigate

```ts
onNavigate: (id, index) => void;
```

Called with the clicked level's id + index (never the last level).

###### Parameters

###### id

`string` \| `null`

###### index

`number`

###### Returns

`void`

##### ariaLabel?

```ts
optional ariaLabel?: string;
```

Accessible name of the nav landmark.

***

### LedgerVerificationReport

Structural mirror of `@buildtovalue/audit`'s VerificationReport — kept as a
local type so the react layer depends only on core; the host passes the
verifier in (same inversion as the registry in the PromotionPanel).

#### Properties

##### intact

```ts
intact: boolean;
```

##### entries

```ts
entries: number;
```

##### firstBreak?

```ts
optional firstBreak?: object;
```

###### index

```ts
index: number;
```

###### expected

```ts
expected: string;
```

###### actual

```ts
actual: string;
```

##### verifiedAt

```ts
verifiedAt: string;
```

***

### LedgerStatusProps

#### Properties

##### verify

```ts
verify: () => 
  | LedgerVerificationReport
| Promise<LedgerVerificationReport>;
```

Runs the verification — typically `() => verifyLedger(ledger)`.

###### Returns

  \| [`LedgerVerificationReport`](#ledgerverificationreport)
  \| `Promise`\<[`LedgerVerificationReport`](#ledgerverificationreport)\>

***

### LintPanelProps

Lint panel (Handoff 14 §1d): a resizable bottom dock listing every finding
of the active lint profiles, grouped by rule. Etiquette AND engine-readiness
(executability) findings share this ONE surface — the source tag tells them
apart. Clicking a row selects the element and pans to it with the SAME
animated pan as the search bar; Esc closes via the single dismissal stack.

Fixes: a rule's mechanical quick-fix ("corrigir") executes ONE undoable
command; "corrigir todos" folds every available fix into ONE composite.
Findings without a mechanical fix show "✦ sugerir correção" instead —
routed through the copilot's C5 pipeline (same whitelist, integral
rejection, atomic composite) — and only when the host injected an
`AIProvider`, mirroring the CopilotPanel gate.

While the dock is open its findings mirror onto the canvas as issue badges
(`[data-node-issue]` — already stripped from exports by TRANSIENT_SELECTORS,
the "export mid-gesture" rule); closing clears them.

#### Properties

##### provider?

```ts
optional provider?: AIProvider;
```

HOST-injected transport for "✦ sugerir correção". Absent → no ✦ button.

##### profiles?

```ts
optional profiles?: LintProfile[];
```

Rule sets to run. Default: the shipped etiquette + engine profiles.

##### initialHeight?

```ts
optional initialHeight?: number;
```

Initial dock height in px (resizable by the user).

***

### PromotionApprover

#### Properties

##### actor

```ts
actor: UserContext;
```

##### label?

```ts
optional label?: string;
```

Display name for the role button (defaults to the actor's role).

***

### PromotionPanelProps

#### Properties

##### open

```ts
open: boolean;
```

##### onClose

```ts
onClose: () => void;
```

###### Returns

`void`

##### approvers

```ts
approvers: PromotionApprover[];
```

Who can approve in this UI — one button per role (host decides).

##### actor

```ts
actor: UserContext;
```

Who performs the promotion itself.

##### baseline

```ts
baseline: BpmnDiagram;
```

Baseline for the embedded diff (typically the previously active snapshot).

##### suggestChangeSummary?

```ts
optional suggestChangeSummary?: () => Promise<{
  text: string;
  author: string;
  promptTemplateRef: {
     id: string;
     version: string;
  };
}>;
```

C4 (Handoff 9): host-injected change_summary suggestion. The AI text only
PRE-FILLS the field — nothing reaches the version (or the ledger) until a
HUMAN interacts with the field and commits it; the committed version then
records the text co-authorship (`changeSummaryOrigin`).

###### Returns

`Promise`\<\{
  `text`: `string`;
  `author`: `string`;
  `promptTemplateRef`: \{
     `id`: `string`;
     `version`: `string`;
  \};
\}\>

##### previousActive?

```ts
optional previousActive?: object;
```

Currently active version, for the side-effects warning.

###### semanticVersion

```ts
semanticVersion: string;
```

###### runsPinned?

```ts
optional runsPinned?: number;
```

##### ledger?

```ts
optional ledger?: AuditLedger;
```

When provided, activation appends a VERSION_ACTIVATED entry and the toast shows its hash.

##### onActivated?

```ts
optional onActivated?: (result) => void;
```

###### Parameters

###### result

###### diagram

`BpmnDiagram`

###### ledgerEntry?

`AuditEntry`

###### Returns

`void`

##### coverage?

```ts
optional coverage?: object;
```

Optional path-coverage card (Handoff 7A-3). Shown next to the checks ONLY
when provided — the coverage promotion gate is OFF by default, so the host
passes this only when it has enabled the gate. `minCoverage` (0–1) draws
the pass/fail threshold; omit it for an informational card. The actual
blocking lives in the injected `PromotionRule`, not here.

###### covered

```ts
covered: number;
```

###### total

```ts
total: number;
```

###### minCoverage?

```ts
optional minCoverage?: number;
```

##### signerFor?

```ts
optional signerFor?: (approver) => Signer | undefined;
```

Identity signing (Handoff 8 I-2, host injection — cerca §1.1: the host owns
the key). When `signerFor(approver)` returns a `Signer`, that approver's
button becomes the "🔏 Assinar" flow: the canonical payload is shown BEFORE
signing, then `signApproval` runs and `onApprovalSigned` fires. Omitted →
current behavior; already-recorded approvals render a "não assinada" badge.

###### Parameters

###### approver

[`PromotionApprover`](#promotionapprover)

###### Returns

`Signer` \| `undefined`

##### resolvePublicKey?

```ts
optional resolvePublicKey?: (fingerprint) => 
  | Uint8Array<ArrayBufferLike>
  | Promise<Uint8Array<ArrayBufferLike> | undefined>
  | undefined;
```

Resolves a public key for verifying a recorded signature (for the badge).

###### Parameters

###### fingerprint

`string`

###### Returns

  \| `Uint8Array`\<`ArrayBufferLike`\>
  \| `Promise`\<`Uint8Array`\<`ArrayBufferLike`\> \| `undefined`\>
  \| `undefined`

##### signedApprovals?

```ts
optional signedApprovals?: SignedApproval[];
```

Signatures already recorded for this version (host-persisted), for badges.

##### onApprovalSigned?

```ts
optional onApprovalSigned?: (signed) => void;
```

Fires after a signature is produced so the host can persist it.

###### Parameters

###### signed

`SignedApproval`

###### Returns

`void`

***

### SignatureBadgeProps

#### Properties

##### state

```ts
state: VerificationState;
```

##### signer?

```ts
optional signer?: SignerIdentity;
```

Signer identity to show below the pill (subject · role).

##### signatureFingerprint?

```ts
optional signatureFingerprint?: string;
```

Signature fingerprint (mono), shown for the verified state.

##### expected?

```ts
optional expected?: string;
```

For the invalid state: the expected signature/hash.

##### obtained?

```ts
optional obtained?: string;
```

For the invalid state: what the current payload actually produces.

***

### StatusBadgeSeal

Standalone seal data (Handoff 6 §10.6): screens outside the editor
(Biblioteca, Revisão, Ledger Explorer) render the SAME component from
explicit data instead of the editor contexts. `meta` is precomputed by the
host — engine-derived lines ("aguarda N aprovações") only exist where a
lifecycle engine does.

#### Properties

##### status

```ts
status: VersionStatus;
```

##### semanticVersion

```ts
semanticVersion: string;
```

##### meta?

```ts
optional meta?: string;
```

***

### StatusBadgeProps

#### Properties

##### channel?

```ts
optional channel?: string;
```

Publication channel shown in the candidate meta line ("canal: piloto").
A registry concept (`Publication.channel`) — the host passes it in;
omitted, the segment is dropped.

##### seal?

```ts
optional seal?: StatusBadgeSeal;
```

Standalone mode: render this seal directly, requiring no editor context.
Omitted, the badge reads the surrounding <BpmnDesigner>/<BpmnViewer>.

***

### ToolbarProps

#### Properties

##### extra?

```ts
optional extra?: ReactNode;
```

Extra buttons rendered at the end of the toolbar.

***

### VersionTimelineItem

One entry on the timeline. Deliberately a plain, self-contained shape —
the component does **not** import `@buildtovalue/registry`, so the React
layer stays decoupled from governance storage. A host maps its registry
entries (or any version source) to this shape.

#### Properties

##### id

```ts
id: string;
```

##### semanticVersion

```ts
semanticVersion: string;
```

##### status

```ts
status: VersionStatus;
```

##### changeSummary?

```ts
optional changeSummary?: string;
```

##### approvers?

```ts
optional approvers?: string[];
```

Approver labels (roles or names) to show as chips.

##### channel?

```ts
optional channel?: string;
```

Live publication lane, e.g. "pilot" or "general/prod".

##### effectiveFrom?

```ts
optional effectiveFrom?: string;
```

ISO timestamp the version took effect.

##### effectiveUntil?

```ts
optional effectiveUntil?: string;
```

ISO timestamp the version stopped being effective (deprecation/retire).

##### pinnedRuns?

```ts
optional pinnedRuns?: number;
```

Executions pinned to this version (`bindRun` in the registry) — shown as
a read-only chip. The host supplies the count; the component never
queries governance storage.

##### current?

```ts
optional current?: boolean;
```

Marks the currently-selected/active entry.

***

### VersionTimelineProps

#### Properties

##### items

```ts
items: VersionTimelineItem[];
```

##### onSelect?

```ts
optional onSelect?: (id) => void;
```

###### Parameters

###### id

`string`

###### Returns

`void`

##### order?

```ts
optional order?: "desc" | "asc";
```

Newest-first (default) or oldest-first.

***

### ApprovalPayloadInput

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### ledger?

```ts
optional ledger?: AuditLedger;
```

The ledger whose head the approval binds to; omitted → empty head.

##### decision

```ts
decision: string;
```

Governance decision, e.g. "approve".

##### role

```ts
role: string;
```

Role asserted for the approval.

##### toXml?

```ts
optional toXml?: (diagram) => string;
```

Host XML exporter (Studio injects its configured converter). Defaults to
core's `BpmnXmlConverter` so the react surface works without one.

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`string`

***

### ChangeRequestPayloadInput

#### Extends

- `Omit`\<[`ApprovalPayloadInput`](#approvalpayloadinput), `"decision"`\>

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

###### Inherited from

[`ApprovalPayloadInput`](#approvalpayloadinput).[`diagram`](#diagram-11)

##### ledger?

```ts
optional ledger?: AuditLedger;
```

The ledger whose head the approval binds to; omitted → empty head.

###### Inherited from

[`ApprovalPayloadInput`](#approvalpayloadinput).[`ledger`](#ledger-1)

##### role

```ts
role: string;
```

Role asserted for the approval.

###### Inherited from

[`ApprovalPayloadInput`](#approvalpayloadinput).[`role`](#role)

##### toXml?

```ts
optional toXml?: (diagram) => string;
```

Host XML exporter (Studio injects its configured converter). Defaults to
core's `BpmnXmlConverter` so the react surface works without one.

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`string`

###### Inherited from

[`ApprovalPayloadInput`](#approvalpayloadinput).[`toXml`](#toxml)

##### threadRefs

```ts
threadRefs: readonly string[];
```

Ids of the OPEN threads attached to the request.

##### justification

```ts
justification: string;
```

Mandatory reviewer comment the signature binds.

***

### PayloadMapping

One var→destino row of a throw event's payload mapping.

#### Properties

##### source

```ts
source: string;
```

##### target

```ts
target: string;
```

***

### AnchorCycle

#### Properties

##### state

```ts
state: AnchorState;
```

##### receipt?

```ts
optional receipt?: AnchorReceipt;
```

##### retrying

```ts
retrying: boolean;
```

##### retry

```ts
retry: () => void;
```

Re-attempt anchoring (the ↻ Retentar action).

###### Returns

`void`

***

### BpmnDiffViewerProps

Review diff surface (Handoff 15 §2a + §2b, V-2/V-3): the TARGET diagram on
the read-only viewer (N-7) with the semantic diff painted over it and the
change-by-change navigation bar on top.

§2a binding semantics (V-2): unchanged dims to 45% (never hidden); removed
= dashed ghost AT the v-base position (−REM); moved = ghost at the origin +
arrow (→MOV); added = halo (+ADD); changed = dashed halo + clickable ΔN
badge → before→after popover; rerouted paints the ROUTE (↷ROTA), never the
nodes, never Δ. Tokens per the V-0 decision; glyph+text always.

§2b navigation (V-3): the bar consumes the SAME topologically-ordered list
`diffDiagrams` returns — the UI NEVER reorders. F7/Shift+F7 (and ←/→) walk
with wrap, each step pans with the U-4 `panViewportTo` and plays two halo
pulses (reduced-motion → instant pan, zero pulses). Category chips filter
(combinable, counts per kind); filtering recomputes M and repositions N
without losing the current item when it survives. The synced side list
navigates on click. Removed entries are navigable — the pan goes to the
GHOST at the v-base position.

Esc (V-2 decision, standalone surface): one local handler — popover first,
then `onClose` when the host provided it. The Studio embed (V-5) joins the
editor's single dismissal stack instead.

READ-ONLY by construction (cerca §1.1); nothing here touches the diagram
objects (§1.2). Every SVG artifact of the surface lives under
`[data-diff-overlay]` / `data-diff-state` (TRANSIENT_*) — exports stay
clean mid-diff and mid-navigation; the bar/list/legend are HTML outside
the SVG and can never leak into an export by construction.

#### Properties

##### base

```ts
base: BpmnDiagram;
```

The v-base (e.g. the currently ACTIVE version).

##### target

```ts
target: BpmnDiagram;
```

The v-target being reviewed (e.g. the CANDIDATE). Rendered diagram.

##### plugins?

```ts
optional plugins?: BpmnPlugin[];
```

##### messages?

```ts
optional messages?: Messages;
```

##### onClose?

```ts
optional onClose?: () => void;
```

Host-owned "close diff mode" (Esc reaches it after the popovers).

###### Returns

`void`

##### reviewStore?

```ts
optional reviewStore?: ReviewStore;
```

Host-injected comment store (Handoff 15 §2c). Absent → the review
surface (pins, threads, orphan notice) does not exist — declared
degradation, cerca §1.5; the diff surface is untouched.

##### author?

```ts
optional author?: string;
```

Author recorded on comments written here (e.g. "ana.ruiz").

##### threadsTab?

```ts
optional threadsTab?: boolean;
```

Studio embed mode (§2d): the side list becomes the Threads/Mudanças tab
pair, the "⚑ Aprovação bloqueada" banner appears while open threads
block, and dismissals become available (justified, audited via
`onDismissThread`).

##### onDismissThread?

```ts
optional onDismissThread?: (thread, justification) => void;
```

Called AFTER a justified dismissal so the host records the audit entry
(`reviewThreadDismissedEntry`) — a dismissal is never silent (§2d).

###### Parameters

###### thread

[`ReviewThread`](#reviewthread)

###### justification

`string`

###### Returns

`void`

***

### BpmnViewerProps

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### plugins?

```ts
optional plugins?: BpmnPlugin[];
```

Plugins supplying shapes / node types / edge styles for RENDERING only.
The viewer never runs edit interactions, so interaction/command plugin
surfaces are inert here.

##### overlay?

```ts
optional overlay?: ReactNode;
```

Extra SVG overlay content in world coordinates (read-only annotations).

##### showClosed?

```ts
optional showClosed?: boolean;
```

Render closed (removedInVersion) elements. Default true.

##### messages?

```ts
optional messages?: Messages;
```

Injected UI dictionary (Handoff 11 N-6). Omitted → English / outer provider.

##### diffStates?

```ts
optional diffStates?: Record<string, DiffPaintKind>;
```

Diff painting per element (Handoff 15 §2a) — see ViewerCanvasProps.

***

### ViewerCanvasProps

#### Properties

##### overlay?

```ts
optional overlay?: ReactNode;
```

Extra SVG content rendered on the overlay layer (world coordinates).

##### showClosed?

```ts
optional showClosed?: boolean;
```

Show closed (removedInVersion) elements. Default true.

##### diffStates?

```ts
optional diffStates?: Record<string, DiffPaintKind>;
```

Diff painting (Handoff 15 §2a): element id → kind. When provided, every
rendered element gains a `data-diff-state` wrapper — elements NOT in the
map read `unchanged` and dim to 45% via CSS (never hidden). When absent
the render tree is BYTE-IDENTICAL to before (viewerEquivalence).

***

### ComputeExecutor

#### Methods

##### run()

```ts
run<Output>(job, input): Promise<Output>;
```

Run a registered job by name. Always async so callers are worker-agnostic.

###### Type Parameters

###### Output

`Output` = `unknown`

###### Parameters

###### job

`string`

###### input

`unknown`

###### Returns

`Promise`\<`Output`\>

##### dispose()

```ts
dispose(): void;
```

Release any underlying worker. No-op for the synchronous executor.

###### Returns

`void`

***

### WorkerRequest

#### Properties

##### \_\_btvJob

```ts
__btvJob: true;
```

##### id

```ts
id: number;
```

##### job

```ts
job: string;
```

##### input

```ts
input: unknown;
```

***

### WorkerResponse

#### Properties

##### \_\_btvJob

```ts
__btvJob: true;
```

##### id

```ts
id: number;
```

##### result?

```ts
optional result?: unknown;
```

##### error?

```ts
optional error?: string;
```

***

### RouteJobInput

Built-in compute jobs (Handoff 11 N-8). Only jobs the react layer OWNS live
here — routing. Soundness and layout live in other packages, so a host
registers them the same way (see workers README); the harness is generic.

`route` input carries a NAMED router (not a function — functions can't cross a
worker boundary); the job resolves it to the real router inside the worker.

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### router?

```ts
optional router?: string;
```

Named router: 'astar' | 'orthogonal' | 'bezier' | 'straight'. Default 'astar'.

## Type Aliases

### BindingState

```ts
type BindingState = "active" | "stale" | "missing";
```

***

### RouteMode

```ts
type RouteMode = "auto" | "manual";
```

Route mode marker (Handoff 10 §11): `'auto'` = derived/cached A* route,
`'manual'` = user-authored (R-3). Absent + has waypoints = external import,
treated as manual by R-3.

***

### RouterName

```ts
type RouterName = "bezier" | "orthogonal" | "straight" | "astar";
```

***

### Interactions

```ts
type Interactions = ReturnType<typeof useInteractions>;
```

***

### Messages

```ts
type Messages = Record<string, string>;
```

Zero-dependency i18n primitive (Handoff 11 N-6). The host injects a message
dictionary by prop; there is NO automatic locale detection and NO runtime
dependency — the host decides which dictionary to pass. English (`EN`) is the
complete, embedded fallback: any key missing from the injected dictionary
resolves to its English string, so a partial translation degrades to English
one key at a time instead of showing a raw key.

Interpolation is a single pass of `{token}` replacement (no ICU). Plurals use
explicit sibling keys — `foo_one` / `foo_other` — selected by `params.count`;
a caller asks for the base key `foo` and the engine picks the sibling.

***

### TParams

```ts
type TParams = Record<string, string | number>;
```

***

### TFunction

```ts
type TFunction = (key, params?) => string;
```

`t(key, params?)` — resolve a key against the active dictionary.

#### Parameters

##### key

`string`

##### params?

[`TParams`](#tparams)

#### Returns

`string`

***

### ShapeComponent

```ts
type ShapeComponent = ComponentType<ShapeProps>;
```

***

### PaletteInsertResult

```ts
type PaletteInsertResult = 
  | {
  command: Command;
  selectId: string;
}
  | {
  veto: string;
};
```

Result of a palette [PaletteItem.build](#build): a command to run, or a declared veto.

***

### EdgeRouterFn

```ts
type EdgeRouterFn = (source, target, context?) => EdgeGeometry;
```

#### Parameters

##### source

`Rect`

##### target

`Rect`

##### context?

[`EdgeRouterContext`](#edgeroutercontext)

#### Returns

`EdgeGeometry`

***

### EditorEventName

```ts
type EditorEventName = typeof EDITOR_EVENTS[number];
```

***

### EditorEventHandler

```ts
type EditorEventHandler = (event) => void;
```

#### Parameters

##### event

[`EditorEvent`](#editorevent)

#### Returns

`void`

***

### ResizeCorner

```ts
type ResizeCorner = "nw" | "ne" | "sw" | "se";
```

***

### CanvasStore

```ts
type CanvasStore = Store<CanvasState>;
```

***

### EventExecutionMode

```ts
type EventExecutionMode = "throw" | "catch-error";
```

Executable-event matrix (Handoff 16 E-4, §3c). Lives HERE — in react, not
in the engine and not in a registry — because the throw/catch asymmetry is
OMG semantics (cerca §1.4), not an engine opinion; the engine only names
the property KEYS (`payloadKey`/`errorCodeVariableKey`/…).

- `'throw'` (payload mappings var→destino): `intermediateThrowEvent` and
  `endEvent` whose kind is message|signal.
- `'catch-error'` (capture variables errCode/errMsg): error `boundaryEvent`,
  and an error `startEvent` contained in an EVENT SUBPROCESS — tightened in
  Handoff 17 ES-3 (§4c): the E-4 "any subProcess" approximation is dead;
  the predicate is the core `isEventSubprocess` helper (ES-1 reforço 9 —
  the SAME object the ES-4 lint consumes, agreement by construction). An
  error start anywhere else is what `EVT_ERROR_START_TOPLEVEL` flags — no
  tab here.
- Everything else → `null`: message/signal catches carry no I/O in this
  handoff (runtime correlation is host-owned, §3) and keep no tab.

***

### ComputeJob

```ts
type ComputeJob<Input, Output> = (input) => Output;
```

Optional off-thread compute (Handoff 11 N-8). A tiny, zero-dependency harness
that lets a host move expensive pure computations (routing, soundness, and —
once one exists — layout) onto a Web Worker via OPT-IN, while degrading to the
current synchronous behaviour when no worker is provided.

The contract is deliberately narrow: a job is a PURE function from a
serializable input to a serializable output. The same job registry runs
unchanged in-thread (SyncExecutor) or inside a worker (the worker entry wires
`createWorkerHandler` to `onmessage`). Because the job is pure and its I/O is
serializable, the worker result is byte-for-byte identical to the synchronous
one — proven by the equivalence tests, not assumed.

#### Type Parameters

##### Input

`Input` = `unknown`

##### Output

`Output` = `unknown`

#### Parameters

##### input

`Input`

#### Returns

`Output`

***

### JobRegistry

```ts
type JobRegistry = Record<string, ComputeJob>;
```

## Variables

### ARROW\_MARKER\_ID

```ts
const ARROW_MARKER_ID: "bpmnr-arrow" = 'bpmnr-arrow';
```

***

### ARROW\_MARKER\_MUTED\_ID

```ts
const ARROW_MARKER_MUTED_ID: "bpmnr-arrow-muted" = 'bpmnr-arrow-muted';
```

***

### ARROW\_MARKER\_SELECTED\_ID

```ts
const ARROW_MARKER_SELECTED_ID: "bpmnr-arrow-selected" = 'bpmnr-arrow-selected';
```

***

### EDGE\_MARKER\_FILLED\_ID

```ts
const EDGE_MARKER_FILLED_ID: "bpmnr-edge-filled" = 'bpmnr-edge-filled';
```

Domain edge markers. These inherit the edge's own stroke via
`context-stroke`, so a single marker serves every domain color (handoff,
approval, feedback, escalation) instead of one marker per color.

***

### EDGE\_MARKER\_OPEN\_ID

```ts
const EDGE_MARKER_OPEN_ID: "bpmnr-edge-open" = 'bpmnr-edge-open';
```

***

### EDGE\_MARKER\_CHEVRON\_ID

```ts
const EDGE_MARKER_CHEVRON_ID: "bpmnr-edge-chevron" = 'bpmnr-edge-chevron';
```

***

### EDGE\_MARKER\_DISC\_ID

```ts
const EDGE_MARKER_DISC_ID: "bpmnr-edge-disc" = 'bpmnr-edge-disc';
```

***

### CLOSED\_HATCH\_PATTERN\_ID

```ts
const CLOSED_HATCH_PATTERN_ID: "bpmnr-closed-hatch" = 'bpmnr-closed-hatch';
```

Closed-element hatch (Handoff 5 §5, variante 5b mitigada): ONE pattern def
per SVG, referenced by every closed node — 45° lines, 6px pitch, 1px
stroke. Never color-only: the hatch itself is the a11y signal.

***

### SHADOW\_FILTER\_ID

```ts
const SHADOW_FILTER_ID: "bpmnr-shadow" = 'bpmnr-shadow';
```

Craft-pack drop shadow, applied only to activity/card shapes.

***

### SHADOW\_HOVER\_FILTER\_ID

```ts
const SHADOW_HOVER_FILTER_ID: "bpmnr-shadow-hover" = 'bpmnr-shadow-hover';
```

Elevated variant swapped in by CSS while the node is hovered.

***

### EdgeRenderer

```ts
const EdgeRenderer: MemoExoticComponent<(__namedParameters) => Element | null>;
```

***

### NodeRenderer

```ts
const NodeRenderer: MemoExoticComponent<(__namedParameters) => Element>;
```

***

### SETTLE\_MS

```ts
const SETTLE_MS: 160 = 160;
```

Crossfade duration for the settle preview (Handoff 10 R-2b).

***

### SIG\_REF\_MISSING

```ts
const SIG_REF_MISSING: "SIG_REF_MISSING" = 'SIG_REF_MISSING';
```

Governed event-definition bindings (Handoff 16 §3b). The binding is the
PINNED `nome@semver` string stored in `properties.eventDefinitionBinding` —
which serializes as a `bpmnr:property` (never `camunda:modelRefCode`) and
round-trips byte-stable by construction. Binding keeps a LOCAL MIRROR
definition (`gov-{nome}`) so the OMG export stays valid (`messageRef`
present); the mirror is read-only in the UI (E-3 reforço 10) and counts as
a normal usage for the deletion veto (E-0/E-3 ponto 6).

***

### SIG\_REF\_STALE

```ts
const SIG_REF_STALE: "SIG_REF_STALE" = 'SIG_REF_STALE';
```

***

### SEMANTIC\_ZOOM\_MIN

```ts
const SEMANTIC_ZOOM_MIN: 0.6 = 0.6;
```

Semantic zoom (craft pack A5): below this zoom the canvas is stamped
`data-zoom-band="reduced"` and CSS fades out secondary ink — edge labels and
domain type tags. Shared by the editor canvas and the lightweight
ViewerCanvas so both stamp the same band at the same threshold.

***

### roundedOrthogonalConnection

```ts
const roundedOrthogonalConnection: EdgeRouterFn;
```

Built-in orthogonal router with the craft-pack rounded corners applied.

***

### straightRouter

```ts
const straightRouter: EdgeRouterFn;
```

Built-in straight (direct-line) router — no bends, so no corner radius.

***

### astarConnection

```ts
const astarConnection: EdgeRouterFn;
```

Obstacle-avoiding router (Handoff 10). Delegates to the headless core
routeAStar; reads obstacles / already-routed edges from the optional
context (empty when a caller routes without it, e.g. the live per-render path
before R-2b wires the context in). Rounded to the craft-pack radius.

***

### NAMED\_ROUTERS

```ts
const NAMED_ROUTERS: Record<RouterName, EdgeRouterFn>;
```

The four built-in named routers (Handoff 10 §1.1 / §3).

***

### KEYBOARD\_SHORTCUT\_CATALOG

```ts
const KEYBOARD_SHORTCUT_CATALOG: readonly ShortcutCatalogEntry[];
```

***

### EN

```ts
const EN: Messages;
```

English dictionary — the COMPLETE embedded fallback (Handoff 11 N-6),
assembled from every surface fragment. Any key a host-injected dictionary
omits resolves to the English string here, so a partial translation degrades
to English one key at a time instead of showing a raw key.

Plural pairs use `_one` / `_other` siblings selected by `params.count`;
interpolation tokens are `{name}` (single-pass, no ICU).

***

### PT\_BR

```ts
const PT_BR: Messages;
```

Brazilian Portuguese dictionary (Handoff 11 N-6) — the SECOND official
dictionary, assembled from every surface fragment. It proves the injection
prop end-to-end: the strings that used to be embedded pt-BR literals across
the react/studio surfaces now live in the fragments and are selected only
when the host passes `messages={PT_BR}`. Any key missing here falls back to
English (see `EN`), so a fragment may lag a key without breaking the UI.

***

### EDITOR\_EVENTS

```ts
const EDITOR_EVENTS: readonly ["diagram.loaded", "element.added", "element.changed", "element.removed", "edge.connected", "selection.changed", "command.executed", "command.undone", "validation.changed", "promotion.completed", "import.warning", "render.slow", "shape.render.error", "review.thread.opened", "review.thread.resolved", "review.changes.requested"];
```

The PUBLIC editor event catalog (Handoff 11 N-3) — the complete, stable
vocabulary the editor emits through the plugin `onEditorEvent` channel
(same injected callback as always: no global emitter, zero deps).

STABILITY CONTRACT (semver): adding an event = minor; changing an event's
payload = MAJOR; renaming an event = the old name keeps emitting alongside
the new one for at least one minor, with a single console deprecation
warning (see [DEPRECATED\_EVENT\_ALIASES](#deprecated_event_aliases)), then is removed in the
next major.

***

### DEPRECATED\_EVENT\_ALIASES

```ts
const DEPRECATED_EVENT_ALIASES: object;
```

Deprecated event names (N-3 rename to the public catalog): each old name
keeps emitting ALONGSIDE its replacement for one minor, with a single
console warning per session, and disappears in the next major.

#### Type Declaration

###### node.created

```ts
readonly node.created: "element.added" = 'element.added';
```

Old palette-insert event — superseded by `element.added` (kind: 'node').

***

### MIN\_DISMISS\_JUSTIFICATION

```ts
const MIN_DISMISS_JUSTIFICATION: 10 = 10;
```

Minimum justification length for a dismissal — never a silent release.

***

### EDGE\_CORNER\_RADIUS

```ts
const EDGE_CORNER_RADIUS: 8 = 8;
```

Corner radius for orthogonal edge bends (craft spec: r8). A presentation
constant of this renderer, not a plugin decision — the core still emits
sharp polylines by default.

***

### theme

```ts
const theme: object;
```

Theme tokens — override via CSS variables (see styles.css).

#### Type Declaration

##### stroke

```ts
stroke: string = 'var(--bpmnr-stroke, #44403a)';
```

##### strokeSelected

```ts
strokeSelected: string = 'var(--bpmnr-selected, #1a6a54)';
```

##### fill

```ts
fill: string = 'var(--bpmnr-fill, #ffffff)';
```

##### fillActivity

```ts
fillActivity: string = 'var(--bpmnr-fill-activity, #f8f7f4)';
```

##### fillEvent

```ts
fillEvent: string = 'var(--bpmnr-fill-event, #eef4f0)';
```

##### fillGateway

```ts
fillGateway: string = 'var(--bpmnr-fill-gateway, #fdf4e3)';
```

##### text

```ts
text: string = 'var(--bpmnr-text, #262220)';
```

##### textMuted

```ts
textMuted: string = 'var(--bpmnr-text-muted, #6f675a)';
```

***

### BUILT\_IN\_SHAPES

```ts
const BUILT_IN_SHAPES: Record<string, ShapeComponent>;
```

***

### SUBPROCESS\_TITLE\_HEIGHT

```ts
const SUBPROCESS_TITLE_HEIGHT: 30 = 30;
```

Height of the expanded sub-process title strip (Handoff 5 §3.3) — the
double-click drill target (rename stays on the body/inspector).

***

### AUTOSAVE\_DEBOUNCE\_MS

```ts
const AUTOSAVE_DEBOUNCE_MS: 2000 = 2000;
```

Debounce between the last command and the localStorage write.

***

### MIN\_VIEWPORT\_WIDTH

```ts
const MIN_VIEWPORT_WIDTH: 200 = 200;
```

***

### MAX\_VIEWPORT\_WIDTH

```ts
const MAX_VIEWPORT_WIDTH: 20000 = 20000;
```

***

### ANCHOR\_GLYPHS

```ts
const ANCHOR_GLYPHS: Record<AnchorState, string>;
```

Anchor seal (Handoff 8 §4.2): the external-anchor state of the chain head.
Same contract as the other badges — pill with icon glyph + label (never color
alone), colors keyed by `[data-anchor]` in styles.css; the negative path
(`broken`) uses `--btv-error`. The `pending` third state (cerca §1.3) declares
the guarantee in force and offers a retry — it never regresses the promotion.

***

### ANCHOR\_LABELS

```ts
const ANCHOR_LABELS: Record<AnchorState, string>;
```

***

### VERIFICATION\_GLYPHS

```ts
const VERIFICATION_GLYPHS: Record<VerificationState, string>;
```

Identity badge (Handoff 8 §4.1): replaces the loose approver name with a
cryptographic verification state. Same contract as `StatusBadge` — the pill
carries an icon glyph AND a text label (state never by color alone), and
colors live in `styles.css` keyed by `[data-verification]`. The negative
path (`invalid`) renders in `--btv-error` with the expected × obtained hashes.

***

### VERIFICATION\_LABELS

```ts
const VERIFICATION_LABELS: Record<VerificationState, string>;
```

***

### SEAL\_LABELS

```ts
const SEAL_LABELS: Record<VersionStatus, string>;
```

Canonical seal labels (Handoff 3 §5 — "usar em TODO o produto"). Labels are
presentation; `data-status` is the machine-readable contract. Colors live in
styles.css under `[data-status]` so themes can override them. Shared with
the VersionTimeline so every seal in the product reads the same.

***

### BUILT\_IN\_PALETTE\_GROUPS

```ts
const BUILT_IN_PALETTE_GROUPS: PaletteGroup[];
```

Built-in palette sections: the standard set plus the F6 event sub-menu.

***

### BUILT\_IN\_PALETTE

```ts
const BUILT_IN_PALETTE: PaletteItem[];
```

Default palette: the standard BPMN starter set, grouped.

***

### routeJob

```ts
const routeJob: ComputeJob<RouteJobInput, BpmnDiagram>;
```

Re-derive automatic routes for a whole diagram (the expensive A* pass).

***

### DEFAULT\_JOBS

```ts
const DEFAULT_JOBS: JobRegistry;
```

The default registry the worker entry ships with. Extend with your own.

## Functions

### BpmnDesigner()

```ts
function BpmnDesigner(__namedParameters): Element;
```

Full editing surface: canvas + gestures + command stack + plugin system.
Compose UI panels as children, or use `<BpmnEditor>` for the batteries-
included arrangement.

#### Parameters

##### \_\_namedParameters

[`BpmnDesignerProps`](#bpmndesignerprops)

#### Returns

`Element`

***

### BpmnEditor()

```ts
function BpmnEditor(__namedParameters): Element;
```

Batteries-included editor: BpmnDesigner + Toolbar + Palette +
PropertiesPanel + MiniMap + StatusBadge, arranged with the default layout.
Import `@buildtovalue/react/styles.css` for the default styling.

#### Parameters

##### \_\_namedParameters

[`BpmnEditorProps`](#bpmneditorprops)

#### Returns

`Element`

***

### BpmnCanvas()

```ts
function BpmnCanvas(__namedParameters): Element;
```

The SVG canvas. Pan/zoom via the `viewBox` attribute (crisp text at every
zoom level); world-coordinate conversion via `getScreenCTM().inverse()`.

#### Parameters

##### \_\_namedParameters

[`CanvasProps`](#canvasprops)

#### Returns

`Element`

***

### Defs()

```ts
function Defs(__namedParameters): Element;
```

Shared SVG defs: arrowheads, the node shadow and the dot-grid pattern.

#### Parameters

##### \_\_namedParameters

###### gridSize

`number`

#### Returns

`Element`

***

### GridLayer()

```ts
function GridLayer(__namedParameters): Element;
```

Grid rectangle covering the current viewport.

#### Parameters

##### \_\_namedParameters

###### viewport

\{
  `x`: `number`;
  `y`: `number`;
  `width`: `number`;
  `height`: `number`;
\}

###### viewport.x

`number`

###### viewport.y

`number`

###### viewport.width

`number`

###### viewport.height

`number`

#### Returns

`Element`

***

### EdgeLabelEditor()

```ts
function EdgeLabelEditor(): Element | null;
```

Inline edge-label editor (Handoff 11 N-5, "Editar rótulo"): a foreignObject
input at the label anchor (longest free segment midpoint, R-4 rule).
Commits via updateEdgeCommand on Enter/blur, cancels on Escape — the same
contract as the node label editor; the commit is always a command.

#### Returns

`Element` \| `null`

***

### longestSegmentMidpoint()

```ts
function longestSegmentMidpoint(waypoints): Point;
```

Midpoint of the longest segment of a polyline route (§4 label placement).

#### Parameters

##### waypoints

`Point`[]

#### Returns

`Point`

***

### ConnectedEdge()

```ts
function ConnectedEdge(__namedParameters): Element;
```

Granular store binding for one edge.

#### Parameters

##### \_\_namedParameters

###### edge

`BpmnEdge`

###### nodes

`Record`\<`string`, `BpmnNode`\>

###### interactions?

\{
  `onNodePointerDown`: (`event`, `nodeId`) => `void`;
  `onPortPointerDown`: (`event`, `nodeId`) => `void`;
  `onNodeDoubleClick`: (`event`, `nodeId`) => `void`;
  `onResizePointerDown`: (`event`, `nodeId`, `corner`) => `void`;
  `onEdgeHandlePointerDown`: (`event`, `edgeId`, `index`, `base`) => `void`;
  `onEdgeSegmentPointerDown`: (`event`, `edgeId`, `segIndex`, `base`) => `void`;
  `onEdgeWaypointDoubleClick`: (`event`, `edgeId`, `index`, `base`) => `void`;
  `onCanvasPointerDown`: (`event`) => `void`;
  `onPointerMove`: (`event`) => `void`;
  `onPointerUp`: (`event`) => `void`;
  `cancelGestures`: () => `void`;
  `setPanKey`: (`held`) => `void`;
  `onNodeContextMenu`: (`event`, `nodeId`) => `void`;
  `onEdgeContextMenu`: (`event`, `edgeId`) => `void`;
  `onCanvasContextMenu`: (`event`) => `void`;
  `openContextMenuForSelection`: () => `void`;
  `armLongPress`: (`event`, `kind`, `targetId`) => `void`;
  `cancelLongPress`: () => `void`;
  `centerOfNode`: (`nodeId`) => `Point`;
\}

###### interactions.onNodePointerDown

(`event`, `nodeId`) => `void`

Node body pointerdown → select + begin (potential) drag.

###### interactions.onPortPointerDown

(`event`, `nodeId`) => `void`

Port pointerdown → begin a connection gesture.

###### interactions.onNodeDoubleClick

(`event`, `nodeId`) => `void`

Node double-click. One navigation gesture for the whole family (Handoff
5 §7.6): on an EXPANDED sub-process' title strip it drills down; on the
body (and every other node) it begins inline label editing — rename
stays discoverable via body double-click and the inspector's Label field.

###### interactions.onResizePointerDown

(`event`, `nodeId`, `corner`) => `void`

Resize-handle pointerdown → begin a resize gesture.

###### interactions.onEdgeHandlePointerDown

(`event`, `edgeId`, `index`, `base`) => `void`

Route-handle pointerdown → begin dragging an existing waypoint (R-3).

###### interactions.onEdgeSegmentPointerDown

(`event`, `edgeId`, `segIndex`, `base`) => `void`

Segment pointerdown → insert a bend at the pointer and drag it (R-3). The
gesture only authors a manual route once the drag threshold is crossed.

###### interactions.onEdgeWaypointDoubleClick

(`event`, `edgeId`, `index`, `base`) => `void`

Double-click an interior waypoint → remove it (stays manual, undoable).

###### interactions.onCanvasPointerDown

(`event`) => `void`

Empty-canvas pointerdown → pan (middle button / space) or lasso (left).

###### interactions.onPointerMove

(`event`) => `void`

###### interactions.onPointerUp

(`event`) => `void`

###### interactions.cancelGestures

() => `void`

###### interactions.setPanKey

(`held`) => `void`

###### interactions.onNodeContextMenu

(`event`, `nodeId`) => `void`

###### interactions.onEdgeContextMenu

(`event`, `edgeId`) => `void`

###### interactions.onCanvasContextMenu

(`event`) => `void`

###### interactions.openContextMenuForSelection

() => `void`

N-5 keyboard (Menu / Shift+F10): opens for the first selected element.

###### interactions.armLongPress

(`event`, `kind`, `targetId`) => `void`

###### interactions.cancelLongPress

() => `void`

###### interactions.centerOfNode

(`nodeId`) => `Point` = `...`

#### Returns

`Element`

***

### NodeLabelEditor()

```ts
function NodeLabelEditor(__namedParameters): Element;
```

Inline label editor rendered over a node via an SVG `<foreignObject>`, so
it scales and pans with the `viewBox` like the rest of the canvas. Commits
on Enter or blur, cancels on Escape. Only mounted for the node currently
being edited, so the input hooks carry no per-node cost.

#### Parameters

##### \_\_namedParameters

###### node

`BpmnNode`

#### Returns

`Element`

***

### ConnectedNode()

```ts
function ConnectedNode(__namedParameters): Element;
```

Connects a node id to its slice of canvas state, keeping renders granular.

#### Parameters

##### \_\_namedParameters

###### node

`BpmnNode`

###### interactions

\{
  `onNodePointerDown`: (`event`, `nodeId`) => `void`;
  `onPortPointerDown`: (`event`, `nodeId`) => `void`;
  `onNodeDoubleClick`: (`event`, `nodeId`) => `void`;
  `onResizePointerDown`: (`event`, `nodeId`, `corner`) => `void`;
  `onEdgeHandlePointerDown`: (`event`, `edgeId`, `index`, `base`) => `void`;
  `onEdgeSegmentPointerDown`: (`event`, `edgeId`, `segIndex`, `base`) => `void`;
  `onEdgeWaypointDoubleClick`: (`event`, `edgeId`, `index`, `base`) => `void`;
  `onCanvasPointerDown`: (`event`) => `void`;
  `onPointerMove`: (`event`) => `void`;
  `onPointerUp`: (`event`) => `void`;
  `cancelGestures`: () => `void`;
  `setPanKey`: (`held`) => `void`;
  `onNodeContextMenu`: (`event`, `nodeId`) => `void`;
  `onEdgeContextMenu`: (`event`, `edgeId`) => `void`;
  `onCanvasContextMenu`: (`event`) => `void`;
  `openContextMenuForSelection`: () => `void`;
  `armLongPress`: (`event`, `kind`, `targetId`) => `void`;
  `cancelLongPress`: () => `void`;
  `centerOfNode`: (`nodeId`) => `Point`;
\}

###### interactions.onNodePointerDown

(`event`, `nodeId`) => `void`

Node body pointerdown → select + begin (potential) drag.

###### interactions.onPortPointerDown

(`event`, `nodeId`) => `void`

Port pointerdown → begin a connection gesture.

###### interactions.onNodeDoubleClick

(`event`, `nodeId`) => `void`

Node double-click. One navigation gesture for the whole family (Handoff
5 §7.6): on an EXPANDED sub-process' title strip it drills down; on the
body (and every other node) it begins inline label editing — rename
stays discoverable via body double-click and the inspector's Label field.

###### interactions.onResizePointerDown

(`event`, `nodeId`, `corner`) => `void`

Resize-handle pointerdown → begin a resize gesture.

###### interactions.onEdgeHandlePointerDown

(`event`, `edgeId`, `index`, `base`) => `void`

Route-handle pointerdown → begin dragging an existing waypoint (R-3).

###### interactions.onEdgeSegmentPointerDown

(`event`, `edgeId`, `segIndex`, `base`) => `void`

Segment pointerdown → insert a bend at the pointer and drag it (R-3). The
gesture only authors a manual route once the drag threshold is crossed.

###### interactions.onEdgeWaypointDoubleClick

(`event`, `edgeId`, `index`, `base`) => `void`

Double-click an interior waypoint → remove it (stays manual, undoable).

###### interactions.onCanvasPointerDown

(`event`) => `void`

Empty-canvas pointerdown → pan (middle button / space) or lasso (left).

###### interactions.onPointerMove

(`event`) => `void`

###### interactions.onPointerUp

(`event`) => `void`

###### interactions.cancelGestures

() => `void`

###### interactions.setPanKey

(`held`) => `void`

###### interactions.onNodeContextMenu

(`event`, `nodeId`) => `void`

###### interactions.onEdgeContextMenu

(`event`, `edgeId`) => `void`

###### interactions.onCanvasContextMenu

(`event`) => `void`

###### interactions.openContextMenuForSelection

() => `void`

N-5 keyboard (Menu / Shift+F10): opens for the first selected element.

###### interactions.armLongPress

(`event`, `kind`, `targetId`) => `void`

###### interactions.cancelLongPress

() => `void`

###### interactions.centerOfNode

(`nodeId`) => `Point` = `...`

#### Returns

`Element`

***

### SettlingOverlay()

```ts
function SettlingOverlay(): Element | null;
```

Settle crossfade (Handoff 10 R-2b). On drop, the moved nodes' A* edges snap
to freshly cached waypoints. To avoid a jarring jump from the mid-drag
orthogonal preview, that preview path is painted ON TOP at the final
positions and faded to transparent over [SETTLE\_MS](#settle_ms)ms — revealing the
opaque, already-settled A* route underneath. This is a pure opacity
crossfade of two overlapping paths; waypoints are never interpolated.

`prefers-reduced-motion` suppresses the crossfade upstream (the drop handler
never sets `settling`), so this overlay simply renders nothing then.

#### Returns

`Element` \| `null`

***

### LayoutSettleOverlay()

```ts
function LayoutSettleOverlay(): Element | null;
```

Layout crossfade (Handoff 14 §1e): after APPLYING an auto-layout proposal,
ghosts of the moved nodes' OLD rects fade out over [SETTLE\_MS](#settle_ms)ms on
top of the settled result — same opacity-only crossfade discipline as the
edge settle above. `prefers-reduced-motion` suppresses it upstream (the
apply handler never sets `layoutSettle`).

#### Returns

`Element` \| `null`

***

### buildLayoutProposal()

```ts
function buildLayoutProposal(diagram): LayoutProposal | null;
```

Computes the layout PROPOSAL; null when out of scope or a no-op.

#### Parameters

##### diagram

`BpmnDiagram`

#### Returns

[`LayoutProposal`](#layoutproposal) \| `null`

***

### eventBindingOf()

```ts
function eventBindingOf(node): string | undefined;
```

The pinned `nome@semver` binding of an event node, when present.

#### Parameters

##### node

`BpmnNode`

#### Returns

`string` \| `undefined`

***

### mirrorIdOf()

```ts
function mirrorIdOf(binding): string;
```

Stable mirror-definition id of a binding (`gov-{nome}`).

#### Parameters

##### binding

`string`

#### Returns

`string`

***

### isMirrorDefinition()

```ts
function isMirrorDefinition(definitionId): boolean;
```

True when the definition is a Biblioteca mirror (read-only in the UI).

#### Parameters

##### definitionId

`string`

#### Returns

`boolean`

***

### bindingStateOf()

```ts
function bindingStateOf(
   resolver, 
   binding, 
   kind): object;
```

Resolution state of a binding: vigente / candidata (warning) / não resolvida (erro).

#### Parameters

##### resolver

[`EventDefinitionResolver`](#eventdefinitionresolver-2)

##### binding

`string`

##### kind

`"error"` \| `"message"` \| `"signal"` \| `"escalation"`

#### Returns

`object`

##### state

```ts
state: BindingState;
```

##### resolved?

```ts
optional resolved?: ResolvedEventDefinition;
```

***

### buildBindCommand()

```ts
function buildBindCommand(
   diagram, 
   node, 
   kind, 
   binding, 
   resolved, 
   description): Command;
```

ONE composite (1 undo): upsert the local mirror from the resolved artifact,
point the node's `eventDefinitionRef` at it and pin the binding.

#### Parameters

##### diagram

`BpmnDiagram`

##### node

`BpmnNode`

##### kind

`"error"` \| `"message"` \| `"signal"` \| `"escalation"`

##### binding

`string`

##### resolved

[`ResolvedEventDefinition`](#resolvedeventdefinition)

##### description

`string`

#### Returns

`Command`

***

### buildUnbindCommand()

```ts
function buildUnbindCommand(
   diagram, 
   node, 
   kind, 
   description, 
   nextRef?): Command;
```

ONE composite (1 undo): clear the binding (+ ref) and garbage-collect the
mirror when this node was its LAST usage — intentional composite: the
unlink inside the same atomic step is what makes the removal safe, so the
marker-based veto (which sees only top-level commands) is deliberately
bypassed here and only here.

#### Parameters

##### diagram

`BpmnDiagram`

##### node

`BpmnNode`

##### kind

`"error"` \| `"message"` \| `"signal"` \| `"escalation"`

##### description

`string`

##### nextRef?

`string`

#### Returns

`Command`

***

### eventBindingRule()

```ts
function eventBindingRule(resolver): ValidationRule;
```

Validation rule factory (§3b — the callActivityBindingRule mold): the host
wires it as a plugin `validationRules` entry with the SAME resolver it
injects. Unresolvable binding → ERROR `SIG_REF_MISSING`; resolvable but not
VIGENTE → WARNING `SIG_REF_STALE`. Badges paint through the existing
issueBadges overlay — glyph+text, never color alone.

#### Parameters

##### resolver

[`EventDefinitionResolver`](#eventdefinitionresolver-2)

#### Returns

`ValidationRule`

***

### ConnectionPreview()

```ts
function ConnectionPreview(): Element | null;
```

Dashed preview line while a connection gesture is in progress.

#### Returns

`Element` \| `null`

***

### BoundarySnapOverlay()

```ts
function BoundarySnapOverlay(): Element | null;
```

Border highlight while an event drags inside an activity's boundary snap
zone (Handoff 11 N-1): the host border strokes selected/2px with a 120ms
fade, plus a dot on the exact parametric anchor the drop will attach to.

#### Returns

`Element` \| `null`

***

### ReparentTargetOverlay()

```ts
function ReparentTargetOverlay(): Element | null;
```

Border highlight while a node drags over an expanded sub-process that would
adopt it on drop (F7 reparent-on-drop). Reuses the boundary-snap affordance
— the candidate container strokes selected/2px with the same 120ms fade — so
"highlight now, reparent on drop" reads identically to "highlight now, attach
on drop". No highlight ⇒ no reparent. Boundary snap has precedence, so this
and the boundary highlight are never armed at once.

#### Returns

`Element` \| `null`

***

### SelectionBoxOverlay()

```ts
function SelectionBoxOverlay(): Element | null;
```

Lasso rectangle during box selection.

#### Returns

`Element` \| `null`

***

### AlignmentGuidesOverlay()

```ts
function AlignmentGuidesOverlay(): Element | null;
```

Smart alignment guides + equal-spacing badges (Handoff 14 §1b) — draw-only.

#### Returns

`Element` \| `null`

***

### SearchPulseOverlay()

```ts
function SearchPulseOverlay(): Element | null;
```

Two expanding halo rings around the latest search hit (Handoff 14 §1c).
Pure CSS animation (2 rings, staggered); cleared when the outer ring ends.
Never rendered under reduced motion — the store field stays null.

#### Returns

`Element` \| `null`

***

### LayoutPreviewOverlay()

```ts
function LayoutPreviewOverlay(): Element | null;
```

Target-position ghosts of the pending auto-layout (Handoff 14 §1e): while
the Aplicar/Recusar card is open, every node the layout wants to move shows
a dashed outline at its PROPOSED position — the "DEPOIS" preview. Nothing
on the real diagram moves until the user applies. Stripped from exports
(TRANSIENT_SELECTORS).

#### Returns

`Element` \| `null`

***

### EventBindingOverlay()

```ts
function EventBindingOverlay(): Element | null;
```

Governed-binding chip (Handoff 16 §3b): every event carrying a pinned
`nome@semver` binding shows a mono chip below the node — the binding text
plus a GLYPH+TEXT state seal (✓ VIGENTE / ⚠ CANDIDATA / ✕ NÃO RESOLVIDA),
never color alone. Without a resolver the chip renders the binding text
with the declared-degradation notice glyph (~). Transient: never exported.

#### Returns

`Element` \| `null`

***

### sideOfAnchor()

```ts
function sideOfAnchor(p, rect): Side;
```

Which border of `rect` the anchor point sits on (nearest side).

#### Parameters

##### p

`Point`

##### rect

`Rect`

#### Returns

`Side`

***

### resolveEdgeRouterName()

```ts
function resolveEdgeRouterName(diagram, edge): string | undefined;
```

Router preference is **presentation metadata** (Handoff 10 §1.3), stored in
the `bpmnr:` extension channel so external tools ignore it and it round-trips:
a per-edge override in `edge.properties.router`, a diagram default in
`diagram.metadata.router`. Inheritance (§1.1): edge override → diagram default
→ the editor's configured router. Returns the resolved name, or `undefined`
to defer to the editor default.

#### Parameters

##### diagram

`BpmnDiagram`

##### edge

`BpmnEdge`

#### Returns

`string` \| `undefined`

***

### edgeObstacles()

```ts
function edgeObstacles(diagram, edge): Rect[];
```

Obstacle rects for routing `edge`: every flow node except the two endpoints
(pools/lanes are containers, not obstacles).

#### Parameters

##### diagram

`BpmnDiagram`

##### edge

`BpmnEdge`

#### Returns

`Rect`[]

***

### routedEdgeWaypoints()

```ts
function routedEdgeWaypoints(diagram, edge): Point[][];
```

Waypoints of the other already-routed edges, for the crossing cost.

#### Parameters

##### diagram

`BpmnDiagram`

##### edge

`BpmnEdge`

#### Returns

`Point`[][]

***

### routeEdge()

```ts
function routeEdge(
   diagram, 
   edge, 
   defaultRouter): EdgeGeometry | undefined;
```

Routes one edge with the resolved router (inheritance) and the obstacle
context built from the diagram. This is the single routing entrypoint the
R-2b interaction lifecycle drives (on load / on drag-release); the cheap
per-render path stays on the editor's default router. Returns `undefined`
when an endpoint is missing.

#### Parameters

##### diagram

`BpmnDiagram`

##### edge

`BpmnEdge`

##### defaultRouter

[`EdgeRouterFn`](#edgerouterfn)

#### Returns

`EdgeGeometry` \| `undefined`

***

### computeRoutedWaypoints()

```ts
function computeRoutedWaypoints(
   diagram, 
   edge, 
   defaultRouter): 
  | {
  waypoints: Point[];
  routed: boolean;
}
  | undefined;
```

Computes the cached A* waypoints for an edge — only when its resolved router
is the obstacle-avoiding `astar` (the cheap routers route per-render and are
not cached). Returns the waypoints plus `routed` (false = no corridor, the
fallback state). `undefined` for a non-astar edge or a missing endpoint.

#### Parameters

##### diagram

`BpmnDiagram`

##### edge

`BpmnEdge`

##### defaultRouter

[`EdgeRouterFn`](#edgerouterfn)

#### Returns

  \| \{
  `waypoints`: `Point`[];
  `routed`: `boolean`;
\}
  \| `undefined`

***

### rerouteConnectedEdges()

```ts
function rerouteConnectedEdges(
   nextDiagram, 
   movedNodeIds, 
   defaultRouter): EdgeReroute[];
```

Reroutes the auto A* edges connected to the moved nodes, against a POST-move
diagram snapshot. This is the central zero-recalc guarantee (Handoff 10
R-2b): only edges that (a) touch a moved node, (b) resolve to `astar`, and
(c) are not manual/external are re-routed — every unrelated or non-astar edge
is left exactly as it was. Each entry carries the fresh waypoints (cached
inside the same atomic move command by the caller) and the default-router
preview path used for the settle crossfade.

#### Parameters

##### nextDiagram

`BpmnDiagram`

##### movedNodeIds

`ReadonlySet`\<`string`\>

##### defaultRouter

[`EdgeRouterFn`](#edgerouterfn)

#### Returns

[`EdgeReroute`](#edgereroute)[]

***

### deriveAstarRoutes()

```ts
function deriveAstarRoutes(diagram, defaultRouter): BpmnDiagram;
```

Derives A* routes for `astar` edges that have no waypoints yet, returning a
new diagram with them cached (`routeMode: 'auto'`, plus `routeFallback` when
no corridor was found). Presentation derivation, NOT an edit — the caller
applies it outside the command stack (no undo entry, no ledger) at load /
import time. Edges that already carry waypoints are left untouched (a cached
auto route, or an external/manual one). Returns the same diagram reference
when nothing changed, so callers can cheaply skip.

#### Parameters

##### diagram

`BpmnDiagram`

##### defaultRouter

[`EdgeRouterFn`](#edgerouterfn)

#### Returns

`BpmnDiagram`

***

### astarAutoEdgeIds()

```ts
function astarAutoEdgeIds(
   diagram, 
   defaultRouter, 
   __namedParameters): string[];
```

Ids of edges that resolve to the `astar` router (Handoff 10 R-4). With
`includeManual: false` (the default for re-optimization) manual routes are
excluded so they are preserved.

#### Parameters

##### diagram

`BpmnDiagram`

##### defaultRouter

[`EdgeRouterFn`](#edgerouterfn)

##### \_\_namedParameters

###### includeManual

`boolean`

#### Returns

`string`[]

***

### routeAndSpread()

```ts
function routeAndSpread(diagram, edgeIds): AutoRoute[];
```

Routes each of `edgeIds` and spreads fan-out siblings into parallel 8px
corridors (§4, edge case 5). Two deterministic passes: (1) route every edge
to learn its chosen source side; (2) for each group of ≥2 edges sharing a
source AND that side, order the siblings by target position and re-route each
from a source port shifted `±8px` along the border — so the lanes are ordered
the same as the targets and never cross. A fan-out group falls back to its
pass-1 route for any sibling the forced port fails to route.

#### Parameters

##### diagram

`BpmnDiagram`

##### edgeIds

`string`[]

#### Returns

[`AutoRoute`](#autoroute)[]

***

### clearRoutingCommands()

```ts
function clearRoutingCommands(
   diagram, 
   defaultRouter, 
   __namedParameters): ClearRoutingResult;
```

Builds the "Limpar roteamento" edit (§1.4): re-optimize every automatic A*
edge and, by default, PRESERVE manual routes. `includeManual: true` (the
confirmed total reset) also converts manual routes back to auto. Returns the
per-edge commands (the caller wraps them in ONE undoable composite) plus the
real counts for the toast.

#### Parameters

##### diagram

`BpmnDiagram`

##### defaultRouter

[`EdgeRouterFn`](#edgerouterfn)

##### \_\_namedParameters

###### includeManual

`boolean`

#### Returns

[`ClearRoutingResult`](#clearroutingresult)

***

### isManualEdge()

```ts
function isManualEdge(edge): boolean;
```

An edge is **manual** when the user authored its route (R-3) — explicit
`routeMode: 'manual'`, OR waypoints carried in from an external import with
no `auto` marker (§1.4: imported waypoints are respected as manual). An
`'auto'` edge (cached A* route) is never manual, and an edge with no
waypoints is not manual. Manual routes are never rewritten by automatic
re-routing (§8.3).

#### Parameters

##### edge

`BpmnEdge`

#### Returns

`boolean`

***

### segmentIntersectsRect()

```ts
function segmentIntersectsRect(
   a, 
   b, 
   rect): boolean;
```

True if segment `a→b` crosses the interior of `rect` (Liang–Barsky, with a
small inset so an endpoint grazing the border is not a crossing).

#### Parameters

##### a

`Point`

##### b

`Point`

##### rect

`Rect`

#### Returns

`boolean`

***

### edgeRouteCollides()

```ts
function edgeRouteCollides(waypoints, obstacles): boolean;
```

True if any segment of `waypoints` crosses any obstacle rect.

#### Parameters

##### waypoints

`Point`[]

##### obstacles

`Rect`[]

#### Returns

`boolean`

***

### translateManualWaypoints()

```ts
function translateManualWaypoints(
   waypoints, 
   sourceMoved, 
   targetMoved, 
   dx, 
   dy): Point[];
```

Rigid translation of a manual route when its anchor node(s) move (edge case
6). If both endpoints move (same drag delta), the whole route shifts
rigidly; if only one endpoint moves, only that endpoint's waypoint follows —
the interior bends the user authored stay put. The route is NEVER re-routed.

#### Parameters

##### waypoints

`Point`[]

##### sourceMoved

`boolean`

##### targetMoved

`boolean`

##### dx

`number`

##### dy

`number`

#### Returns

`Point`[]

***

### translateManualEdges()

```ts
function translateManualEdges(
   nextDiagram, 
   movedNodeIds, 
   dx, 
   dy): ManualTranslation[];
```

Rigidly translates the manual edges connected to the moved nodes against a
POST-move diagram snapshot (edge case 6). Manual routes are never re-routed;
a translation that lands on a shape keeps its route and is flagged
(`collides`) so the ⚠ chip appears. Auto edges are handled separately by
[rerouteConnectedEdges](#rerouteconnectededges).

#### Parameters

##### nextDiagram

`BpmnDiagram`

##### movedNodeIds

`ReadonlySet`\<`string`\>

##### dx

`number`

##### dy

`number`

#### Returns

[`ManualTranslation`](#manualtranslation)[]

***

### backToAutoPatch()

```ts
function backToAutoPatch(
   diagram, 
   edge, 
   defaultRouter): object;
```

Patch that returns a manual edge to automatic routing (§6): recompute the A*
route now and cache it (`routeMode: 'auto'`), or — when the resolved router
is not `astar` — clear the waypoints so the edge follows the diagram's router
per render. Applied as ONE `updateEdgeCommand`, so undo restores the manual
route atomically.

#### Parameters

##### diagram

`BpmnDiagram`

##### edge

`BpmnEdge`

##### defaultRouter

[`EdgeRouterFn`](#edgerouterfn)

#### Returns

`object`

##### waypoints

```ts
waypoints: Point[] | null;
```

##### properties

```ts
properties: Record<string, unknown>;
```

***

### resolveRouter()

```ts
function resolveRouter(value, fallback): EdgeRouterFn;
```

Resolves an `edgeRouter` value (built-in name or custom function) to a router
function, falling back to `fallback` for `undefined` or an unknown name.

#### Parameters

##### value

`string` \| [`EdgeRouterFn`](#edgerouterfn) \| `undefined`

##### fallback

[`EdgeRouterFn`](#edgerouterfn)

#### Returns

[`EdgeRouterFn`](#edgerouterfn)

***

### useInteractions()

```ts
function useInteractions(svgRef): object;
```

Centralized pointer-gesture engine. One pointermove/pointerup pair on the
SVG serves every gesture (drag, connect, pan, lasso); per-frame updates go
through requestAnimationFrame and the canvas store, never through React
context state.

#### Parameters

##### svgRef

`RefObject`\<`SVGSVGElement` \| `null`\>

#### Returns

##### onNodePointerDown

```ts
onNodePointerDown: (event, nodeId) => void;
```

Node body pointerdown → select + begin (potential) drag.

###### Parameters

###### event

`PointerEvent`

###### nodeId

`string`

###### Returns

`void`

##### onPortPointerDown

```ts
onPortPointerDown: (event, nodeId) => void;
```

Port pointerdown → begin a connection gesture.

###### Parameters

###### event

`PointerEvent`

###### nodeId

`string`

###### Returns

`void`

##### onNodeDoubleClick

```ts
onNodeDoubleClick: (event, nodeId) => void;
```

Node double-click. One navigation gesture for the whole family (Handoff
5 §7.6): on an EXPANDED sub-process' title strip it drills down; on the
body (and every other node) it begins inline label editing — rename
stays discoverable via body double-click and the inspector's Label field.

###### Parameters

###### event

###### stopPropagation

() => `void`

###### clientX?

`number`

###### clientY?

`number`

###### nodeId

`string`

###### Returns

`void`

##### onResizePointerDown

```ts
onResizePointerDown: (event, nodeId, corner) => void;
```

Resize-handle pointerdown → begin a resize gesture.

###### Parameters

###### event

`PointerEvent`

###### nodeId

`string`

###### corner

[`ResizeCorner`](#resizecorner)

###### Returns

`void`

##### onEdgeHandlePointerDown

```ts
onEdgeHandlePointerDown: (event, edgeId, index, base) => void;
```

Route-handle pointerdown → begin dragging an existing waypoint (R-3).

###### Parameters

###### event

`PointerEvent`

###### edgeId

`string`

###### index

`number`

###### base

`Point`[]

###### Returns

`void`

##### onEdgeSegmentPointerDown

```ts
onEdgeSegmentPointerDown: (event, edgeId, segIndex, base) => void;
```

Segment pointerdown → insert a bend at the pointer and drag it (R-3). The
gesture only authors a manual route once the drag threshold is crossed.

###### Parameters

###### event

`PointerEvent`

###### edgeId

`string`

###### segIndex

`number`

###### base

`Point`[]

###### Returns

`void`

##### onEdgeWaypointDoubleClick

```ts
onEdgeWaypointDoubleClick: (event, edgeId, index, base) => void;
```

Double-click an interior waypoint → remove it (stays manual, undoable).

###### Parameters

###### event

###### stopPropagation

() => `void`

###### edgeId

`string`

###### index

`number`

###### base

`Point`[]

###### Returns

`void`

##### onCanvasPointerDown

```ts
onCanvasPointerDown: (event) => void;
```

Empty-canvas pointerdown → pan (middle button / space) or lasso (left).

###### Parameters

###### event

`PointerEvent`

###### Returns

`void`

##### onPointerMove

```ts
onPointerMove: (event) => void;
```

###### Parameters

###### event

`PointerEvent`

###### Returns

`void`

##### onPointerUp

```ts
onPointerUp: (event) => void;
```

###### Parameters

###### event

`PointerEvent`

###### Returns

`void`

##### cancelGestures

```ts
cancelGestures: () => void;
```

###### Returns

`void`

##### setPanKey

```ts
setPanKey: (held) => void;
```

###### Parameters

###### held

`boolean`

###### Returns

`void`

##### onNodeContextMenu

```ts
onNodeContextMenu: (event, nodeId) => void;
```

###### Parameters

###### event

`PointerEvent`\<`Element`\> \| `MouseEvent`\<`Element`, `MouseEvent`\>

###### nodeId

`string`

###### Returns

`void`

##### onEdgeContextMenu

```ts
onEdgeContextMenu: (event, edgeId) => void;
```

###### Parameters

###### event

`PointerEvent`\<`Element`\> \| `MouseEvent`\<`Element`, `MouseEvent`\>

###### edgeId

`string`

###### Returns

`void`

##### onCanvasContextMenu

```ts
onCanvasContextMenu: (event) => void;
```

###### Parameters

###### event

`PointerEvent`\<`Element`\> \| `MouseEvent`\<`Element`, `MouseEvent`\>

###### Returns

`void`

##### openContextMenuForSelection

```ts
openContextMenuForSelection: () => void;
```

N-5 keyboard (Menu / Shift+F10): opens for the first selected element.

###### Returns

`void`

##### armLongPress

```ts
armLongPress: (event, kind, targetId) => void;
```

###### Parameters

###### event

`PointerEvent`

###### kind

`"node"` \| `"edge"`

###### targetId

`string`

###### Returns

`void`

##### cancelLongPress

```ts
cancelLongPress: () => void;
```

###### Returns

`void`

##### centerOfNode

```ts
centerOfNode: (nodeId) => Point;
```

###### Parameters

###### nodeId

`string`

###### Returns

`Point`

***

### screenToWorld()

```ts
function screenToWorld(
   svg, 
   clientX, 
   clientY): Point;
```

Converts a pointer event position to world (diagram) coordinates.
Prefers `getScreenCTM().inverse()` (robust with nested transforms); falls
back to viewBox math when the CTM is unavailable (e.g. jsdom).

#### Parameters

##### svg

`SVGSVGElement`

##### clientX

`number`

##### clientY

`number`

#### Returns

`Point`

***

### zoomViewportAt()

```ts
function zoomViewportAt(
   viewport, 
   worldPoint, 
   factor): Viewport;
```

Zooms the viewport keeping the world point under the cursor fixed
(Figma-style). `factor` > 1 zooms out, < 1 zooms in.

#### Parameters

##### viewport

[`Viewport`](#viewport)

##### worldPoint

`Point`

##### factor

`number`

#### Returns

[`Viewport`](#viewport)

***

### panViewport()

```ts
function panViewport(
   viewport, 
   dxWorld, 
   dyWorld): Viewport;
```

#### Parameters

##### viewport

[`Viewport`](#viewport)

##### dxWorld

`number`

##### dyWorld

`number`

#### Returns

[`Viewport`](#viewport)

***

### applyWheelZoom()

```ts
function applyWheelZoom(
   store, 
   svg, 
   event): void;
```

Wheel handler: zoom at cursor (plain wheel) — trackpad-friendly.

#### Parameters

##### store

[`CanvasStore`](#canvasstore)

##### svg

`SVGSVGElement`

##### event

###### clientX

`number`

###### clientY

`number`

###### deltaY

`number`

#### Returns

`void`

***

### reducedMotion()

```ts
function reducedMotion(): boolean;
```

True when the user asked for reduced motion — animations collapse to 0.

#### Returns

`boolean`

***

### panViewportTo()

```ts
function panViewportTo(
   store, 
   targetX, 
   targetY, 
   cancelRef): void;
```

Animated viewport pan (240ms ease-out); instant under reduced motion.
Shared by the search bar (Handoff 14 §1c) and the lint panel (§1d) — the
ONE navigation animation, never re-implemented per surface.

#### Parameters

##### store

[`CanvasStore`](#canvasstore)

##### targetX

`number`

##### targetY

`number`

##### cancelRef

###### current

`number` \| `null`

#### Returns

`void`

***

### fitViewport()

```ts
function fitViewport(
   bounds, 
   aspectRatio, 
   padding?): Viewport;
```

Fits the viewport around a bounding box with padding.

#### Parameters

##### bounds

###### x

`number`

###### y

`number`

###### width

`number`

###### height

`number`

##### aspectRatio

`number`

##### padding?

`number` = `60`

#### Returns

[`Viewport`](#viewport)

***

### builtinGlobalCommands()

```ts
function builtinGlobalCommands(ctx): RegisteredGlobalCommand[];
```

#### Parameters

##### ctx

[`GlobalCommandContext`](#globalcommandcontext)

#### Returns

[`RegisteredGlobalCommand`](#registeredglobalcommand)[]

***

### builtinMenuItems()

```ts
function builtinMenuItems(target, ctx): RegisteredMenuItem[];
```

Conditional BUILT-INS per target kind (edge complete; node minimal —
pendencias §13). Body moved verbatim from `<ContextMenu>`; the equivalence
test pins ids/labels/order per scenario.

#### Parameters

##### target

[`MenuTarget`](#menutarget)

##### ctx

[`MenuBuildContext`](#menubuildcontext)

#### Returns

[`RegisteredMenuItem`](#registeredmenuitem)[]

***

### pluginMenuItems()

```ts
function pluginMenuItems(target, ctx): RegisteredMenuItem[];
```

PLUGIN sections (contract §N-5): `when()` decides presence against the REAL
target; `run()` only receives the command dispatcher.

#### Parameters

##### target

[`MenuTarget`](#menutarget)

##### ctx

[`MenuBuildContext`](#menubuildcontext)

#### Returns

[`RegisteredMenuItem`](#registeredmenuitem)[]

***

### pluginPadItems()

```ts
function pluginPadItems(target, ctx): RegisteredMenuItem[];
```

PLUGIN context-pad actions (Handoff 14 §1a contract) surfaced as registry
entries — the palette aggregates them for single-node targets so a pad-only
plugin action is still reachable by keyboard. Ids share the plugin prefix,
so a plugin exposing the same id in menu AND pad dedupes naturally.

#### Parameters

##### target

[`MenuTarget`](#menutarget)

##### ctx

[`MenuBuildContext`](#menubuildcontext)

#### Returns

[`RegisteredMenuItem`](#registeredmenuitem)[]

***

### CanvasProvider()

```ts
function CanvasProvider(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

###### initial?

`Partial`\<[`CanvasState`](#canvasstate)\>

###### children

`ReactNode`

#### Returns

`Element`

***

### useCanvasStore()

```ts
function useCanvasStore(): CanvasStore;
```

#### Returns

[`CanvasStore`](#canvasstore)

***

### useCanvasState()

```ts
function useCanvasState<S>(selector): S;
```

Granular subscription — re-renders only when the selected slice changes.

#### Type Parameters

##### S

`S`

#### Parameters

##### selector

(`state`) => `S`

#### Returns

`S`

***

### DiagramProvider()

```ts
function DiagramProvider(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`DiagramProviderProps`](#diagramproviderprops)

#### Returns

`Element`

***

### useDiagram()

```ts
function useDiagram(): DiagramContextValue;
```

#### Returns

[`DiagramContextValue`](#diagramcontextvalue)

***

### useDiagramOrNull()

```ts
function useDiagramOrNull(): DiagramContextValue | null;
```

Tolerant variant for PURE shapes (Handoff 17 ES-2): a shape that needs
sibling/child context (e.g. the collapsed event-subprocess trigger glyph)
reads it through this and DEGRADES to `null` outside a provider — so
standalone rendering (snapshots, server markup) never throws.

#### Returns

[`DiagramContextValue`](#diagramcontextvalue) \| `null`

***

### resolveEditorConfig()

```ts
function resolveEditorConfig(plugins?): EditorConfig;
```

#### Parameters

##### plugins?

[`BpmnPlugin`](#bpmnplugin)[] = `[]`

#### Returns

[`EditorConfig`](#editorconfig)

***

### EditorConfigProvider()

```ts
function EditorConfigProvider(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

###### plugins?

[`BpmnPlugin`](#bpmnplugin)[] = `[]`

###### children

`ReactNode`

#### Returns

`Element`

***

### useEditorConfig()

```ts
function useEditorConfig(): EditorConfig;
```

#### Returns

[`EditorConfig`](#editorconfig)

***

### useDismissal()

```ts
function useDismissal(
   id, 
   open, 
   close): void;
```

Registers an open overlay on the editor's SINGLE Esc dismissal stack
(Handoff 5 §11.1): while `open`, the overlay sits on top of the stack and
the next Esc calls `close` — popovers stack above peeks, peeks above the
selection, and only with nothing open does Esc climb the breadcrumb.
Never wire an independent Esc listener in an overlay component.

#### Parameters

##### id

`string`

##### open

`boolean`

##### close

() => `void`

#### Returns

`void`

***

### useKeyboardShortcuts()

```ts
function useKeyboardShortcuts(interactions): void;
```

Editor shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z / Ctrl+Y redo,
Ctrl/Cmd+A select-all, Ctrl/Cmd+C/X/V copy/cut/paste, Ctrl/Cmd+D duplicate,
Delete/Backspace removes the selection, Escape cancels gestures and clears
selection, arrows nudge selected nodes by 1px (Shift = grid step), Space
holds pan.

#### Parameters

##### interactions

###### onNodePointerDown

(`event`, `nodeId`) => `void`

Node body pointerdown → select + begin (potential) drag.

###### onPortPointerDown

(`event`, `nodeId`) => `void`

Port pointerdown → begin a connection gesture.

###### onNodeDoubleClick

(`event`, `nodeId`) => `void`

Node double-click. One navigation gesture for the whole family (Handoff
5 §7.6): on an EXPANDED sub-process' title strip it drills down; on the
body (and every other node) it begins inline label editing — rename
stays discoverable via body double-click and the inspector's Label field.

###### onResizePointerDown

(`event`, `nodeId`, `corner`) => `void`

Resize-handle pointerdown → begin a resize gesture.

###### onEdgeHandlePointerDown

(`event`, `edgeId`, `index`, `base`) => `void`

Route-handle pointerdown → begin dragging an existing waypoint (R-3).

###### onEdgeSegmentPointerDown

(`event`, `edgeId`, `segIndex`, `base`) => `void`

Segment pointerdown → insert a bend at the pointer and drag it (R-3). The
gesture only authors a manual route once the drag threshold is crossed.

###### onEdgeWaypointDoubleClick

(`event`, `edgeId`, `index`, `base`) => `void`

Double-click an interior waypoint → remove it (stays manual, undoable).

###### onCanvasPointerDown

(`event`) => `void`

Empty-canvas pointerdown → pan (middle button / space) or lasso (left).

###### onPointerMove

(`event`) => `void`

###### onPointerUp

(`event`) => `void`

###### cancelGestures

() => `void`

###### setPanKey

(`held`) => `void`

###### onNodeContextMenu

(`event`, `nodeId`) => `void`

###### onEdgeContextMenu

(`event`, `edgeId`) => `void`

###### onCanvasContextMenu

(`event`) => `void`

###### openContextMenuForSelection

() => `void`

N-5 keyboard (Menu / Shift+F10): opens for the first selected element.

###### armLongPress

(`event`, `kind`, `targetId`) => `void`

###### cancelLongPress

() => `void`

###### centerOfNode

(`nodeId`) => `Point` = `...`

#### Returns

`void`

***

### I18nProvider()

```ts
function I18nProvider(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

###### messages?

[`Messages`](#messages-2)

Injected dictionary. Omitted → English. Missing keys fall back to English.

###### children

`ReactNode`

#### Returns

`Element`

***

### useT()

```ts
function useT(): TFunction;
```

The active translator. Falls back to English outside a provider.

#### Returns

[`TFunction`](#tfunction)

***

### translate()

```ts
function translate(
   dict, 
   fallback, 
   key, 
   params?): string;
```

Resolve `key` against `dict`, falling back to `fallback` (always `EN`) per
key, then to the key itself as a last-resort dev signal. Applies plural
selection and `{token}` interpolation.

#### Parameters

##### dict

[`Messages`](#messages-2)

##### fallback

[`Messages`](#messages-2)

##### key

`string`

##### params?

[`TParams`](#tparams)

#### Returns

`string`

***

### mergeMessages()

```ts
function mergeMessages(...dicts): Messages;
```

Shallow-merge dictionaries left-to-right (later wins). Hosts use this to
extend an official dictionary with their own overrides without losing the
embedded EN fallback (missing keys still resolve to EN at lookup time).

#### Parameters

##### dicts

...[`Messages`](#messages-2)[]

#### Returns

[`Messages`](#messages-2)

***

### BpmnReplay()

```ts
function BpmnReplay(__namedParameters): Element;
```

Replay mode surface (Handoff 7B-2/7B-3): read-only `BpmnEditor` with the
frequency heatmap, ⌀ chips, deviations and the sampled-variant token, the
306px replay panel, and the violet "MODO REPLAY" pill. In 7B-3 the header
gains a version selector (executions filtered by bindRun) and the panel a
comparison card whose analysis attaches to the candidate's promotion — all by
host injection. Simulated (blue) and real (violet) data never mix.

#### Parameters

##### \_\_namedParameters

[`BpmnReplayProps`](#bpmnreplayprops)

#### Returns

`Element`

***

### ReplayOverlaySvg()

```ts
function ReplayOverlaySvg(__namedParameters): Element;
```

World-coordinate replay heatmap, mounted through the canvas `overlay` seam:
edge thickness = frequency (never colour alone — a11y) with a count label,
per-node ⌀ time chips (bottleneck in red), dashed-red deviation paths that
are clickable, and the violet sampled-variant token. Geometry, not CSS
filters, so it survives PNG/SVG export (§9).

#### Parameters

##### \_\_namedParameters

[`ReplayOverlaySvgProps`](#replayoverlaysvgprops)

#### Returns

`Element`

***

### ReplayPanel()

```ts
function ReplayPanel(props): Element;
```

The 306px replay panel that replaces the inspector in replay mode: import
summary, token-replay fitness, the deviation list (clickable → highlight on
canvas), and the sampled top variants with ▶ Reproduzir. Version comparison
and "attach to promotion" land in Handoff 7B-3.

#### Parameters

##### props

[`ReplayPanelProps`](#replaypanelprops)

#### Returns

`Element`

***

### diagramToReplayGraph()

```ts
function diagramToReplayGraph(diagram): ReplayGraph;
```

Host adapter (injection, not import): projects a BPMN diagram onto the
abstract `{ nodes, edges }` the headless `@buildtovalue/replay` engine expects.
Node `name` is the label (matched against log activity names), `id` stays the
diagram id so heatmap stats map straight back onto edges/nodes on the canvas.
`@buildtovalue/replay` never sees this — it only ever gets the plain graph.

#### Parameters

##### diagram

`BpmnDiagram`

#### Returns

`ReplayGraph`

***

### formatDuration()

```ts
function formatDuration(ms): string;
```

Human duration for the ⌀ time chips (matches the prototype: "40 s", "6,4 h",
"31 h", "1,8 dias"). Sub-10 hours keep one decimal; days always do.

#### Parameters

##### ms

`number`

#### Returns

`string`

***

### heatWidth()

```ts
function heatWidth(count, maxCount): number;
```

Heatmap stroke width from a frequency, √-scaled to a 2–8px band.

#### Parameters

##### count

`number`

##### maxCount

`number`

#### Returns

`number`

***

### useReplay()

```ts
function useReplay(
   diagram, 
   traces, 
   formatMs): UseReplayResult;
```

React controller around the headless replay aggregation. It builds the
abstract graph from the diagram (host adapter — the engine never imports the
model), aggregates the log once, and drives the sampled-variant playback
token (one token over a top variant, never one per event — cerca §0.3).

#### Parameters

##### diagram

`BpmnDiagram`

##### traces

`Iterable`\<`Trace`\>

##### formatMs

(`ms`) => `string`

#### Returns

[`UseReplayResult`](#usereplayresult)

***

### createInMemoryReviewStore()

```ts
function createInMemoryReviewStore(versionRef, seed?): ReviewStore;
```

Reference in-memory implementation — the optimistic mirror a host wraps
around its real persistence, and the store the tests/demos use. Keeps
`list()` identity stable between mutations.

#### Parameters

##### versionRef

`string`

##### seed?

readonly [`ReviewThread`](#reviewthread)[] = `[]`

#### Returns

[`ReviewStore`](#reviewstore)

***

### reviewThreadsRule()

```ts
function reviewThreadsRule(threads): PromotionRule;
```

Approval gate for review threads (Handoff 15 §2d) — the EXACT mold of
`soundnessPromotionRule`: a `PromotionRule` the host plugs into
`LifecycleConfig.promotionRules`, surfaced by `evaluateGates` as a
`rule:N` checklist gate and enforced by `promote()`.

Discipline (checklist 2d + C2 of H9): only OPEN threads block —
`resolved` and `dismissed` (justified, audited) release the gate, and
ORPHANED threads (anchor no longer in the diagram under promotion) never
block: the element already left. Blocking is an ERROR verdict, never a
warning.

The rule guards APPROVAL only (`target: 'active'`): every other transition
— including request-changes (candidate → in-review, §2e), whose very
trigger is an open thread — passes freely.

#### Parameters

##### threads

() => readonly [`ReviewThread`](#reviewthread)[]

#### Returns

`PromotionRule`

***

### ShapeLabel()

```ts
function ShapeLabel(__namedParameters): Element;
```

Multi-purpose centered label with rudimentary word wrapping.

#### Parameters

##### \_\_namedParameters

###### label

`string`

###### width

`number`

###### y

`number`

###### fontSize?

`number` = `12`

###### color?

`string` = `theme.text`

###### maxLines?

`number` = `3`

###### halo?

`boolean` = `false`

Legibility halo for labels drawn OUTSIDE their shape (events, gateways):
paints a canvas-colored stroke under the glyphs so text stays readable
over lanes and the dot grid (craft pack A2).

#### Returns

`Element`

***

### wrapLabel()

```ts
function wrapLabel(
   label, 
   charsPerLine, 
   maxLines): string[];
```

#### Parameters

##### label

`string`

##### charsPerLine

`number`

##### maxLines

`number`

#### Returns

`string`[]

***

### StartEventShape()

```ts
function StartEventShape(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### EndEventShape()

```ts
function EndEventShape(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### IntermediateCatchEventShape()

```ts
function IntermediateCatchEventShape(props): Element;
```

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### IntermediateThrowEventShape()

```ts
function IntermediateThrowEventShape(props): Element;
```

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### BoundaryEventShape()

```ts
function BoundaryEventShape(__namedParameters): Element;
```

Boundary event: a double-ring catch event that sits on its host's border.
Interrupting draws solid rings; non-interrupting (`cancelActivity: false`)
draws dashed rings.

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### TaskShape()

```ts
function TaskShape(props): Element;
```

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### UserTaskShape()

```ts
function UserTaskShape(props): Element;
```

Small person glyph in the top-left corner.

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### ServiceTaskShape()

```ts
function ServiceTaskShape(props): Element;
```

Gear glyph.

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### ScriptTaskShape()

```ts
function ScriptTaskShape(props): Element;
```

Script/scroll glyph.

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### SendTaskShape()

```ts
function SendTaskShape(props): Element;
```

Send task: filled envelope.

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### ReceiveTaskShape()

```ts
function ReceiveTaskShape(props): Element;
```

Receive task: outline envelope.

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### ManualTaskShape()

```ts
function ManualTaskShape(props): Element;
```

Manual task: hand glyph.

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### ExclusiveGatewayShape()

```ts
function ExclusiveGatewayShape(props): Element;
```

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### ParallelGatewayShape()

```ts
function ParallelGatewayShape(props): Element;
```

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### InclusiveGatewayShape()

```ts
function InclusiveGatewayShape(props): Element;
```

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### ComplexGatewayShape()

```ts
function ComplexGatewayShape(props): Element;
```

Complex gateway: the BPMN asterisk marker inside the diamond.

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### EventBasedGatewayShape()

```ts
function EventBasedGatewayShape(props): Element;
```

Event-based gateway: a pentagon inside a double ring, inside the diamond.

#### Parameters

##### props

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### SubProcessShape()

```ts
function SubProcessShape(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### BusinessRuleTaskShape()

```ts
function BusinessRuleTaskShape(__namedParameters): Element;
```

Business rule task (Handoff 5 §3.1): activity card with the DMN table
glyph top-left. When `properties.decisionRef` is set, a gold link badge
(pill straddling the top-right border) marks the bound decision — visual
only until F-B2 wires navigation (no click handler, default cursor; an
informative tooltip is allowed already).

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### CallActivityShape()

```ts
function CallActivityShape(__namedParameters): Element;
```

Call activity (Handoff 5 §3.2): invokes another process
(`properties.calledElement`) — white card with a THICK 3.5 border and a
static [+] marker (the contents live in the called process; drill happens
through the registry, not the canvas). When the host resolves the binding
(`properties.calledElementLabel`, e.g. "Billing@4.2.0"), a mono footer
shows it. The broken-reference state (CALL_REF_MISSING) is painted by the
canvas issue overlay (registry rule + CSS stroke override).

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### AgentTaskShape()

```ts
function AgentTaskShape(__namedParameters): Element;
```

Agent Lane (Handoff 12 §8): the agentTask reuses the standard activity
geometry/tokens — NO call-activity double border (that identity is the call
activity's). Its own marker is the 🤖 glyph (top-left, stroke 1.2) plus a
mono footer with the resolved `agnt-rsch@2.1.0` ref. AI gets no new node
color; autonomy/authorship live in the inspector and seals, never here. The
unresolved state reuses the CALL_REF_MISSING badge (canvas issue overlay via
the registry rule), exactly like the call activity.

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### DataStoreShape()

```ts
function DataStoreShape(__namedParameters): Element;
```

Data store: the BPMN cylinder (top ellipse + body rings).

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### GroupShape()

```ts
function GroupShape(__namedParameters): Element;
```

Group: a non-semantic artifact — a dashed rounded rectangle that visually
frames a set of nodes. The interior is `fill: none` so clicks fall through to
the framed flow nodes; only the border and label are interactive.

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### DataObjectShape()

```ts
function DataObjectShape(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### TextAnnotationShape()

```ts
function TextAnnotationShape(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### PoolShape()

```ts
function PoolShape(__namedParameters): Element;
```

Pool — a swimlane container with a rotated title band on the left. The body
has no fill so flow nodes placed on top stay visible and empty interior
clicks fall through to the canvas; select/drag via its border or band.

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### LaneShape()

```ts
function LaneShape(__namedParameters): Element;
```

Lane — a subdivision of a pool. Thinner title band, muted styling.

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### DefaultShape()

```ts
function DefaultShape(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`ShapeProps`](#shapeprops)

#### Returns

`Element`

***

### BpmnSimulator()

```ts
function BpmnSimulator(__namedParameters): Element;
```

Simulation mode as a drop-in surface: a read-only `BpmnEditor` with the
token overlay on the canvas, the touch-first gateway choice card at the
base, the 300px simulation panel in place of the inspector, and the blue
"MODO SIMULAÇÃO" pill. All behavior comes from the headless engine via
[useSimulation](#usesimulation); nothing here mutates the diagram. Registration is
pure injection — the session artifact is built here and handed to
[BpmnSimulatorProps.onRecord](#onrecord).

#### Parameters

##### \_\_namedParameters

[`BpmnSimulatorProps`](#bpmnsimulatorprops)

#### Returns

`Element`

***

### GatewayChoiceCard()

```ts
function GatewayChoiceCard(__namedParameters): Element;
```

The gateway choice, as a floating card at the **base of the canvas** — never
a popover on the node, so a finger never occludes the diagram (Handoff 7A
§3, touch-first). One ≥44px button per outgoing flow; the inclusive (OR)
gateway is a multi-select with an explicit confirm.

#### Parameters

##### \_\_namedParameters

[`GatewayChoiceCardProps`](#gatewaychoicecardprops)

#### Returns

`Element`

***

### SimulationOverlaySvg()

```ts
function SimulationOverlaySvg(__namedParameters): Element;
```

World-coordinate simulation layer, mounted through `BpmnCanvas`'s `overlay`
seam: exercised edges in green, a heated highlight on the node(s) holding a
token, and the animated token disc(s). The token rides the *real* edge
geometry via SVG `<animateMotion>` (PR 0 keeps that route off the nodes).

#### Parameters

##### \_\_namedParameters

[`SimulationOverlaySvgProps`](#simulationoverlaysvgprops)

#### Returns

`Element`

***

### SimulationPanel()

```ts
function SimulationPanel(props): Element;
```

The 300px simulation panel that replaces the inspector in simulation mode:
status + advance/restart, contextual boundary firing, path coverage,
session trail, and (via injection) ledger registration.

#### Parameters

##### props

[`SimulationPanelProps`](#simulationpanelprops)

#### Returns

`Element`

***

### edgeGeometryFor()

```ts
function edgeGeometryFor(
   edge, 
   source, 
   target, 
   edgeRouter): EdgeGeometry | null;
```

Recomputes the exact geometry the EdgeRenderer paints for an edge, so the
simulation token rides the *real* rounded route (the reason PR 0 exists).
Mirrors `EdgeRenderer`'s waypoints-vs-router branch: explicit waypoints win
(rounded with `EDGE_CORNER_RADIUS`), otherwise the editor's edge router.
Returns `null` when an endpoint is missing.

#### Parameters

##### edge

`BpmnEdge`

##### source

`BpmnNode` \| `undefined`

##### target

`BpmnNode` \| `undefined`

##### edgeRouter

[`EdgeRouterFn`](#edgerouterfn)

#### Returns

`EdgeGeometry` \| `null`

***

### nodeCenter()

```ts
function nodeCenter(node): object;
```

World-space center of a node (where a resting token sits).

#### Parameters

##### node

`BpmnNode`

#### Returns

`object`

##### x

```ts
x: number;
```

##### y

```ts
y: number;
```

***

### useSimulation()

```ts
function useSimulation(diagram, options?): UseSimulationResult;
```

React controller around the headless SimulationEngine. Owns the
engine and a CoverageTracker that survives resets (§3.1), mirrors
their state into React, and turns each step into token-travel animations
over the real edge geometry. All semantics live in the engine — this hook is
orchestration only.

#### Parameters

##### diagram

`BpmnDiagram`

##### options?

###### decisions?

`DecisionEvaluator`

#### Returns

[`UseSimulationResult`](#usesimulationresult)

***

### autosaveKey()

```ts
function autosaveKey(diagramId): string;
```

#### Parameters

##### diagramId

`string`

#### Returns

`string`

***

### writeAutosave()

```ts
function writeAutosave(diagram): Promise<void>;
```

Best-effort write — quota or privacy failures never break editing.

#### Parameters

##### diagram

`BpmnDiagram`

#### Returns

`Promise`\<`void`\>

***

### readAutosave()

```ts
function readAutosave(diagramId): AutosavePayload | null;
```

#### Parameters

##### diagramId

`string`

#### Returns

[`AutosavePayload`](#autosavepayload) \| `null`

***

### clearAutosave()

```ts
function clearAutosave(diagramId): void;
```

#### Parameters

##### diagramId

`string`

#### Returns

`void`

***

### createCanvasStore()

```ts
function createCanvasStore(partial?): CanvasStore;
```

#### Parameters

##### partial?

`Partial`\<[`CanvasState`](#canvasstate)\> = `{}`

#### Returns

[`CanvasStore`](#canvasstore)

***

### createStore()

```ts
function createStore<T>(initial): Store<T>;
```

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### initial

`T`

#### Returns

[`Store`](#store-2)\<`T`\>

***

### useStore()

```ts
function useStore<T, S>(store, selector): S;
```

Subscribes a component to a slice of the store. The component re-renders
only when the selected value changes (`Object.is`).

#### Type Parameters

##### T

`T` *extends* `object`

##### S

`S`

#### Parameters

##### store

[`Store`](#store-2)\<`T`\>

##### selector

(`state`) => `S`

#### Returns

`S`

***

### AnchorSeal()

```ts
function AnchorSeal(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`AnchorSealProps`](#anchorsealprops)

#### Returns

`Element`

***

### CanonicalPayloadCard()

```ts
function CanonicalPayloadCard(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`CanonicalPayloadCardProps`](#canonicalpayloadcardprops)

#### Returns

`Element`

***

### Cheatsheet()

```ts
function Cheatsheet(): Element | null;
```

"?" cheatsheet (Handoff 15 §2f) — generated, never written by hand:
shortcuts come from `KEYBOARD_SHORTCUT_CATALOG` (declared beside the very
handler that binds them; the sweep test fails on any undeclared key) and
the command list is `paletteEntries` — the SAME aggregate the Ctrl/Cmd+K
palette renders. Anti-drift by construction: there is no third list.

#### Returns

`Element` \| `null`

***

### paletteEntries()

```ts
function paletteEntries(target, ctx): RegisteredGlobalCommand[];
```

Ctrl/Cmd+K command palette (Handoff 15 §2f). The palette has NO list of its
own — every row comes from the registries that already exist: the extracted
`builtinMenuItems` (equivalence-tested against the ContextMenu), the plugin
`contextMenuItems`/`contextPadItems` contracts (respecting `when()` against
the REAL selection context) and `builtinGlobalCommands` (toolbar-level
actions). Anti-drift by construction: `paletteEntries` below is exported and
the sweep test asserts the rendered rows equal the aggregate of the sources
— in both directions. Execution is ALWAYS via `run()` → `execute` commands.

#### Parameters

##### target

[`MenuTarget`](#menutarget)

##### ctx

[`GlobalCommandContext`](#globalcommandcontext)

#### Returns

[`RegisteredGlobalCommand`](#registeredglobalcommand)[]

***

### fuzzyScore()

```ts
function fuzzyScore(label, query): number | null;
```

Substring beats subsequence; either must hold, case-insensitive.

#### Parameters

##### label

`string`

##### query

`string`

#### Returns

`number` \| `null`

***

### CommandPalette()

```ts
function CommandPalette(): Element | null;
```

#### Returns

`Element` \| `null`

***

### ContextMenu()

```ts
function ContextMenu(): Element | null;
```

#### Returns

`Element` \| `null`

***

### DiffView()

```ts
function DiffView(__namedParameters): Element;
```

Human-readable, structured rendering of a diagram diff.

#### Parameters

##### \_\_namedParameters

[`DiffViewProps`](#diffviewprops)

#### Returns

`Element`

***

### EdgePedigreeStrip()

```ts
function EdgePedigreeStrip(__namedParameters): Element | null;
```

Edge pedigree strip (Handoff 5 §5, escolha 4b — pedigree é de EDGE):
a 180px bottom band over `getEdgeChain`, time flowing → along the
1.5px rail. Each 70×48 card is a real miniature of that edge version —
the REGISTERED plugin shapes render the endpoints (aceite 10.5.7) —
closed versions hatched, the current one gold-bordered with the vigência
badge. "supersede ▸" in gold between cards; clicking a card opens the
DiffView of the two adjacent versions; hover surfaces the ledger hash.

#### Parameters

##### \_\_namedParameters

[`EdgePedigreeStripProps`](#edgepedigreestripprops)

#### Returns

`Element` \| `null`

***

### buildGovernedExample()

```ts
function buildGovernedExample(t): BpmnDiagram;
```

Empty-canvas teaching state (Handoff 15 §2f): shows ONLY while the diagram
has zero active elements (it disappears at the first element and comes back
if the canvas empties again — pure derivation, no flag), teaches the three
entry points (palette drag / Tab chaining / Ctrl+⌘K) and offers a ONE-CLICK
governed example — a diagram with a real version block (semver, status,
change summary, author), never a loose sample.

#### Parameters

##### t

[`TFunction`](#tfunction)

#### Returns

`BpmnDiagram`

***

### EmptyState()

```ts
function EmptyState(): Element | null;
```

#### Returns

`Element` \| `null`

***

### eventKindOf()

```ts
function eventKindOf(node): "error" | "message" | "signal" | "escalation" | null;
```

#### Parameters

##### node

`BpmnNode`

#### Returns

`"error"` \| `"message"` \| `"signal"` \| `"escalation"` \| `null`

***

### EventDefinitionSection()

```ts
function EventDefinitionSection(__namedParameters): Element | null;
```

#### Parameters

##### \_\_namedParameters

###### node

`BpmnNode`

###### readOnly

`boolean`

#### Returns

`Element` \| `null`

***

### GovernanceBreadcrumb()

```ts
function GovernanceBreadcrumb(__namedParameters): Element | null;
```

System component for hierarchical navigation (Handoff 5 §7.6/§10.3): every
level carries its semver + StatusBadge seal, so drilling never loses the
governance context. One pair of gestures for the whole family — double-
click goes down, breadcrumb (or Esc, when nothing else is open) goes up.
Serves the expanded sub-process today and the DMN surfaces in F-B2 — one
import for both (aceite 10.5.3).

#### Parameters

##### \_\_namedParameters

[`GovernanceBreadcrumbProps`](#governancebreadcrumbprops)

#### Returns

`Element` \| `null`

***

### isEventSubprocessStart()

```ts
function isEventSubprocessStart(diagram, node): boolean;
```

"Interrompe o escopo" (Handoff 17 ES-3, §4c; extended to boundaries in
Handoff 18 §5b): the interrupting toggle serves the two OMG catches whose
default the personality flips — an event-subprocess START (`isInterrupting`)
and a boundary event (`cancelActivity`). Both sides of every predicate come
from the core helpers (`startIsInterrupting`/`isNonInterrupting`), never a
local reimplementation. The commit is one undoable `updateNodeCommand`; the
OMG default (interrupting) is the ABSENT field, so toggling back to
interrupting removes the property entirely.

#### Parameters

##### diagram

`BpmnDiagram`

##### node

`BpmnNode`

#### Returns

`boolean`

***

### hasInterruptingToggle()

```ts
function hasInterruptingToggle(diagram, node): boolean;
```

The node kinds the interrupting toggle applies to (esub start or boundary).
A COMPENSATION boundary (Handoff 19 §6b) is excluded: it fires AFTER its
activity completes, so `cancelActivity` does not apply — the boundary is
ALWAYS solid and the toggle is absent for this kind.

#### Parameters

##### diagram

`BpmnDiagram`

##### node

`BpmnNode`

#### Returns

`boolean`

***

### InterruptingToggle()

```ts
function InterruptingToggle(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

###### node

`BpmnNode`

###### readOnly

`boolean`

#### Returns

`Element`

***

### LayoutProposalCard()

```ts
function LayoutProposalCard(): Element | null;
```

Auto-layout proposal card (Handoff 14 §1e, cerca §1.7 — nothing silent):
"Arrumar" only PROPOSES. While this card is open the canvas shows dashed
ghosts at the target positions (LayoutPreviewOverlay); Aplicar executes the
ONE composite (moves + rigid 📍 translations) and plays a 160ms crossfade
of the old positions (reduced-motion → none); Recusar — or Esc via the
dismissal stack — discards it and NOTHING changes. A proposal computed
against a diagram that has since changed is discarded automatically.

#### Returns

`Element` \| `null`

***

### LedgerStatus()

```ts
function LedgerStatus(__namedParameters): Element;
```

The "ledger íntegro ✓" chip, no longer decorative (Handoff 4 §B1):
clicking runs the host's verifier and shows the report in a popover —
intact chain with entry count, or the exact break point with the
expected vs. found hash.

#### Parameters

##### \_\_namedParameters

[`LedgerStatusProps`](#ledgerstatusprops)

#### Returns

`Element`

***

### LintPanel()

```ts
function LintPanel(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`LintPanelProps`](#lintpanelprops)

#### Returns

`Element`

***

### MiniMap()

```ts
function MiniMap(): Element;
```

Overview map: every node as a small rect plus the current viewport
rectangle. Clicking recenters the viewport on the clicked world point.

#### Returns

`Element`

***

### Palette()

```ts
function Palette(): Element | null;
```

Element palette. Clicking an item creates a node of that type near the
center of the current viewport (snapped to the grid) and selects it.

#### Returns

`Element` \| `null`

***

### PromotionPanel()

```ts
function PromotionPanel(__namedParameters): Element;
```

Formal promotion flow (Handoff 2 §B2): gate checklist + embedded diff +
per-role approvals + side-effects warning + activation toast. The UI only
REFLECTS the core state machine — gates come from `evaluateGates`,
transitions from `allowedTargets`, and the activation goes through
`promote()`, which re-enforces everything.

#### Parameters

##### \_\_namedParameters

[`PromotionPanelProps`](#promotionpanelprops)

#### Returns

`Element`

***

### PropertiesPanel()

```ts
function PropertiesPanel(): Element;
```

Inspector for the selected element: label, purpose (edges) and free-form
properties. Property values are JSON — strings can be typed directly.

Handoff 14 §1f: with an engine plugin registered (`plugin.engine`), an
executable activity ALSO gets an "Execução" tab — progressive disclosure
(job type + retries visible, the rest foldable) and the GATED deploy
(VIGENTE + assinada, or the "⚑ Deploy bloqueado" card). Without an engine
plugin the panel is byte-identical to before.

#### Returns

`Element`

***

### SearchPanel()

```ts
function SearchPanel(): Element | null;
```

#### Returns

`Element` \| `null`

***

### SignatureBadge()

```ts
function SignatureBadge(__namedParameters): Element;
```

Renders one of the three identity states (`valid` | `legacy` | `invalid`)
produced by `verificationState()` in `@buildtovalue/identity`.

#### Parameters

##### \_\_namedParameters

[`SignatureBadgeProps`](#signaturebadgeprops)

#### Returns

`Element`

***

### StatusBadge()

```ts
function StatusBadge(__namedParameters): Element;
```

Vigência seal (StatusBadge v2, Handoff 2 §B1): status pill + semver + a
meta line derived from the version record and the lifecycle engine —
"aguarda N aprovações" always reflects the engine config, never a constant.

#### Parameters

##### \_\_namedParameters

[`StatusBadgeProps`](#statusbadgeprops)

#### Returns

`Element`

***

### isTimerEvent()

```ts
function isTimerEvent(node): boolean;
```

True for event nodes whose kind is `timer` — the section's gate.

#### Parameters

##### node

`BpmnNode`

#### Returns

`boolean`

***

### formatTimerPreview()

```ts
function formatTimerPreview(parsed, t): string;
```

The human preview of a VALID parse result (exported for tests).

#### Parameters

##### parsed

`TimerParseResult`

##### t

[`TFunction`](#tfunction)

#### Returns

`string`

***

### TimerSection()

```ts
function TimerSection(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

###### node

`BpmnNode`

###### readOnly

`boolean`

#### Returns

`Element`

***

### Toolbar()

```ts
function Toolbar(__namedParameters): Element;
```

Default toolbar: undo/redo, zoom, fit, snap toggle, validation and
export (BPMN XML / JSON / SVG / PNG).

#### Parameters

##### \_\_namedParameters

[`ToolbarProps`](#toolbarprops)

#### Returns

`Element`

***

### VersionBanner()

```ts
function VersionBanner(): Element | null;
```

Fixed top-left canvas banner (Handoff 5 §5, 5b mitigada; aceite 10.5.6):
"🔒 VISUALIZANDO vX.Y · somente leitura · N elementos fechados nesta
versão". Present whenever the surface is NOT the editable active line —
a read-only view (BpmnViewer / host snapshot view) or a superseded
version (deprecated/retired). The per-element seal is hover/selection
only, so this banner is the always-visible version context.

#### Returns

`Element` \| `null`

***

### VersionTimeline()

```ts
function VersionTimeline(__namedParameters): Element;
```

A vertical timeline of diagram versions with status, effective date,
approvers and live channel — the visual "seal" of the governance history.
Presentational and controlled: it renders the `items` it's given and
reports selection through `onSelect`.

#### Parameters

##### \_\_namedParameters

[`VersionTimelineProps`](#versiontimelineprops)

#### Returns

`Element`

***

### buildApprovalPayloadFor()

```ts
function buildApprovalPayloadFor(input): Promise<CanonicalApprovalPayload>;
```

Assemble the canonical approval payload from a live diagram + ledger — the
`xmlHash` and `ledgerHead` the signature binds (Handoff 8 §3). Shared by the
PromotionPanel and the Studio ReviewScreen so both sign identical bytes.
`xmlHash` reuses core's `sha256Hex`; the payload shape comes from
`buildApprovalPayload` in `@buildtovalue/identity`.

#### Parameters

##### input

[`ApprovalPayloadInput`](#approvalpayloadinput)

#### Returns

`Promise`\<`CanonicalApprovalPayload`\>

***

### buildChangeRequestPayloadFor()

```ts
function buildChangeRequestPayloadFor(input): Promise<CanonicalChangeRequestPayload>;
```

Assemble the canonical request-changes payload (Handoff 15 §2e) — the same
`xmlHash`/`ledgerHead` binding as the approval, plus the version entity id,
the attached open threads and the mandatory comment. Decision is always
`"request-changes"` so verifiers can tell the acts apart.

#### Parameters

##### input

[`ChangeRequestPayloadInput`](#changerequestpayloadinput)

#### Returns

`Promise`\<`CanonicalChangeRequestPayload`\>

***

### eventExecutionModeOf()

```ts
function eventExecutionModeOf(diagram, node): EventExecutionMode | null;
```

#### Parameters

##### diagram

`BpmnDiagram`

##### node

`BpmnNode`

#### Returns

[`EventExecutionMode`](#eventexecutionmode) \| `null`

***

### payloadMappingsOf()

```ts
function payloadMappingsOf(node, key): PayloadMapping[];
```

The payload rows stored under the engine's payload key (absent → []).

#### Parameters

##### node

`BpmnNode`

##### key

`string`

#### Returns

[`PayloadMapping`](#payloadmapping)[]

***

### prunePayloadMappings()

```ts
function prunePayloadMappings(rows): PayloadMapping[] | undefined;
```

Clean-model pruning (E-4 reforço 7): rows with BOTH sides blank never
serialize, and an empty list removes the property entirely — the absent
field keeps the pre-E-4 bytes.

#### Parameters

##### rows

[`PayloadMapping`](#payloadmapping)[]

#### Returns

[`PayloadMapping`](#payloadmapping)[] \| `undefined`

***

### svgToString()

```ts
function svgToString(svg): string;
```

Serializes the live canvas SVG (self-contained for styles; images/fonts are
embedded by [exportSvg](#exportsvg)/[exportPng](#exportpng)).

#### Parameters

##### svg

`SVGSVGElement`

#### Returns

`string`

***

### downloadFile()

```ts
function downloadFile(
   filename, 
   content, 
   mime): void;
```

#### Parameters

##### filename

`string`

##### content

`string` \| `Blob`

##### mime

`string`

#### Returns

`void`

***

### exportSvg()

```ts
function exportSvg(svg, filename?): Promise<void>;
```

Downloads a self-contained SVG (styles, images and fonts embedded).

#### Parameters

##### svg

`SVGSVGElement`

##### filename?

`string` = `'diagram.svg'`

#### Returns

`Promise`\<`void`\>

***

### exportPng()

```ts
function exportPng(
   svg, 
   filename?, 
scale?): Promise<void>;
```

Renders the SVG onto a canvas and downloads a PNG (scale 2 by default).
Assets are embedded first so a cross-origin image never taints the canvas.

#### Parameters

##### svg

`SVGSVGElement`

##### filename?

`string` = `'diagram.png'`

##### scale?

`number` = `2`

#### Returns

`Promise`\<`void`\>

***

### paletteItemLabel()

```ts
function paletteItemLabel(t, item): string;
```

i18n-additive label: `palette.item.{id}` when the dictionary has it.

#### Parameters

##### t

(`key`, `params?`) => `string`

##### item

[`PaletteItem`](#paletteitem)

#### Returns

`string`

***

### insertPaletteItem()

```ts
function insertPaletteItem(item, deps): RuleVerdict;
```

Insert a palette item near the viewport center (grid-snapped, jittered) —
the ONE code path shared by the palette click and the ⌘K entry (ES-2
reforço 8): position math + factory + selection in a single place.

#### Parameters

##### item

[`PaletteItem`](#paletteitem)

##### deps

###### diagram

`BpmnDiagram`

###### registry

`NodeTypeRegistry`

###### store

[`CanvasStore`](#canvasstore)

###### t

(`key`, `params?`) => `string`

###### execute

(`command`) => `RuleVerdict`

###### announceVeto

(`reason`) => `void`

🔒 channel — a build that declines (reforço 7) announces here, never a silent no-op.

#### Returns

`RuleVerdict`

***

### paletteInsertCommand()

```ts
function paletteInsertCommand(item, ctx): PaletteInsertResult;
```

THE single insert factory of the palette (Handoff 17 ES-2, reforço 8): the
palette click and the ⌘K entry both resolve an item through this function —
one command, one source, never two code paths. Plain items produce an
`addNodeCommand`; composite items delegate to their [PaletteItem.build](#build).

#### Parameters

##### item

[`PaletteItem`](#paletteitem)

##### ctx

[`PaletteBuildContext`](#palettebuildcontext)

#### Returns

[`PaletteInsertResult`](#paletteinsertresult)

***

### buildEventSubprocessInsert()

```ts
function buildEventSubprocessInsert(ctx): object;
```

«Subprocesso de evento» (§4b): container + typed message start + NAMED
definition referenced — ONE composite (1 undo). The start+definition half
comes from the SHARED `typedMessageStartCommands` builder in the lint
package (Handoff 17 ES-4 anti-drift): the EVT_SUBPROC_START 0-starts
quick-fix composes the SAME builder — one FORM, one source (ES-0 decision
4), so every fresh drop is lint-clean by construction.

#### Parameters

##### ctx

[`PaletteBuildContext`](#palettebuildcontext)

#### Returns

`object`

##### command

```ts
command: Command;
```

##### selectId

```ts
selectId: string;
```

***

### buildEscalationBoundaryInsert()

```ts
function buildEscalationBoundaryInsert(ctx): PaletteInsertResult;
```

«Escalation (boundary)» (Handoff 18 §5b, decisão 3): a composite born
lint-clean — boundary + LOCAL escalation definition + ref in ONE undo,
`cancelActivity:false` explicit (the declared non-interrupting personality).
Reforço 7: a boundary needs a host — the drop must land on an activity
(attaches via the N-1 side/t anchor); on empty canvas it DECLINES with a
declared veto (announced on the 🔒), never an orphan boundary.

#### Parameters

##### ctx

[`PaletteBuildContext`](#palettebuildcontext)

#### Returns

[`PaletteInsertResult`](#paletteinsertresult)

***

### buildCompensationPairInsert()

```ts
function buildCompensationPairInsert(ctx): PaletteInsertResult;
```

The «Compensation (pair)» palette composite (Handoff 19 §6b): ONE undoable
command that drops the compensation boundary (⟲) on the host plus the handler
activity + linking association — the pair is born complete and lint-clean (the
ES-2 ruler). The handler + association come from the SHARED
`compensationHandlerCommands` builder (Handoff 19 §6c, one form): the SAME
source the COMP_BOUNDARY_NO_HANDLER quick-fix uses, so palette and fix never
drift. Drop demands an activity host (the EC-2 veto).

#### Parameters

##### ctx

[`PaletteBuildContext`](#palettebuildcontext)

#### Returns

[`PaletteInsertResult`](#paletteinsertresult)

***

### useAnchorCycle()

```ts
function useAnchorCycle(adapter, head): AnchorCycle;
```

Drives the anchor third-state cycle (Handoff 8 §4.3, cerca §1.3): given an
injected AnchorAdapter and the head to anchor, it attempts to anchor
and verify. On a transport failure it lands in `pending` (does NOT throw, does
NOT regress) and exposes `retry`; on success `anchored`; on mismatch `broken`.
With no adapter or no head it stays `none`.

#### Parameters

##### adapter

`AnchorAdapter` \| `undefined`

##### head

`AnchorHead` \| `undefined`

#### Returns

[`AnchorCycle`](#anchorcycle)

***

### BpmnDiffViewer()

```ts
function BpmnDiffViewer(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`BpmnDiffViewerProps`](#bpmndiffviewerprops)

#### Returns

`Element`

***

### BpmnViewer()

```ts
function BpmnViewer(__namedParameters): Element;
```

Lightweight, tree-shakeable read-only viewer (Handoff 11 N-7). Renders a
governed diagram with pan / wheel-zoom and read-only overlays (seals, ⚠) —
and nothing else: no editor, no command stack UI, no palette, no inspector,
no toolbar, no edit interactions. Import it from `@buildtovalue/react/viewer`
to keep the editor graph out of the bundle; the same component is also
re-exported from the package root for drop-in compatibility.

The render is byte-identical to `<BpmnDesigner readOnly>` (proven by
viewerEquivalence.test), so swapping a heavy read-only editor for this viewer
changes bundle size, never pixels.

#### Parameters

##### \_\_namedParameters

[`BpmnViewerProps`](#bpmnviewerprops)

#### Returns

`Element`

***

### ViewerCanvas()

```ts
function ViewerCanvas(__namedParameters): Element;
```

#### Parameters

##### \_\_namedParameters

[`ViewerCanvasProps`](#viewercanvasprops)

#### Returns

`Element`

***

### createSyncExecutor()

```ts
function createSyncExecutor(registry): ComputeExecutor;
```

Default executor — runs jobs synchronously in the calling thread. This IS the
current behaviour; a host that never opts into a worker gets exactly this.

#### Parameters

##### registry

[`JobRegistry`](#jobregistry)

#### Returns

[`ComputeExecutor`](#computeexecutor)

***

### createWorkerExecutor()

```ts
function createWorkerExecutor(worker): ComputeExecutor;
```

Worker-backed executor. The host constructs the worker (from the
`@buildtovalue/react/worker` entry) and passes it here; each `run` posts a
request and resolves when the matching response returns.

#### Parameters

##### worker

`Worker`

#### Returns

[`ComputeExecutor`](#computeexecutor)

***

### createWorkerHandler()

```ts
function createWorkerHandler(registry): (request) => WorkerResponse;
```

The pure request→response handler a worker entry wires to `onmessage`. Kept
separate (and exported) so the worker path is unit-testable without a real
Worker: feeding it a request yields the same result the SyncExecutor would.

#### Parameters

##### registry

[`JobRegistry`](#jobregistry)

#### Returns

(`request`) => [`WorkerResponse`](#workerresponse)

## References

### EditEffect

Re-exports [EditEffect](src/agent.md#editeffect)

***

### EditResult

Re-exports [EditResult](src/agent.md#editresult)

***

### nextNodeId

Re-exports [nextNodeId](src/agent.md#nextnodeid)

***

### addNode

Re-exports [addNode](src/agent.md#addnode)

***

### updateNodeConfig

Re-exports [updateNodeConfig](src/agent.md#updatenodeconfig)

***

### removeNode

Re-exports [removeNode](src/agent.md#removenode)

***

### addEdge

Re-exports [addEdge](src/agent.md#addedge)

***

### toggleDecorator

Re-exports [toggleDecorator](src/agent.md#toggledecorator)

***

### AgentEditorState

Re-exports [AgentEditorState](src/agent.md#agenteditorstate)

***

### AgentEditorAction

Re-exports [AgentEditorAction](src/agent.md#agenteditoraction)

***

### agentEditorReducer

Re-exports [agentEditorReducer](src/agent.md#agenteditorreducer)

***

### initEditorState

Re-exports [initEditorState](src/agent.md#initeditorstate)

***

### NodeLayout

Re-exports [NodeLayout](src/agent.md#nodelayout)

***

### layoutWorkflow

Re-exports [layoutWorkflow](src/agent.md#layoutworkflow)

***

### CopilotPanelProps

Re-exports [CopilotPanelProps](src/copilot.md#copilotpanelprops)

***

### CopilotPanel

Re-exports [CopilotPanel](src/copilot.md#copilotpanel)

***

### AgentStudio

Re-exports [AgentStudio](src/agent.md#agentstudio)

***

### AgentStudioProps

Re-exports [AgentStudioProps](src/agent.md#agentstudioprops)

***

### AgentSimulationRecord

Re-exports [AgentSimulationRecord](src/agent.md#agentsimulationrecord)

***

### proposeErrorBoundaryCommand

Re-exports [proposeErrorBoundaryCommand](src/agent.md#proposeerrorboundarycommand)
