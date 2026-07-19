# Changelog

All notable changes to the `@buildtovalue/*` packages are documented here. The project follows
[Semantic Versioning](https://semver.org): the public API surface — frozen by the
`apiSurface.test.ts` contract tests in each package — only breaks on major versions.

## Unreleased

### Changed — package scope rename `@bpmn-react/*` → `@buildtovalue/*` (2026-07-10)
- The npm organization `@buildtovalue` was created and the whole monorepo was renamed in a
  dedicated PR (package names, workspace dependencies, imports, docs, CONFORMANCE, lockfile).
  It is a **pure scope swap** — the path after the scope is unchanged for every package, so the
  migration is mechanical: replace `@bpmn-react/` with `@buildtovalue/` in your imports and
  `package.json`. Applies to all 25 packages, e.g. `@bpmn-react/core` → `@buildtovalue/core`,
  `@bpmn-react/react` → `@buildtovalue/react`, `@bpmn-react/cli` → `@buildtovalue/cli`, …
- The provisional `"private": true` flags were removed — every library package now publishes;
  only `example`, `domain-example` and `healthcare` (apps/demos) stay private.
- **Deliberate carve-outs (unchanged on purpose):** the XML extension namespace prefix `bpmnr:`
  and the CSS prefixes `bpmnr-` / `btv-` stay (renaming them would break the round-trip of
  already-exported files and host theming); the CLI binary stays `bpmn-react`
  (`bpmn-react certify …`) — renaming the command is a separate product decision.

### Library (`@buildtovalue/library`) — new package (Handoff 6, S-1)
- Generic, ecosystem-independent artifact catalog: the `ArtifactAdapter` contract
  (`list`/`get`/optional `subscribe`), the shared six-state `LifecycleStatus` vocabulary,
  thumbnails and actions as data (`ThumbnailSpec`, `ArtifactAction` descriptors).
- Headless catalog logic (`createLibraryCatalog`): text search, status/type filters,
  sorting (name/updated/status), chip counts — read-only by construction, no DOM.
- Adapter validation with warnings (never crashes); independence enforced by a dependency-graph
  test (no imports from `core`/`registry`/`react` — Handoff 6 §10.2).

### Adapters BPMN (`@buildtovalue/adapters-bpmn`) — new package (Handoff 6, S-2)
- Concrete `ArtifactAdapter`s over the version registry: flow, persona, prompt, connector and
  policy adapters as thin configurations of one `createRegistryAdapter` factory; observer
  channel picks the relevant version via publication windows.
- DMN decisions as "mais um adapter" (`dmnDecisionAdapter`): `dmn:decision` nodes of registered
  diagrams, duck-typed on the DMN vocabulary so the package stays headless.
- Headless SVG thumbnails (`diagramThumbnail`, `decisionThumbnail`) drawn from diagram geometry
  with `--btv-*` token colors — thumbnails are data, never imported components (§3.1).
- The "recipe" acid-test fixture (`createRecipeAdapter`) + `tests/acidez.test.ts` proving the
  library works with a non-BPMN adapter alone (Handoff 6 §10.1).

### Library React (`@buildtovalue/library-react`) — new package (Handoff 6, S-3)
- `<LibraryView>`: the Biblioteca gallery (visual spec Handoff 3 §5) — fixed status chips +
  dynamic type chips (one per adapter) with live counts, search, sort, card grid (adapter-drawn
  thumbnails placed as data) and the 316px detail drawer where optional fields → optional UI,
  never "N/A". Read-only: `onAction(ref, action)` descriptors are the only outbound call.
- `useLibrary` hook wiring the headless catalog to React state, including adapter invalidation
  (`subscribe`) and the `initialQuery`/`onQueryChange` URL-state seam (§10.7).
- UI half of the §10.1 acid test: the whole gallery exercised with the S-2 recipe adapter alone.
- **S-6**: `initialSelection`/`onSelectionChange` on `LibraryView`/`useLibrary` — selection joins
  the URL-state seam so back-navigation restores filters AND selection (§10.7).

### Studio (`@buildtovalue/studio`) — new package (Handoff 6, S-4)
- `StudioShell`: header with the three-screen nav (Biblioteca | Revisão | Auditoria) and
  hash-based navigation — state + URL hash, no external router (§11). Auditoria arrives in S-5.
- `ReviewScreen` (Revisão do Aprovador, §5): queue derived from the lifecycle engine's gates
  (never re-implemented in the UI), review blocks in spec order (header → change summary →
  DiffView → 2×2 verificações from REAL calls: `analyzeSoundness`/`certifyXml`/`verifyLedger`/
  `resolveCallActivities` → decision), keyboard-navigable queue.
- Decisions as immutable ledger entries: `approvePromotion` (`APPROVAL_RECORDED`, via
  `engine.approve`) and `rejectPromotion` (`PROMOTION_REJECTED`, justification min 10 chars).
  Approving NEVER activates — separação solicitante/aprovador (§11).
- Headless halves exported and DOM-free testable.
- **S-5 — Ledger Explorer (Auditoria, §6)**: pure event categorization + filters
  (`categorizeEntry`/`filterEntries` — the same filter feeds the trail and the XES export),
  vertical trail with per-category dots, detail column with visible chaining (seq/hash/prev)
  and the gold ATTESTATION block, "Verificar cadeia" via `verifyLedger()` (green n/n banner +
  head hash + `VerificationReport.json`; broken → exact `firstBreak` index with later entries
  marked untrusted), "Exportar XES" honouring current filters, keyboard-navigable trail.

### React (`@buildtovalue/react`)
- `StatusBadge` standalone mode (Handoff 6 §10.6): a new optional `seal` prop renders the same
  canonical seal from explicit data outside the editor contexts (Biblioteca/Revisão/Ledger
  screens). Editor behavior unchanged; fully retrocompatible.

### Example (`@buildtovalue/example`)
- `?library=1` surface: LibraryView over a demo registry (flow + persona adapters) plus the
  recipe acid-test adapter, with query state round-tripping to the URL; e2e coverage for
  filter/selection/action (`e2e/library.spec.ts`).
- `?studio=1` surface: the full Studio shell over a demo world (registry, ledger, one pending
  promotion at 1/2 approvals); e2e for the approve and reject flows, real verification cards
  and keyboard-only decision (`e2e/studio.spec.ts`).
- **S-6 — integração fim-a-fim**: the demo world registers every artifact kind (flow, persona,
  prompt, connector, política, a DMN decision inside the flow, plus the recipe fixture — 7 type
  chips), the user role is switchable (Bruna/Carla — the queue follows the engine), Biblioteca
  filters+selection round-trip to the URL, and "Abrir no Designer" opens the real editor with
  back-navigation restoring the gallery state (§10.7). `e2e/integration.spec.ts` covers the
  whole cycle: Biblioteca → abrir → Revisão → aprovar → Auditoria shows the new entry and the
  chain verifies n+1/n+1.

## 1.0.0 — 2026-07-07

First stable release. All packages (`core`, `react`, `registry`, `domain-example`, `cli`) move
to `1.0.0` together and are versioned in lockstep.

### Core (`@buildtovalue/core`)
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

### React (`@buildtovalue/react`)
- Native SVG canvas (viewBox pan/zoom, `getScreenCTM` coordinate math) with granular
  `useSyncExternalStore` state — no external state library.
- 14 built-in shapes including pool/lane swimlane containers rendered behind the flow.
- Gestures: drag (grid snap), connect with live rule feedback, resize, lasso select, keyboard
  shortcuts, inline label editing (double-click), **interactive lane membership** (drop a node
  into a lane to join it — undoable as one step, with drop-target highlight).
- Palette, properties panel, toolbar, minimap, status badge, diff view, decoupled
  `VersionTimeline`; SVG and PNG export.
- Verified under React StrictMode; documented scale target of ~300–400 elements.

### Registry (`@buildtovalue/registry`)
- Queryable version registry with temporal validity (`activeAt(date, channel)`), publication
  channels/environments, lineage, dual changelog and execution pinning (`bindRun` /
  `verifyRunBinding`), plus a `RegistrySink` persistence seam.

### CLI (`@buildtovalue/cli`)
- Headless `validate`, `export` (xml/json), `diff`, `promote`/`approve` with governance gates,
  and `registry` subcommands (`add`, `history`, `publish`, `active`, `diff`, `bind-run`).

### Known boundaries (documented, not regressions)
See [`docs/limitations.md`](docs/limitations.md): single-process XML profile (no multi-pool
collaborations, boundary events or event definitions yet), no obstacle-avoiding edge router
(routing is pluggable; planned as a 1.x minor), pinch-zoom/touch menus not implemented.
