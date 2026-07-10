# Architecture

bpmn-react follows a strict three-layer separation:

```
┌────────────────────────────────────────────────────────────┐
│ @buildtovalue/react — presentation                           │
│   SVG canvas (viewBox pan/zoom) · shapes · gestures        │
│   granular external store (useSyncExternalStore)           │
│   editor chrome (toolbar, palette, inspector, minimap)     │
├────────────────────────────────────────────────────────────┤
│ @buildtovalue/core — domain engine (zero React, zero deps)   │
│   model + registry · EventBus · CommandStack               │
│   LifecycleEngine · RuleEngine · ValidationEngine          │
│   diff · AuditLedger (SHA-256 chain) · geometry            │
│   MiniXmlParser/XmlBuilder · BpmnXmlConverter (BPMN DI)    │
└────────────────────────────────────────────────────────────┘
```

## Key decisions

### Dictionaries, not arrays
`diagram.nodes` / `diagram.edges` are `Record<id, element>` — O(1) lookup during 60fps pointer
handling, and duplicate ids are impossible by construction.

### Temporal immutability
Versioned elements are never deleted. Outside `draft`, removal *closes* the element
(`removedInVersion`) and replacement links the successor (`supersedesEdgeId`). The whole history
stays queryable (`getEdgeChain`) and auditable.

### Commands + git-like cursor
Every mutation is a `Command { execute, undo, toAuditEvent }`. The `CommandStack` owns the current
diagram; executing after undos discards the redo branch (like committing after checkout).
`CompositeCommand` groups gesture-level operations into one undo step. A `CommandInterceptor`
(implemented by the `RuleEngine`) can veto commands before they run.

### Two kinds of state, two containers
- **Domain state** (the diagram) lives in the `CommandStack`, exposed via `DiagramContext`.
- **Visual state** (viewport, selection, in-flight gestures) lives in a tiny external store
  consumed through `useCanvasState(selector)` — components re-render only when their selected
  slice changes, so dragging a node never re-renders the rest of the tree.

### viewBox viewport
Pan/zoom mutate the SVG `viewBox`, keeping text and strokes crisp at every zoom level.
Screen→world conversion uses `getScreenCTM().inverse()` with a viewBox-math fallback.
Wheel zoom is cursor-centered.

### Gesture engine
One `pointermove`/`pointerup` pair on the SVG serves all gestures (drag, connect, resize, pan,
lasso). Moves are throttled through `requestAnimationFrame`; a 4px threshold separates clicks from
drags; `setPointerCapture` keeps fast drags attached.

### Events with priority and veto
The `EventBus` fires handlers in priority order; returning `false` cancels, returning a value
transforms the payload. Audit listeners subscribe at low priority so they observe final payloads.

### Security
The bundled XML parser rejects `DOCTYPE`/DTD outright (immune to XXE/entity expansion), and the
`XmlBuilder` escapes all attribute/text content. The audit ledger chains SHA-256 hashes
(Web Crypto) so tampering is detectable.
