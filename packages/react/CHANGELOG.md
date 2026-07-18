# @buildtovalue/react

## 1.1.0

### Minor Changes

- 9bee584: Handoff 14 U-2 — context pad refined to the design spec (panel 1a): spec
  composition (append task/XOR/end, connect, 5th slot PLUGGABLE via the new
  `contextPadItems` plugin contract, ⋯ opens the full context menu — where the
  new delete built-in lives); `Tab` appends a connected task to the single
  selected node (mouse-free chaining, scoped to canvas focus); spec geometry
  (pad 8px outside the selection halo, created node +140px from the source
  center); viewport-edge flip instead of clipping; ≥44px touch targets on
  coarse pointers; and the binding hit-test precedence test (resize > pad >
  ports > boundary-snap > reparent).
- 9bee584: Handoff 14 U-4 — search refined to the design spec (panel 1c): matches now
  cover PROPERTY/REFERENCE values (decisionRef, versioned agent refs, engine
  job types — skipping structural keys); a result list under the find bar
  shows category glyph + label + type + containing lane per row (property hits
  show key:value with the ref tag) and is click-navigable; Enter/↑↓ walk
  matches with an ANIMATED 240ms ease-out pan and two staggered halo pulses on
  the target (prefers-reduced-motion → instant pan, zero pulses); pulses are
  stripped from exports like every transient overlay.
- 9bee584: Handoff 14 U-5 — lint problems dock (panel 1d). `@buildtovalue/lint` gains the
  quick-fix contract `fix(ctx) → Command` (optional per rule, additive — the
  `ValidationRule` shape is untouched): mechanical fixes for `duplicate-flow`,
  `superfluous-gateway` (remove + reconnect in ONE composite) and
  `event-endpoints`, plus versioned `LintProfile`s (`lint-etiquette@1.0.0`,
  `lint-engine@1.0.0`), `lintFindings` (issues annotated with rule/profile/source
  /fixability) and `fixCommandFor`. `@buildtovalue/react` ships `LintPanel`: a
  resizable bottom dock grouped by rule with severity tokens, row click →
  select + the SAME animated pan as search (`panViewportTo` extracted to
  `canvas/viewport.ts` and now public), Esc via the dismissal stack, "corrigir"
  = one undoable command, "Corrigir todos (N)" = ONE composite, and
  "✦ sugerir correção" routing unfixable findings through the existing copilot
  C5 pipeline (only with a host-injected `AIProvider`). Etiquette AND
  engine-readiness findings share the one surface (source tag tells them apart);
  open-dock canvas badges are stripped from exports (new `TRANSIENT_ATTRIBUTES`
  in the exporter). `@buildtovalue/adapters-bpmn` adds `lintProfileAdapter` —
  lint profiles as versioned, promotable Biblioteca artifacts with the VIGENTE
  seal, reading the same `LINT_PROFILES` registry as the panel header.
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
- 6e94b12: Handoff 15 V-2 — `BpmnDiffViewer`: the review diff painted on the read-only
  viewer (§2a). Renders the target diagram on the N-7 viewer with the V-1
  `diffDiagrams` output painted over it, to the spec mock's binding semantics:
  unchanged elements dim to 45% (never hidden); removed = dashed ghost AT the
  v-base position (−REM); moved = ghost at the origin + arrow to the
  destination (→MOV); added = halo + tag (+ADD); changed = dashed halo +
  clickable ΔN badge opening the before→after property popover; rerouted paints
  the ROUTE (↷ROTA), never the nodes, and never counts as Δ. Colors come from
  the existing tokens per the V-0 decision (added --btv-green, removed
  --btv-error, moved --btv-gold, changed --btv-ink) — always glyph+text, never
  color alone. Floating legend with per-category counts and the total. The
  whole overlay is transient ([data-diff-overlay] in TRANSIENT_SELECTORS, the
  data-diff-state paint in TRANSIENT_ATTRIBUTES) — exports stay clean
  mid-diff. Read-only is absolute (binding test: no mutation reachable) and
  nothing of the review ever touches the model — XML round-trip stays
  byte-identical with review active. The viewer render without diffStates is
  byte-identical to before (viewerEquivalence intact); the viewer entry keeps
  its dep-graph boundary and size budget.
- b6f631d: Handoff 15 V-3 — change-by-change navigation on the diff viewer (§2b). The
  BpmnDiffViewer gains the top navigation bar ("change N of M", ←/→ and
  F7/Shift+F7 with wrap), combinable category filter chips with per-kind counts
  (filtering recomputes M and keeps the current item's place when it survives),
  and the synced side list (active row follows navigation, clicking a row
  navigates). The sequence is the SAME topologically-ordered list diffDiagrams
  returns — the UI never reorders (identity test). Every step pans with the
  shared panViewportTo and plays two halo pulses at the focus point
  (prefers-reduced-motion → instant pan, zero pulses); REMOVED entries are
  navigable — the pan goes to the ghost at the v-base position. Esc follows the
  V-2 standalone decision (popover first, then the host's new `onClose` prop);
  pulses ride under [data-diff-overlay] so exports stay clean mid-navigation.
  Internally the component now composes the viewer providers directly — the
  V-2 surface and all viewer invariants stay unchanged.
- a96973f: Handoff 15 V-4 — anchored review comments (§2c). `@buildtovalue/react`: the
  host-injected `ReviewStore` contract (AIProvider mold — sync CRUD + subscribe;
  reference `createInMemoryReviewStore` included): without a store the review
  surface does not exist (declared degradation, §1.5) and the editor never
  persists review data. Gold pins (`--btv-gold`) anchor by elementId — the
  issueBadges pattern, so they follow moves/layout for free — with glyph+count
  (💬N, never color alone) and a ≥44px hit; resolved-only elements show the
  hollow ✓. Double-click an element to open its thread; the popover
  opens/replies/resolves, `ia.copilot@…`/aiAssisted messages carry the ✦
  mixed-authorship seal, and the N-3 catalog grows to 16 with the typed
  `review.thread.opened`/`review.thread.resolved`/`review.changes.requested`
  events (V-0 decision 5). Orphaned threads (anchor removed from the target)
  are NEVER dropped: they list in a warning bar and stay navigable — the pan
  goes to the last known anchor on the v-base. Nothing of the review ever
  touches the model: the XML round-trip stays byte-identical with open threads
  (the PR's central test) and pins/threads are TRANSIENT (clean exports
  mid-thread). `@buildtovalue/adapters-bpmn`: `reviewCommentEntry` /
  `reviewThreadResolvedEntry` builders (`REVIEW_COMMENT_ADDED` /
  `REVIEW_THREAD_RESOLVED`) — every message and resolution is its own chain
  entry the host appends; ledger motor untouched, chain verifies.
- 943006f: Editor UX/a11y/perf round (melhorias Bloco B): clipboard (Ctrl+C/X/V),
  duplicate (Ctrl+D) and select-all (Ctrl+A) with atomic undo and id remapping;
  roving keyboard focus on canvas elements (keyboard-only selection); axe gate
  now fails on serious violations; canvas surfaces fully i18n'd (new `canvas.*`
  keys — closed-element seal, ports, resize handles, recovery banner, no-route
  title); consolidated per-element store selectors; connect-gesture rules
  evaluated only on hover-target change; new subpath exports
  `./simulation`, `./replay`, `./agent`, `./copilot`; manual dark-theme
  counterparts for the DMN token blocks; arrow nudge is now 1px (Shift = grid).
- 9bee584: Market-parity editing round (referência itens 1–7): context pad with one-click
  quick-append beside the selected node; dependency-free layered auto-layout
  (`computeLayeredLayout`) with a toolbar Arrange action, align/distribute for
  multi-selections and smart drag guides; diagram find bar (Ctrl/Cmd+F) with
  match walking and scope-aware centering; native `complexGateway` support
  (registry, shape, XML round-trip); and the new `@buildtovalue/lint` package —
  bpmnlint-style etiquette and executability rule profiles with stable issue
  codes.
- e54e5f3: Handoff 15 V-5 — Studio review panel (spec §2d). `BpmnDiffViewer` grows the
  embedded review surface: Threads/Mudanças side tabs synced with the V-3
  topological list, the ⚑ approval-gate banner with "ver no canvas", justified
  thread dismissal (min 10 chars, never silent) and Esc riding the single
  dismissal stack (thread popover → ΔN popover → diff mode). New
  `reviewThreadsRule` promotion rule blocks `evaluateGates` while OPEN threads
  anchor to the target (resolved/dismissed release; orphans never block).
  `adapters-bpmn` adds `reviewThreadDismissedEntry` (+`REVIEW_THREAD_DISMISSED`
  type) for the host-appended audit trail. `ReviewScreen` accepts an optional
  `reviewStore` and embeds the split diff canvas with the gated approve button;
  without a store it renders exactly as before (declared degradation).

### Patch Changes

- 9bee584: Handoff 14 U-3 — smart guides refined to the design spec (panel 1b): snap
  threshold adopted at ±4px; Figma-style equal-spacing badges between 3+
  neighbors (between/chain cases, snapping to the rhythm) rendered as red
  pills with the gap value; guide candidates limited to viewport-visible
  nodes; alignment guides, spacing badges and the context pad are stripped
  from SVG/PNG exports; spy test proves a guided drag never recomputes
  unrelated edges.
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [8ba65ae]
- Updated dependencies [943006f]
- Updated dependencies [9bee584]
  - @buildtovalue/lint@1.1.0
  - @buildtovalue/core@1.1.0
  - @buildtovalue/identity@1.0.1
  - @buildtovalue/simulation@1.0.1
  - @buildtovalue/copilot@1.0.1
