# @buildtovalue/adapters-bpmn

## 1.1.0

### Minor Changes

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

- 943006f: Backend hardening round (melhorias Bloco A): `canonicalJsonExact` + versioned
  audit-ledger hash recipe (v2 — exact JSON of the whole entry; legacy v1 chains
  keep verifying), O(n²) XML parsing fix, flow classification hoisted to core
  (`isFlowNode`/`isFlowEdge`/`flowScopeOf`), structural validation in
  `JsonSerializer.deserialize`, multi-process import warning, TAB/CR attribute
  escaping, per-lane publication index in `VersionRegistry`, stricter CLI flag
  parsing, and error-taxonomy alignment (`SimulationError`/`AdapterError`/DMN/
  CLI errors now extend `BpmnError`).
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [8ba65ae]
- Updated dependencies [943006f]
- Updated dependencies [9bee584]
  - @buildtovalue/lint@1.1.0
  - @buildtovalue/core@1.1.0
  - @buildtovalue/registry@1.0.1
  - @buildtovalue/simulation@1.0.1
  - @buildtovalue/copilot@1.0.1
