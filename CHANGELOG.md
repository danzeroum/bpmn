# Changelog

All notable changes to the `@bpmn-react/*` packages are documented here. The project follows
[Semantic Versioning](https://semver.org): the public API surface — frozen by the
`apiSurface.test.ts` contract tests in each package — only breaks on major versions.

## Unreleased

### Library (`@bpmn-react/library`) — new package (Handoff 6, S-1)
- Generic, ecosystem-independent artifact catalog: the `ArtifactAdapter` contract
  (`list`/`get`/optional `subscribe`), the shared six-state `LifecycleStatus` vocabulary,
  thumbnails and actions as data (`ThumbnailSpec`, `ArtifactAction` descriptors).
- Headless catalog logic (`createLibraryCatalog`): text search, status/type filters,
  sorting (name/updated/status), chip counts — read-only by construction, no DOM.
- Adapter validation with warnings (never crashes); independence enforced by a dependency-graph
  test (no imports from `core`/`registry`/`react` — Handoff 6 §10.2).
- Workspace-only (`private: true`) until the npm-scope decision (pendências §1).

### Adapters BPMN (`@bpmn-react/adapters-bpmn`) — new package (Handoff 6, S-2)
- Concrete `ArtifactAdapter`s over the version registry: flow, persona, prompt, connector and
  policy adapters as thin configurations of one `createRegistryAdapter` factory; observer
  channel picks the relevant version via publication windows.
- DMN decisions as "mais um adapter" (`dmnDecisionAdapter`): `dmn:decision` nodes of registered
  diagrams, duck-typed on the DMN vocabulary so the package stays headless.
- Headless SVG thumbnails (`diagramThumbnail`, `decisionThumbnail`) drawn from diagram geometry
  with `--btv-*` token colors — thumbnails are data, never imported components (§3.1).
- The "recipe" acid-test fixture (`createRecipeAdapter`) + `tests/acidez.test.ts` proving the
  library works with a non-BPMN adapter alone (Handoff 6 §10.1).
- Workspace-only (`private: true`) until the npm-scope decision (pendências §1).

### Library React (`@bpmn-react/library-react`) — new package (Handoff 6, S-3)
- `<LibraryView>`: the Biblioteca gallery (visual spec Handoff 3 §5) — fixed status chips +
  dynamic type chips (one per adapter) with live counts, search, sort, card grid (adapter-drawn
  thumbnails placed as data) and the 316px detail drawer where optional fields → optional UI,
  never "N/A". Read-only: `onAction(ref, action)` descriptors are the only outbound call.
- `useLibrary` hook wiring the headless catalog to React state, including adapter invalidation
  (`subscribe`) and the `initialQuery`/`onQueryChange` URL-state seam (§10.7).
- UI half of the §10.1 acid test: the whole gallery exercised with the S-2 recipe adapter alone.
- Workspace-only (`private: true`) until the npm-scope decision (pendências §1).

### React (`@bpmn-react/react`)
- `StatusBadge` standalone mode (Handoff 6 §10.6): a new optional `seal` prop renders the same
  canonical seal from explicit data outside the editor contexts (Biblioteca/Revisão/Ledger
  screens). Editor behavior unchanged; fully retrocompatible.

### Example (`@bpmn-react/example`)
- `?library=1` surface: LibraryView over a demo registry (flow + persona adapters) plus the
  recipe acid-test adapter, with query state round-tripping to the URL; e2e coverage for
  filter/selection/action (`e2e/library.spec.ts`).

## 1.0.0 — 2026-07-07

First stable release. All packages (`core`, `react`, `registry`, `domain-example`, `cli`) move
to `1.0.0` together and are versioned in lockstep.

### Core (`@bpmn-react/core`)
- BPMN model with **temporal immutability**: versioned elements are closed
  (`removedInVersion`) and superseded (`supersedesEdgeId`), never deleted.
- Governed lifecycle `draft → test → candidate → active → deprecated → retired` with a
  configurable state machine (`LifecycleConfig`), multi-role promotion approval and no direct
  `deprecated → active` reactivation.
- `CommandStack` with git-like cursor, composite commands and rule-engine vetoes;
  `EventBus` with priorities, cancellation and payload transformation.
- Append-only **SHA-256 hash-chained audit ledger** (`verify()` detects tampering) with an
  `AuditSink` seam for durable storage.
- Structured diff (`computeDiff`, `supersede` ops) and `normalizeForDiff` round-trip checks.
- **BPMN 2.0 XML** import/export with full DI (shapes, bounds, waypoints), pools
  (`collaboration`/`participant`), lanes (`laneSet`/`lane`/`flowNodeRef`), `messageFlow`,
  `association`, and vendor extensions in the `bpmnr` namespace. XXE-safe parser (DOCTYPE
  rejected by construction).
- Validation engine with built-in rules (orphan edges, self-connections, missing start event,
  unreachable nodes, event flow direction, stale lane refs) and plugin-provided rules.

### React (`@bpmn-react/react`)
- Native SVG canvas (viewBox pan/zoom, `getScreenCTM` coordinate math) with granular
  `useSyncExternalStore` state — no external state library.
- 14 built-in shapes including pool/lane swimlane containers rendered behind the flow.
- Gestures: drag (grid snap), connect with live rule feedback, resize, lasso select, keyboard
  shortcuts, inline label editing (double-click), **interactive lane membership** (drop a node
  into a lane to join it — undoable as one step, with drop-target highlight).
- Palette, properties panel, toolbar, minimap, status badge, diff view, decoupled
  `VersionTimeline`; SVG and PNG export.
- Verified under React StrictMode; documented scale target of ~300–400 elements.

### Registry (`@bpmn-react/registry`)
- Queryable version registry with temporal validity (`activeAt(date, channel)`), publication
  channels/environments, lineage, dual changelog and execution pinning (`bindRun` /
  `verifyRunBinding`), plus a `RegistrySink` persistence seam.

### CLI (`@bpmn-react/cli`)
- Headless `validate`, `export` (xml/json), `diff`, `promote`/`approve` with governance gates,
  and `registry` subcommands (`add`, `history`, `publish`, `active`, `diff`, `bind-run`).

### Known boundaries (documented, not regressions)
See [`docs/limitations.md`](docs/limitations.md): single-process XML profile (no multi-pool
collaborations, boundary events or event definitions yet), no obstacle-avoiding edge router
(routing is pluggable; planned as a 1.x minor), pinch-zoom/touch menus not implemented.
