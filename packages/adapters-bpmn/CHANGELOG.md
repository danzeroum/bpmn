# @buildtovalue/adapters-bpmn

## 1.2.0-next.0

### Minor Changes

- 2d65a69: Handoff 19 CO-5 (§6e) — compensation → ledger glue + the read-only planner that
  completes the OMG trigger family (message/signal/error/escalation/compensation).

  - `@buildtovalue/adapters-bpmn` gains `compensationTriggeredEntry` +
    `COMPENSATION_TRIGGERED_TYPE`: a PURE builder (the engine stays intact) the
    host appends when compensation ACTUALLY runs. The entry ties the EXECUTED plan
    (`compensated` in reverse order + `uncompensated` declared); `details.author`
    prefixed `ia.copilot@` paints the ✦ AI seal (the `aiAuthorOf` rule). A blocked
    specific target appends NOTHING (reforço 8).
  - `@buildtovalue/simulation` exposes `compensationPlan(activityRef?)` — a
    READ-ONLY computation (reforço 7: it reads the trail/diagram, never mutates)
    that is the SINGLE source both `compensate()` (record + run) and the host's
    ledger glue (append the EXECUTED reversal) consume, so the two never
    re-derive. New exported types `CompensationPlan` / `CompensationStep`.
  - `@buildtovalue/react` `BpmnSimulator` gains the `onCompensationTriggered`
    prop (path a — the engine stays pure): the demo/host reads the plan BEFORE
    firing and appends the ledger entry only when something reversed.

- a127e70: feat(adapters-bpmn): escalationRaisedEntry + catálogo governado de escalação (Handoff 18 EC-3, §5c)

  A ponte agente→humano ganha a cola de ledger, sem tocar o motor nem o agentflow:

  - **`escalationRaisedEntry({actor, code, target})`** — builder PURO (molde
    `eventBindingChangedEntry`/`reviewCommentEntry`) que mapeia uma escalação RAISADA
    para o `AuditEntryInput` que o HOST appenda via `command.executed`; motor
    intacto. `details.author` carrega o ator para o selo ✦ do Explorer
    (`aiAuthorOf`): escalação de IA (`ia.copilot@…`) sela ✦, humana não — na mesma
    trilha. `ESCALATION_RAISED_TYPE` exportado; apiSurface.
  - **`GovernedEventDefinitionRecord`** passa a tipar `kind` por `EventDefinitionRefKind`
    (fonte única, ganha `escalation`) e `definition` ganha `escalationCode?` — o
    catálogo/resolver E-3 resolve refs governadas de escalação (chip esc@ VIGENTE).

  **Semântica (reforço 7):** `ESCALATION_RAISED` = "a escalação ACONTECEU", nunca
  "o boundary foi desenhado". Nesta EC: builder + teste de host-append com gatilho
  DEMONSTRATIVO no teste — a cola runtime (append quando `throwEscalation` disparar)
  é da EC-5 (registrado em `pendencias.md`). O demo `?agentbridge=1` (no `example`)
  mostra o desenho da ponte — agentTask (🤖 + ref), boundary NÃO-interrupting
  governado (chip esc@ + chip de autoridade ↟) e revisão/assinatura humana — sem
  observar o ledger ainda.

  Zero dependência nova entre pacotes: agentflow segue independente (guard
  `no-runtime-deps` + teste de independência), adapters-bpmn não importa react, o
  `example` faz a cola. Degradação sem agentflow intacta (o agentTask renderiza pelo
  shape do react core — teste).

- 5215bae: Handoff 16 E-3 — governed event-definition bindings (`nome@semver`) via the
  Biblioteca (spec §3b). react: the host injects a synchronous
  `EventDefinitionResolver` through `BpmnPlugin.eventDefinitionResolver` (first
  wins — the editor never consults a registry); the E-2 picker gains a
  "Da Biblioteca" section whose selection binds in ONE composite
  (`buildBindCommand`: local `gov-{nome}` mirror upsert + `eventDefinitionRef` +
  pinned `properties.eventDefinitionBinding`, serialized as an ordinary
  `bpmnr:property` — byte-stable, never a vendor attribute); unbinding
  (`buildUnbindCommand`) garbage-collects the orphaned mirror in the same
  composite. A canvas chip (transient — excluded from exports) and a panel seal
  show the resolution state with glyph+text (`✓ VIGENTE` / `⚠ CANDIDATA` /
  `✕ NÃO RESOLVIDA`), degrading DECLAREDLY to plain text when no resolver is
  configured. `eventBindingRule(resolver)` validates bindings —
  `SIG_REF_MISSING` (error) / `SIG_REF_STALE` (warning) — through the existing
  issue badges. The `gov-*` mirror is read-only in the panel (managed by the
  Library; editing = promoting a new version) and counts as a normal usage for
  the deletion veto, and the pin never moves on artifact promotion — only an
  explicit, audited re-bind. adapters-bpmn: `eventDefinitionCatalogAdapter`
  (read-only Biblioteca catalog, one card per name with the version timeline)
  and `eventBindingChangedEntry`/`EVENT_BINDING_CHANGED_TYPE` (ledger builder
  for the explicit ref change, host-appended).
- 47d0de8: Handoff 15 V-6 — request-changes cycle (spec §2e). `VersionStatus` grows the
  additive `in-review` (EM REVISÃO ⟲) state: entered only by request-changes
  (candidate → in-review) and left only by re-submission (→ candidate), both
  through the core state machine; the status round-trips in XML via
  `bpmnr:version` like every other. `identity` adds
  `buildChangeRequestPayload` (+`CanonicalChangeRequestPayload`): the signed
  request binds versionRef + attached open threadRefs + the mandatory
  justification, verified by the unchanged `verifySignature`. `react` adds
  `buildChangeRequestPayloadFor`, the ⟲ gold seal (StatusBadge/VersionTimeline/
  i18n `status.in-review`) and scopes `reviewThreadsRule` to `target: 'active'`
  only — request-changes passes with open threads by design. `adapters-bpmn`
  adds `reviewChangesRequestedEntry` (+`REVIEW_CHANGES_REQUESTED` type) and maps
  `in-review` → `candidate` for the Biblioteca (documented loss) with the ⟲
  seal surviving in the gallery meta. `studio` adds `requestChanges` (the
  default soft path — `rejectPromotion` stays as the documented hard reject),
  the signed "Pedir mudanças…" flow in the ReviewScreen, the
  `review.changes.requested` N-3 bridge (`onReviewEvent`) and the re-submission
  diff that opens against the version that requested changes (v-pedido →
  v-nova) via registry lineage.
- b4557cd: SL-11 — EvidenceBundle as a canonical audit entry + ExecutionStore + LedgerExplorer renderer
  (Handoff 22 "Squad Lane").

  - `EvidenceBundle` (adapters-bpmn) — a neutral, serializable evidence record for one squad run, the
    squad analog of a simulation `Session`. It wraps the masked fact trail from `simulateSquad` (agentflow,
    which never imports audit/core) and REQUIRES the three governance refs: `policyRefs`,
    `decisionRuleRefs`, `maskingPolicyRef` (acceptance §10.4). `buildEvidenceBundle` REFUSES (throws) a bundle
    whose masked trail names no masking policy — masked evidence with no named policy is not attributable.
    It reuses core's integrity primitives (`canonicalJsonExact` + `sha256Hex`), never a bespoke format:
    `canonicalEvidenceBundle` exports byte-identical canonical JSON and `hashEvidenceBundle` hashes it
    deterministically (2× identical).
  - `evidenceBundleEntry` maps a bundle to an `AuditEntryInput`. Appended through the normal
    `AuditLedger.append()`, the entry is hashed whole by core's v2 `computeEntryHash`, so the ledger's own
    `verify()` — and `@buildtovalue/audit`'s `verifyLedger`, which recomputes the identical hash — validate it
    with NO evidence-specific code. Tampering with a recorded ref breaks the chain (proven). `evidenceBundleOf`
    reconstructs the bundle from the chain (the chain IS the store).
  - `ExecutionStore` (born here) — the injected, DEGRADABLE seam where a host persists evidence bundles: a
    consumer given `undefined` simply does not persist (the run still produces its bundle).
    `createInMemoryExecutionStore` is the default (records + lists newest-first) for tests/demos; a real host
    swaps durable storage without this package importing one.
  - LedgerExplorer (studio) — a dedicated `evidence` category chip + a governance-refs detail section that
    surfaces the mandatory masking policy / policies / decision rules + the masked fact count, with a canonical
    evidence-bundle download. The section only renders when the masking policy is present (never unattributed
    evidence). i18n EN + PT-BR (react studio fragment).
  - Vectors: mandatory-refs enforcement, canonical + hash determinism, ledger verify (+ tamper detection),
    chain round-trip, ExecutionStore degradability, and the renderer. apiSurface (adapters-bpmn) + typedoc updated.

- 627dbea: SL-2 — TOOL catalog + selector binding + the injectable `ToolProvider` (Handoff 22 "Squad Lane").

  - **adapters-bpmn:** `toolAdapter(contracts)` surfaces `ToolContract` artifacts in the Biblioteca as
    "mais um adapter" (type `FERRAMENTA`), mirroring the non-diagram `copilotPromptAdapter` mold — one
    artifact per tool id, versions grouped, governance posture (effect/authorization) in `meta`,
    read-only. `resolveToolContract(contracts)` is the shared headless resolver the catalog and the
    react provider both use (one registry, never a parallel truth).
  - **react:** the `ToolProvider` interface is born here (`{ resolve; list?() }`, implementing agentflow's
    `ResolveTool` — types flow down react→agentflow) plus `createToolProvider(contracts)`. It is injected
    as an optional `toolProvider` prop on `AgentStudio` (the `AIProvider`/H9 mold). The tool inspector
    binds by **selector/autocomplete** — impossible to type a loose string (cerca §2.2) — showing the
    resolved contract's effect + capability inline, and a declared `TOOL_UNRESOLVED` warning when the bound
    ref is not in the catalog. `validateGraph` now runs with `{ resolveTool: toolProvider?.resolve }`.
  - **Degradability:** with no provider the binding degrades to the pre-SL-2 typed text field and the graph
    still validates (contract-aware checks simply do not run) — never a crash, never silence. Covered by a
    render test (provider undefined → plain field; provider that lists → selector + effect chip; provider
    that cannot resolve → visible warning, no validation error).
  - Drag-into-node from the catalog is explicitly OUT of the MVP and registered in `pendencias.md` (§11).

- 88b9f0f: SL-7 — EvalSet + promotion gate + prompt coverage validator (Handoff 22 "Squad Lane").

  - **agentflow (headless):** the `EvalSet` artifact (`eval:*@semver`, assertions ONLY regex/contains/schema —
    never code) + `runEvalSet(evalSet, wf)` which runs every case through the deterministic `simulate` engine
    and scores the assertion pass-rate. A new `finalOutput(state)` recovers the run's merged output from the
    `end` trail entry (SimulationState is parity-pinned, so it carries no output field) — one tested owner of
    that parsing; a blocked run yields `undefined` and fails the case honestly. Same fixtures 10× → identical
    report.
  - **adapters-bpmn:** `evalSetAdapter(evalSets)` surfaces EvalSets in the Biblioteca (type `AVALIAÇÃO`, TOOL
    mold) and `evalPromotionGate(wf, evalSet)` blocks promotion to active below `promotionThreshold` — a
    `RuleVerdict` in the SAME shape as `agentPromotionGate` (reusing the evaluateGates/PromotionRule path, not
    a new mechanism), with `EVAL_BELOW_THRESHOLD` as the stable token in the reason. An eval with no assertions
    never blocks (honest degradation).
  - **react:** the `PromptProvider` interface (`resolve`/`save`, mirroring `ToolProvider`) + `createPromptProvider`,
    injected as an optional `AgentStudio` prop. The Intelligence tab gains the prototype-05 **coverage validator**
    (transparent textarea over a highlight backdrop of `{{var}}` spans + a coverage bar) — the prompt TEXT is
    resolved through the provider (the body lives in the Library btv:prompt artifact, NEVER on the AgentWorkflow),
    edits persist via `save`, and it degrades honestly (no provider → absent; unresolvable ref → declared warning;
    no `save` → read-only). Reduced-motion respected on the coverage bar.
  - Positive + negative + determinism vectors for `runEvalSet`/`finalOutput`; the four-case promotion-gate
    pattern for `evalPromotionGate`; adapter list/get/reject; coverage-validator render + degradation + "edits
    hit the artifact, not the workflow". i18n EN+PT_BR; independence/structuralShape/corpus untouched.

### Patch Changes

- Updated dependencies [0627ee6]
- Updated dependencies [2d65a69]
- Updated dependencies [81e4756]
- Updated dependencies [a99b6f9]
- Updated dependencies [3d7be05]
- Updated dependencies [cbe56a7]
- Updated dependencies [b9b625a]
- Updated dependencies [b204522]
- Updated dependencies [e04c719]
- Updated dependencies [2dc3518]
- Updated dependencies [6d7f410]
- Updated dependencies [fcaaa8f]
- Updated dependencies [56fe142]
- Updated dependencies [c8223c9]
- Updated dependencies [40d6efd]
- Updated dependencies [8825d62]
- Updated dependencies [24c4684]
- Updated dependencies [47d0de8]
- Updated dependencies [98b285e]
- Updated dependencies [7f73b05]
- Updated dependencies [dc29b38]
- Updated dependencies [5de2c92]
- Updated dependencies [9a715ec]
- Updated dependencies [b9d565e]
- Updated dependencies [88b9f0f]
- Updated dependencies [fdc42b9]
- Updated dependencies [febc376]
- Updated dependencies [031c379]
  - @buildtovalue/core@1.2.0-next.0
  - @buildtovalue/simulation@1.1.0-next.0
  - @buildtovalue/lint@1.2.0-next.0
  - @buildtovalue/agentflow@1.1.0-next.0
  - @buildtovalue/copilot@1.1.0-next.0
  - @buildtovalue/registry@1.0.2-next.0

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
