# @buildtovalue/core

## 1.1.0

### Minor Changes

- 9bee584: Handoff 14 U-6 — auto-layout as a PROPOSAL, the engine bridge tab, and the
  public comparative matrix. `@buildtovalue/react`: "Arrumar" now only proposes
  (`buildLayoutProposal` → target-position ghosts + the Aplicar/Recusar card
  with mock-format counts); applying is ONE undoable composite that also
  rigidly translates manual 📍 routes via the SAME `translateManualEdges` (R-3)
  used by the drag — endpoints follow their node's delta, authored bends never
  move, routes are never re-routed — and plays a 160ms crossfade of the old
  positions (reduced-motion → none); refusing (or Esc, dismissal stack) changes
  nothing, and a stale proposal discards itself. New `BpmnPlugin.engine`
  (`EngineBridge`) contract turns on the properties panel's "Execução" tab for
  executable activities: progressive disclosure (job type + retries visible,
  engine-namespaced extras foldable) and a GATED deploy — only an ACTIVE
  (VIGENTE) and signed version deploys; otherwise the "⚑ Deploy bloqueado → Ir
  para promoção" card. `@buildtovalue/core`: imports without BPMN DI now apply
  the layered layout directly (declared warning; grid fallback for pools/lanes),
  and the layout determinism test runs 10×. `@buildtovalue/conformance`: new
  `THIRD_PARTY_DECLARATIONS` renders the "Comparativo — declarações de
  terceiros" section of CONFORMANCE.md — third-party cells reflect ONLY what
  the linked vendor documentation declares, never our own claims.
- 8ba65ae: Handoff 15 V-1 — `diffDiagrams(base, target): DiffEntry[]`, the review-grade
  semantic diff (§2a). Built ON `computeDiff` (untouched): classifies every
  element change into `added | removed | moved | changed | rerouted` — a node
  update that only moves is `moved` (with `from`/`to` for the ghost + arrow); a
  node that moves AND changes is `changed` with `moved: true`; an edge whose
  only change is `waypoints` is `rerouted` (its own category — a re-route never
  pollutes ΔN nor `changed`); a `removedInVersion` transition reads as
  removed/added (a closed element IS removed for review); supersession reads as
  `changed` with a `supersededBy` breadcrumb (hard replacement) or as the
  removed/added pair (temporal shape). `changes` never includes
  x/y/waypoints/removedInVersion — its size is the ΔN badge. Entries come in a
  STABLE graph-reading order (topological rank from the source nodes, removed
  elements ranked by the BASE graph, ties by base position then id) — a pure
  function of content, proven by a map-insertion shuffle test and a 10×
  determinism test.
- 943006f: Backend hardening round (melhorias Bloco A): `canonicalJsonExact` + versioned
  audit-ledger hash recipe (v2 — exact JSON of the whole entry; legacy v1 chains
  keep verifying), O(n²) XML parsing fix, flow classification hoisted to core
  (`isFlowNode`/`isFlowEdge`/`flowScopeOf`), structural validation in
  `JsonSerializer.deserialize`, multi-process import warning, TAB/CR attribute
  escaping, per-lane publication index in `VersionRegistry`, stricter CLI flag
  parsing, and error-taxonomy alignment (`SimulationError`/`AdapterError`/DMN/
  CLI errors now extend `BpmnError`).
- 9bee584: Market-parity editing round (referência itens 1–7): context pad with one-click
  quick-append beside the selected node; dependency-free layered auto-layout
  (`computeLayeredLayout`) with a toolbar Arrange action, align/distribute for
  multi-selections and smart drag guides; diagram find bar (Ctrl/Cmd+F) with
  match walking and scope-aware centering; native `complexGateway` support
  (registry, shape, XML round-trip); and the new `@buildtovalue/lint` package —
  bpmnlint-style etiquette and executability rule profiles with stable issue
  codes.
