# Known limitations & roadmap

Documented deliberately so expectations are managed — none of these fail silently.

## BPMN coverage
- The XML converter implements the [documented profile](format-spec.md), not the full OMG spec.
- **Pools & lanes** are supported as single-process swimlanes (see
  [format-spec](format-spec.md#pools--lanes)): pools ↔ `collaboration`/`participant`, lanes ↔
  `laneSet`/`lane`/`flowNodeRef`, `messageFlow` in the collaboration and `association` for
  artifacts. Lane membership is interactive (drop a node into a lane to join it, undoable).
  Multi-pool collaborations with one process per pool are not modelled
  (tracked in [`pendencias.md`](../pendencias.md)).
- Boundary events, message/timer event definitions, call activities and nested sub-process content
  are ignored with import warnings.
- The XML parser validates structure, not the official XSD.

## Rendering & performance
- Optimized for diagrams up to **~300–400 elements** (memoized nodes/edges, granular store
  subscriptions, rAF-throttled gestures). Beyond that, SVG DOM size becomes the bottleneck.
  **Roadmap (post-1.0)**: viewport virtualization and a canvas-rendering fallback.
- Edge routing is Bézier (default) or simple orthogonal; there is no obstacle-avoiding router yet.
- Text rendering uses SVG `<text>` with rudimentary word wrapping (no auto-fit).

## Collaboration
- No built-in multi-user collaboration/CRDT. The command stream (`command.post` events with
  serializable commands) is the intended integration point. **Roadmap**: reference adapter.

## Export
- PNG export requires a fully self-contained SVG: inline styles/fonts only. External webfonts or
  cross-origin images would taint the canvas and the export fails with a clear error. The default
  shapes only use attribute styling, which is safe.

## Interaction
- Touch gestures: basic pointer events work on touch devices, but pinch-zoom and long-press menus
  are not implemented.
- Labels can be edited inline on the canvas (double-click a node) or in the properties panel.
- Dragging a pool/lane moves only the container, not the nodes inside it; lanes do not auto-reflow
  siblings when resized. Both are candidates for a post-1.0 "swimlane layout" pass.

## Governance
- The library records `UserContext` data as given; authentication/authorization is the host
  application's responsibility.
- `AuditLedger` and `VersionRegistry` keep entries in memory; durable storage happens through their
  `AuditSink` / `RegistrySink` seams.
- `VersionTimeline` (React) is presentational and decoupled — it renders a plain
  `VersionTimelineItem[]`, so the host maps its registry (or any version source) to that shape and
  the React layer never depends on `@bpmn-react/registry`.
