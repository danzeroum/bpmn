# @buildtovalue/react

## 1.2.0-next.0

### Minor Changes

- c4f2cbb: Handoff 15 V-7 — command palette, cheatsheet and empty state (spec §2f). The
  ContextMenu's conditional built-ins are extracted into a command registry
  (`builtinMenuItems`/`pluginMenuItems`/`pluginPadItems`, equivalence-tested
  before the refactor) and joined by `builtinGlobalCommands` (toolbar-level
  actions). The new Ctrl/Cmd+K `CommandPalette` has NO list of its own — it
  aggregates exactly those registries, respects `when()` against the real
  selection context, executes only via commands, and rides the single Esc
  dismissal stack. The "?" `Cheatsheet` is generated from the SAME aggregate
  plus the declared `KEYBOARD_SHORTCUT_CATALOG` (an anti-drift sweep test fails
  on any handler key not in the catalog). The empty canvas shows a teaching
  `EmptyState` with a one-click GOVERNED example (`buildGovernedExample` — real
  version block, not a loose sample); it disappears at the first element and
  returns if the canvas empties.
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

- a99b6f9: Handoff 19 CO-2 (§6b) — compensation visual, palette pair and target picker.

  - core: `compensableActivitiesOf(diagram, scope?)` — the scope-aware single
    source of "which activities here can be compensated" (carry a ⟲ boundary),
    consumed by the throw picker, the lint (CO-3) and the simulator (CO-4).
  - react visual: the rewind ◀◀ glyph joins the single-source `eventGlyph` (throw
    filled / catch hollow); the compensation boundary is always SOLID and its
    interrupting toggle is absent (it fires post-completion); a `bpmn:association`
    now renders as a dashed line with NO flow arrow (a new global `association`
    edge style — BPMN-correct for every association, including text annotations); a
    ◀◀ marker on `isForCompensation` handlers, coexisting with loop/MI markers.
  - react UX: the «Compensation (pair)» palette composite drops the boundary +
    handler (below the host) + linking association in ONE undo, lint-clean, with a
    stable-DI association so the fresh diagram re-exports byte-stably; the throw's
    transient «⟲ compensa: {activity|scope}» chip; and a target picker listing the
    compensable activities of the throw's OWN scope (broadcast is the default).
  - i18n EN/PT-BR; touch ≥44px; a `?comp=1` editor demo + e2e.

- 3d7be05: Handoff 19 CO-4 (§6d) — compensation in the token simulator (`compensate`).

  - `compensate(activityRef)` runs only that activity's handler; `compensate()`
    (broadcast) runs every completed compensable activity's handler in REVERSE
    order and fires the scope's compensation event subprocesses. Which activities
    are compensable comes from the shared core source (`compensableActivitiesOf`);
    the handler is resolved from the boundary's association.
  - Completion is derived from the trail (`'move'`/`'end'`), never a second record
    type; the loop rule is declared (last completion wins). A completed activity
    with no handler is a declared trail line; a specific non-compensable/incomplete
    target is a declared stop; `waitForCompletion` is declared in the trail.
  - Compensation has no ref-matching, so the ES-5 tier precedence does not apply —
    broadcast fires boundary handlers and esub-starts together; a specific target
    never fires an esub-start (reforço 9).
  - New `Decision` variant `compensate` (anchored to `atStep`), serializable and
    replayed bit-for-bit; existing E-6/ES-5/EC-5 scenarios replay unchanged.
  - The react `SimulationPanel` gains the «Compensate» card — broadcast (default)
    shows the reversal COUNT (reforço 10), each compensable activity is fireable
    when completed else listed not-eligible with a reason.

- db362a2: #150 — CopilotPanel makes aplicar ≠ aprovar VISIBLE with three card states.

  - PROPOSTA: a valid proposal arrives as a neutral card (diff summary + local
    soundness preview) and touches NOTHING; actions `[Aplicar no rascunho]`
    `[Descartar]` — the apply copy never says "accept/approve".
  - APLICADA · NÃO APROVADA: applying executes the ONE composite through the
    normal CommandStack (RuleEngine/lint validate it like any edit; a veto is
    declared on the card). The card never disappears: amber pill + banner
    "passou pela mesma validação de qualquer edição; aprovação é ação separada";
    actions `[Desfazer]` (single undo) `[Ver diff]` `[Enviar p/ aprovação]`.
  - APROVADA: the green pill paints ONLY from the host lifecycle signal — new
    optional props `onSubmitForApproval` (routes the intent) and
    `suggestionStatus` (registry/RBAC verdict by applied command id), mirroring
    the `promptStatus` precedent. Applying never changes lifecycle status.
  - New `copilot.*` i18n keys (EN + PT-BR) for the pills, banner and actions.

- febfdb1: feat(react): escalação visual + autoridade + paleta não-interrupting (Handoff 18 EC-2, §5b)

  O kind escalation entra em TODOS os gates locais da react (zero fork) e ganha a
  personalidade BTV:

  - **Gates alinhados na mesma PR**: `REF_KINDS`/`eventKindOf`
    (`EventDefinitionSection`), `eventBindingRule` e o overlay de chips
    (`overlays`) passam a aceitar `escalation`; o picker E-2 lista o bucket com
    `escalationCode` por tipo (molde do `errorCode`, assimetria testada).
  - **Glifo + tracejado**: o chevron ↟ vem da fonte única `eventGlyph` (já
    existia — pintado, nunca duplicado); tracejado só não-interrupting via
    `isNonInterrupting`. Snapshot do boundary comum intacto.
  - **Item de paleta dedicado «Escalation (boundary)»** (composto, molde ES-2):
    boundary + definição local + ref num 1 undo, `cancelActivity:false` explícito
    (default não-interrupting DECLARADO). **Reforço 7**: o drop precisa de host —
    sobre uma atividade anexa (anchor N-1), em canvas vazio recusa com veto
    declarado no 🔒 (`announceVeto`), nunca boundary órfão nem no-op mudo. O
    `InterruptingToggle` existente passa a servir boundaries (flipa `cancelActivity`).
  - **Chips governados + autoridade**: o resolver E-3 (widened na EC-1) resolve
    escalação ponta-a-ponta; chip `esc-nome@semver` + selo. Novo chip de
    **autoridade** (`properties.escalationAuthority` → `bpmnr:`) — **reforço 8**: lê
    o valor ASSENTADO (commit no blur do inspector), autoridade vazia = ausente
    (sem chip). Ambos os chips são overlays transientes (nunca exportados).
  - **Esub**: o shape colapsado já pinta o glifo do start de escalação.
    **Estado transitório registrado**: a lista de kinds do lint `EVT_SUBPROC_START`
    só ganha escalation na EC-4 — entre EC-2 e EC-4 o esub-escalação renderiza mas
    o lint ainda o sinaliza (dock advisório, sem quebra).
  - **Transversais**: i18n EN/PT-BR (código, autoridade, veto, composto), touch,
    apiSurface react (`buildEscalationBoundaryInsert`, `hasInterruptingToggle`,
    `PaletteInsertResult`), pisos, dark, e2e (`?escalation=1` + veto em `?empty=1`).

  Fora da EC-2: EC-3 ponte agente→humano + ledger · EC-4 lint 1.3.0 · EC-5
  `throwEscalation`/dissolve.

- b204522: Handoff 18 §5e — escalation throws in the token simulator (`throwEscalation`),
  completing the OMG trigger family. The candidate topology is enumerated by the
  SAME shared core source as the lint (`eligibleEscalationCatches`, no fork); the
  simulator builds the scoped, tiered resolution on top — the identical total
  order and ambiguity rule as `throwError` (`especificidade > escopo > catch-all`;

  > 1 in the winning tier is a `BlockedDecision`).

  Two things differ, both declared: the personality is NON-INTERRUPTING (a
  non-interrupting catch leaves the host token in place and re-emerges a parallel
  token at the catch — the host continues), and NO eligible catch = the escalation
  DISSOLVES (a declared no-op in the trail, the host token continues), the binding
  contrast with an uncaught error's stop.

  New public types `EscalationDestination` / `EscalationThrowOption` and the
  `escalationThrowOptions` state; the react `SimulationPanel` gains the «Escalate»
  card, which predicts each option's destination + mode as glyph + text before the
  throw (informed decision). `BpmnSimulator` gains an `onEscalationThrown` callback
  (the engine stays pure) so the host maps a fired escalation to a ledger entry
  (`escalationRaisedEntry` — the escalation actually happened).

- a3058f3: Named event definitions UI (Handoff 16 §3a, E-2). The properties panel gains
  an "Evento" section for message/signal/error events: a named-definition
  picker with the «+» flow — ONE composite command (add definition + reference
  the node) so a single undo reverts both; inline rename whose cascade to every
  referencing event is by construction (refs are by id — nodes never touched);
  an honest usage list with click-to-navigate (U-4 animated pan,
  reduced-motion respected); and deletion whose core veto (usage list in the
  reason) surfaces through the existing `lastVeto` channel — the managed
  definition survives unlinking so the Axelor flow "change ref → delete" is
  reachable while the veto stays honest. `errorCode` renders only for error
  definitions. i18n EN/PT-BR (`eventDefs` fragment), touch ≥44px, dark theme.
- e04c719: Handoff 16 E-4 — event I/O on the Execução tab (spec §3c). react: executable
  EVENTS join activities behind the SAME `BpmnPlugin.engine` gate (no plugin →
  panel byte-identical); the matrix lives in react (`eventExecutionModeOf` —
  OMG semantics, not an engine opinion): message/signal throws (intermediate +
  end) edit payload mappings (var → destino), error catches (boundary + error
  start inside a subProcess) edit the errCode/errMsg capture variables — the
  throw/catch asymmetry is imposed by the UI (payload never on catch, capture
  never on throw). Props live under engine-named keys (`payloadKey`,
  `errorCodeVariableKey`, `errorMessageVariableKey` on `EngineBridge`, with
  `{id}:*` defaults), every commit is one undoable `updateNodeCommand`, and the
  essential keys are excluded from the advanced fold (no double render). Clean
  model: blank mapping rows are pruned on commit and an empty list removes the
  property entirely — the absent field keeps prior exports byte-identical.
  core: `updateNodeCommand`/`updateEdgeCommand` now DROP keys patched to
  `undefined` instead of keeping an own key with an undefined value, which
  leaked a value-less `bpmnr:property` into exports.
- 00b17de: Handoff 17 ES-3 — event-subprocess interactions (spec §4c). New
  `announceVeto(reason)` on the diagram context: the DECLARED gesture-veto
  channel — a rejected connect drop or a Tab on the event-subprocess shell
  lights the same 🔒 surface as `lastVeto`, with the same lifecycle (replaced
  by the next veto, cleared by the next successful command). The shell offers
  NO connection ports and its context pad drops connect/append entries;
  children keep the full pad and Tab chaining (the veto is shell-only, both
  directions, with the ES-1 rule's message — one message, one source).
  `InterruptingToggle` ("Interrompe o escopo") appears ONLY on the start of an
  event subprocess (`isEventSubprocessStart` — core helpers on both sides of
  the predicate): one undoable `updateNodeCommand`, with the OMG default
  (interrupting) stored as the ABSENT field. The E-4 execution matrix is
  TIGHTENED: `eventExecutionModeOf` catch-error now requires
  `isEventSubprocess` on the parent (the same single-source helper the ES-4
  lint will consume); the old "any subProcess" case is the new negative, and
  the E-4 artifacts (tests + `?eventio=1` demo) migrate in this change.
  Cross-scope flow (child → outside) keeps the behavior inherited from common
  sub-processes — parity tested; the OMG non-conformance is registered in
  pendencias.md, never a silent divergence.
- 6d7f410: Event subprocess lint (Handoff 17 ES-4, painel 4d): novas regras
  `EVT_SUBPROC_FLOW` (fluxo de sequência tocando a casca — 1 finding por
  aresta nomeando as duas pontas) e `EVT_SUBPROC_START` (exatamente 1 start
  tipado entre os filhos DIRETOS — 0, >1 e sem-gatilho com mensagens
  distintas; kind fora da lista aceita acusa nomeando os aceitos), quick-fix
  mecânico só para 0 starts reusando o builder compartilhado
  `typedMessageStartCommands` (a MESMA forma do composto da paleta ES-2),
  aperto do `EVT_ERROR_START_TOPLEVEL` consumindo `isEventSubprocess`
  (fonte única — concordância com a matriz de executáveis), perfis
  etiquette/executability em 1.2.0. Core: o converter captura/emite
  `triggeredByEvent`/`isInterrupting` por TAG OMG (subProcess/startEvent),
  preservando os atributos mesmo quando o host mapeia a tag para um tipo
  próprio via `preferredTypes`.
- f034a2a: Handoff 17 ES-2 — event-subprocess shapes and the composite palette item
  (spec §4b). `SubProcessShape` consumes the core `isEventSubprocess` predicate
  (never reimplemented): the OMG thin DOTTED border + `event subProcess` tag,
  with the COMMON subProcess byte-identical to before (frozen markup fixture);
  collapsed containers show the trigger glyph of the FIRST typed start child —
  0 starts / >1 starts / kindless starts degrade to no glyph, never a crash
  (fixing the model is the lint's job). `StartEventShape` draws DASHED when
  `startIsInterrupting(node) === false` (the H6 boundary dash), glyphs reused
  from the single `eventGlyph` source. New documented public surface:
  `PaletteItem.build` — a composite insert factory resolved by ONE code path
  (`paletteInsertCommand`/`insertPaletteItem`) shared by the palette click and
  the new `palette.insert.*` ⌘K registry (`paletteInsertCommands`, anti-drift
  tested). The shipped «Event Subprocess» item creates container + typed
  message start + referenced named definition in ONE undo — lint-clean by
  construction. Palette labels now resolve `palette.item.{id}` from the i18n
  dictionary when present (additive; existing items unchanged). Dashes are SVG
  geometry, faithful in SVG/PNG export and both themes. Also new:
  `useDiagramOrNull` (tolerant context hook for pure shapes).
- fcaaa8f: Simulação do event subprocess (Handoff 17 ES-5, painel 4e): candidatos de
  `throwError`/`throwSignal`/`throwMessage` passam a incluir os starts tipados
  dos event subprocesses do escopo do token (elegibilidade via os helpers
  fonte-única `isEventSubprocess`/`startIsInterrupting`); precedência do erro em
  ordem TOTAL declarada (esub-exato > boundary-exato > esub-catch-all >
  boundary-catch-all; >1 no tier vencedor = `BlockedDecision` nomeando
  candidatos); token no CONTÊINER com descida declarada não-simulada;
  interrupção nomeada na trilha (contagem de tokens cancelados + escopo, uma
  vez por throw — os tokens recém-colocados pelo mesmo throw sobrevivem);
  timer/conditional NUNCA auto-dispara — card manual novo
  (`eventSubprocessOptions`/`fireEventSubprocess`, decisão `eventSubprocess`
  ancorada em `atStep` para replay bit a bit); compat E-6: cenários sem event
  subprocess replayam com trilha byte-idêntica. React: card manual no
  `SimulationPanel` com o modo declarado (glifo+texto) e i18n EN/PT-BR;
  limitations.md atualizado no mesmo PR.
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
- c8223c9: Handoff 16 E-6 — honest event matching in the simulator (spec §3e, S-FEEL
  discipline: exact where possible, a DECLARED stop everywhere else, never a
  guessed route). simulation: `throwError(host, errorRef?)` — the user throws
  the ERROR (named definition or uncatalogued), the ENGINE resolves the boundary
  by matching: a specific `errorRef` match beats the DECLARED catch-all
  (documented precedence — both present is NOT ambiguity); two eligible
  specifics, two catch-alls, or an uncaught error are `BlockedDecision` stops
  naming node, reason and candidates. `throwSignal` broadcasts to every waiting
  matching catch; `throwMessage` delivers to a single destination — more than
  one waiting candidate is a declared stop (runtime correlation is not
  simulable; documented in limitations.md). All three are new serializable
  `Decision` kinds that replay through the SAME matching; `fireBoundary` and
  old scenarios stay intact, and error boundaries leave the manual
  `boundaryOptions` list for the new `errorThrowOptions` cards. react: the
  SimulationPanel renders the inverted "Throw error" card (per-definition
  buttons + the "uncatalogued error" path that exercises the catch-all).
- 40d6efd: #154 — lanes now tile the pool body at design time, and the lint names the gap.

  - core: lane/pool body geometry as ONE shared source (`POOL_TITLE_BAND`,
    `poolBodyOf`, `poolContainingRect`, `lanesOfPool`, `tileLaneRects`,
    `lanesTileBody`) — consumed by both the react gesture and the lint rule so
    interaction and diagnosis never drift.
  - react: creating a lane inside a pool snaps it to the pool body
    (`x = pool.x + 30`, `width = pool.width − 30`) and tiles the body equally
    with its siblings; resizing a lane keeps the requested height and re-tiles
    the siblings; resizing a pool reflows its lanes — each case inside the SAME
    gesture (one composite, one undo). Import is untouched: imported DI stays
    sovereign.
  - lint: new etiquette rule `LANE_BODY_TILING` (warning) flags a lane whose
    bounds do not partition the pool body (wrong x/width, vertical gap, overlap,
    remainder), with the mechanical quick-fix "ajustar ao corpo do pool" (one
    composite of ordinary resize commands). Etiquette profile 1.4.0 → 1.5.0.

- 6dbc87a: #151 — i18n for the Biblioteca surfaces: `LibraryView`, `ArtifactCard` and
  `ArtifactDrawer` join the same i18n contract as every other public surface.

  - library-react: the three components accept `messages?: Messages` and resolve
    every UI string through `useT()` — resolution order: `messages` prop → an
    ancestor `<I18nProvider>` → the per-key English fallback (no provider, no
    prop → English, the standard embedded default).
  - react: new `library.*` dictionary fragment (EN + PT-BR) covering filters,
    search, sort, empty state, card runs chips and the whole detail drawer; the
    keys ship in `PT_BR` so `messages={PT_BR}` (or the host toggle) localizes the
    entire `/library` screen.
  - The three files join the `check-no-hardcoded-strings` static gate (MIGRATED).

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
- c944070: SL-10 (react) — the squad fact trail + the off-thread squad run (Handoff 22 "Squad Lane").

  - `SquadTrail` — renders a headless `SquadSimResult` as the fact trail (D1): an ordered
    `intencao → acao → io → decisao → evidencia` list, each fact labeled with its provenance
    (`fixture` vs `evidencia-declarada`, E6) and its masked I/O. It is VIRTUALIZED with its OWN windowing
    (E8 — no react-window): a fixed row height + a scroll spacer means only the visible slice (+ overscan)
    mounts, so a 10k-fact trail scrolls with a bounded DOM. It is FILTERABLE by agent / kind / error, and
    STEP-ABLE (D8): step mode walks the filtered facts one at a time and shows the shared-context snapshot
    AT that step (already masked by the headless engine). It invents nothing — masking, provenance and the
    context snapshot all come straight from `simulateSquad`.
  - `squadSimJob` — the squad run as an F7 compute job, registered in `DEFAULT_JOBS` as `squad-sim`, so it
    runs with the SAME agentflow engine off the main thread (or in-thread via the SyncExecutor — proven
    byte-identical). A resolver FUNCTION cannot cross a worker boundary, so the host passes a serializable
    map of member workflows keyed by `id@version` (the `routeJob` pattern); the job rebuilds the resolver
    inside the worker. Masking uses the conservative redaction across the boundary (never leaks).
  - Tests: virtualization (bounded DOM + window-follows-scroll), the three filters, step mode with per-step
    context, provenance labels, the worker≡sync byte-identity, and a zero-serious/critical axe gate. i18n
    EN + PT-BR; `SquadTrail` added to the hardcoded-string cerca. apiSurface + typedoc updated.

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

- dc29b38: SL-12 — BPMN bridge (Handoff 22 "Squad Lane"), core half: process-level gate coverage.

  - `gateBypassRoute(diagram, startId, isGate, isTerminal?)` — the process-path-coverage companion to
    `reachableGateFrom`, over the SAME sequence-flow graph (never a new traversal model). Returns the id of an
    ungated commit point (a terminal — default an `endEvent` — or a sink) reachable WITHOUT passing a gate;
    gate nodes are walls (a gate covers everything downstream of itself). `undefined` means every route to a
    commit passes a gate.
  - `agentGateCoverageViolations` + `agentGateCoverageRule` — `GATE_NOT_COVERING` (§6): every agentTask whose
    autonomy requires a gate where a gate IS reachable (so NOT the no-gate case that `agentGateViolations`
    already reports — the two stay distinct, no double-report) but a route (fallback/retry/bypass) reaches a
    commit without passing it. The violation names the bypass route; the promotion rule blocks activation with a
    `GATE_NOT_COVERING` reason. Built over `reachableGateFrom` + `effectRequiresGate` (SL-1) — the
    process-path-coverage layer the SL-1 `TOOL_EFFECT_UNGATED` (contract-level) and the SL-11 squad grounding
    check deliberately deferred.
  - Positive + negative + remediation + no-double-report + sink + cyclic + custom-terminal + promotion-block
    vectors. apiSurface updated.

  - `scaffoldSquad(template, options?)` (copilot) — the whitelisted squad scaffolder (§8-08), a PROPOSAL
    GENERATOR built ENTIRELY from the primitive whitelisted commands (`addNode`/`addEdge`), so it is
    structurally incapable of expressing anything off the whitelist. It flows through the ordinary
    PROPOSTA → APLICADA pipeline (`validateProposal` → `buildPlan` → CopilotPanel): applying runs through the
    CommandStack like any edit and NEVER approves/promotes (#150). Four templates (`hierarquico` / `sequencial`
    / `paralelo` / `revisao`), each scaffolding a gate-covered squad process — a start, agentTasks with an
    `autonomyLevel`, an approval gate (a core `userTask` marked `properties.gate`, since the domain `btv:gate`
    is not core-creatable) before the end, and the sequence flows. Deterministic (ids/positions from
    template + prefix); a `prefix` option namespaces ids so two squads coexist. Vectors: whitelist-only,
    node-before-edge order, validates against a fresh diagram, gate-covered projection, determinism,
    prefix-collision. apiSurface updated.

  - BPMN bridge deep-link (react, §8-08, closes pendências §1.2): `?load=<versionId>` opens the EXACT
    artifact version instead of the demo diagram. `readLoadVersionId` + `resolveDeepLink` parse the param and
    call an injected `VersionResolver` (degradable — an absent/unresolved version falls back to the default,
    never guesses); `buildLoadSearch` builds the URL the host pushes to history. The host owns URL/history
    (never `window`/`history` here). `BpmnDesigner` gains `initialCanvasState` so "voltar" restores the saved
    viewport/selection.
  - `MAPPING_TRANSFORM_ILLEGAL` (react): `PayloadMapping` gains optional additive `transform`/`adapterRef`;
    `payloadMappingIssues(rows, catalog)` flags a mapping that names a transform OUTSIDE the injected catalog,
    or a catalog conversion with no `adapterRef` (a plain source→target copy is always legal). Degradable
    (host-owned catalog, the `resolveTool` mold).
  - Squad Studio Wave-3 wiring: the Memória/Governança inspector tab registered in SL-9 was not actually
    reachable (SquadStudio uses `BpmnDesigner`, which renders no inspector, and read-only blocks canvas
    selection). Fixed: SquadStudio now renders the `PropertiesPanel`, and a member list drives selection for
    inspection (read-only-safe — it only sets `selectedIds`, never mutates). Render vectors added (governance
    tab shows role/persona/context keys; degrades without a contract).

- d8d3269: SL-13 — readiness badges (single source) + reconciliation + i18n/a11y sweep (Handoff 22 "Squad Lane"),
  the closing chore.

  - `ReadinessBadge` — the ONE way any surface paints an agent's/squad's readiness. It derives the state
    SOLELY from the pure `readinessState()` (cerca §2.11 — painting a state in the UI is prohibited); the guard
    test compares the badge to `readinessState()` across all four states, so a component that derived its own
    state would break the build (acceptance §10.7). The four derived states are the ceiling; the host runtime
    states (`executando` / `erro-de-integracao`) show ONLY when the host informs them via `hostStatus` —
    `apto-para-integracao` never becomes `executando` on its own. Wired into AgentStudio's header (readiness
    from the studio's own validation + whether a completed simulation exists). i18n EN + PT-BR; zero
    serious/critical axe.
  - `docs/design_handoff_btv_squad_lane/RECONCILIACAO.md` — the item-by-item scorecard of SL-1…SL-13 against
    §10 (every acceptance criterion → where it is satisfied: SL, file, test), plus the registered boundaries
    (the three distinct gate layers; manifest↔diagram round-trip; off-thread masking; host-only runtime states).
  - i18n/a11y sweep: the new surface carries EN + PT-BR and passes the hardcoded-string cerca + the axe gate;
    the full suite stays green under coverage with independence/acidez and the conformance corpus untouched.

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

- b9d565e: SL-5 — tab-registered inspector sections + Wave-1 agent tabs + headless promptCoverage (Handoff 22 "Squad Lane").

  - **agentflow (headless):** `promptCoverage(inputVars, promptText)` — a pure, deterministic check emitting
    `PROMPT_VAR_UNUSED` (warning) for each declared input variable the prompt never references as `{{name}}`.
    It is a SEPARATE entry point (not wired into `validateGraph`, which has only the `promptRef`): the host
    feeds resolved prompt text; with none it simply is not called. `promptVariables` exposes the bare-`{{name}}`
    extractor, deliberately distinct from the simulate engine's `{{node.output.path}}` tool-param form. Zero
    ecosystem imports (independence preserved).
  - **react — reusable infra:** `InspectorSection` gains an optional `tab?: { id, label }` (additive, MINOR).
    `PropertiesPanel` generalizes its hardcoded General/Execution pair into a tab registry: a section that
    declares a `tab` renders as its own registered tab; sections without `tab` stay inline in General exactly
    as before. General/Execution and every existing node-type render byte-identically (regression tests green);
    no engine + no tab section → no tab strip, unchanged.
  - **react — Wave 1 (O1):** the AgentStudio node inspector is organized into **Identity** + **Intelligence**
    tabs. Intelligence shows the model-facing config (model, promptRef, provider shown as a host-injected label
    — never a key field, structuredOutput) and, for a tool node, the resolved contract effect via the injected
    `ToolProvider` (degrading with a declared warning when absent — inherited from SL-2). Decorators + remove
    stay below the tabs (Waves 2/3 are not pre-empted; the errorBoundary flow is unchanged).
  - The agentTask node in the main canvas keeps its current inline inspector; giving it Wave tabs needs an
    injected agent-workflow resolver and lands at the SL-12 bridge (registered in `pendencias.md` §11).
  - i18n EN+PT_BR for all new strings; PropertiesPanel/AgentStudio stay on the migrated no-hardcoded-strings
    surface. Positive + negative + remediation vectors for `PROMPT_VAR_UNUSED`.

- a8b3dda: SL-6 — Problems Panel (business language) + safe quick-fix + Wave-2 Contracts tab (Handoff 22 "Squad Lane").

  - **Problems Panel** in the AgentStudio inspector: every `validateGraph` issue rendered in BUSINESS language
    with the stable code beside it. Each code maps to a localized title AND a localized remediation; an
    unmapped code falls back (title → generic localized title, remediation → the EN headless string), never a
    raw code string. The headless `remediation` stays EN (host-agnostic); the UI localizes at the edge (N-6),
    closing the mixed-language i18n gap (melhorias F5). "Locate" selects the issue's node (no `scrollIntoView`).
  - **Safe quick-fix** rides the modal's single undoable command/undo stack (`apply(EditResult)`) — never a
    parallel mutation path. A fix appears ONLY for codes that cannot change the I/O contract:
    `RETRY_WITHOUT_MAX` (bounds the looping route with `maxRetries`) and `LLM_NOT_STRUCTURED` (sets
    `structuredOutput`). Contract/gate/schema codes (`TOOL_EFFECT_UNGATED`, `TOOL_PARAMS_MISMATCH`,
    `DELEGATE_CONTRACT_MISMATCH`, empty-schema, …) show the code with NO fix button.
  - **Wave 2 (O2) — Contracts tab** on the node inspector: the workflow I/O contract (input/output schema,
    read-only, normalized) and, for a tool node, the resolved `ToolContract` (capability/effect/authorization)
    via the injected `ToolProvider`, degrading with a declared notice when absent. Memory/Governance (O3)
    is untouched.
  - The inspector now defaults to the **Intelligence** tab (the daily-work tab, prototype 02); Identity and
    Contracts are deliberate clicks.
  - i18n EN+PT_BR for all new strings; AgentStudio stays on the migrated no-hardcoded-strings surface.

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

- febc376: SL-9 — Squad Studio (Handoff 22 "Squad Lane"), the a11y-heavy piece (§10.9). A `SquadManifest`
  rendered as a STANDARD BPMN diagram over the EXISTING editor — no new canvas, no fork.

  - `buildSquadDiagram(manifest)` — the DETERMINISTIC projection of the manifest (the source of truth,
    D5) into a `BpmnDiagram`: a pool with one lane per role (orchestrator + members, plus a `humano`
    lane only when an edge references it), an `agentTask` per lane carrying `agentWorkflowRef`/`personaRef`,
    and one edge per drawable squad relation with the kind as `edge.type`. A `*` broadcast fans out to
    every non-human member; edges to unknown roles are dropped rather than inventing a lane. Same manifest
    → byte-identical diagram.
  - `SquadStudio` — instantiates `BpmnDesigner` with the squad plugin; zoom/pan/keyboard-navigation/inspection
    are the editor's, reused. The diagram is READ-ONLY on purpose: a projection with no write-back must not
    accept mutation gestures (drag/connect/delete), or an edit would vanish on the next projection — silent
    loss, which the doctrine forbids. Read-only keeps every inspection affordance alive (perspective toggle,
    legend, roving keyboard focus over nodes/edges that drives the announce, governance tab). Squad editing
    happens via the manifest UI; the full manifest↔diagram round-trip (edits mapped back to manifest commands)
    is a registered pendência, not SL-9. Chrome mounts INSIDE the editor providers so it reads the same store:
    an Estrutura↔Colaboração toggle that flips only the new `viewMode` store key, a keyboard-navigable legend,
    a manifest + context-contract summary panel, and a coordinated-promotion warning driven by an OPTIONAL
    host-injected `staleMembers` (absent → no warning; degradable).
  - `validateSquad` (agentflow) gains `SQUAD_EDGE_ROLE_UNKNOWN` (error): an edge whose `from`/`to` is not a
    known role (`orch`, a declared member role, `humano`, or `*` as a broadcast source). This is the SAME
    known-role set the projection treats as drawable, so an edge the diagram silently omits is exactly an edge
    this check flags — the omission is never mute (the user sees it in the Problems Panel). Positive + negative
    - remediation vectors added.
  - `createSquadPlugin` / `SQUAD_EDGE_STYLES` / `SQUAD_EDGE_GLYPH` — the six collaboration edges are
    distinguishable WITHOUT color (distinct marker + dash + glyph + localized label). `EdgeStyle` gains an
    additive `collaboration` override that only thickens the stroke in the Colaboração view (DMN/escalation
    edges unaffected). The plugin also registers the Wave-3 (O3) Memória/Governança inspector tab for a
    squad member (role, persona, autonomy, downstream-gate need, and the member's context keys).
  - New canvas-store `viewMode` (`estrutura`/`colaboracao`, default `estrutura`) — a pure renderer switch,
    read by `EdgeRenderer` to apply the collaboration override. Focusing a squad edge announces
    kind + from → to in an `aria-live` region.
  - Tests: the projection (determinism, lanes, broadcast fan-out, unknown-role drop, humano lane) and the
    Studio (canvas render, toggle preserves selection, six-edge legend, edge announce, stale-member warning,
    and a zero-serious/critical axe gate). i18n EN + PT-BR; both new surfaces added to the hardcoded-string
    cerca.

- 031c379: Handoff 16 E-5 — EVT*\*/TIMER*\* lint, headless ISO 8601 parser and the timer
  editor (spec §3d, with the E-0 amendment). core: `parseTimerExpression`
  (date / duration / cycle — total, never throws; `P1M` is one MONTH, `PT1M`
  one MINUTE) returning a STRUCTURED result, plus the canonical
  `properties.timer = { kind, expression }` exported as the standard OMG
  `timeDate`/`timeDuration`/`timeCycle` child of the `timerEventDefinition` —
  ONLY on timer events (on any other node the property stays an ordinary
  `bpmnr:property`, never an orphan OMG child); byte-stable round-trip, absent
  field keeps prior exports byte-identical. lint: new rules in the shipped
  profiles (now 1.1.0 — a new promotable policy version): `EVT_START_THROW`,
  `EVT_END_CATCH`, `EVT_ERROR_START_TOPLEVEL` (etiquette; same containment
  predicate as the editor's Execução matrix) and `EVT_REF_MISSING` (warning,
  with a KIND-AWARE mechanical quick-fix: one composite creating a definition
  of the event's own kind and referencing it) + `TIMER_MALFORMED` (error via
  the parser; no mechanical fix — guessing intent is not mechanical). react:
  `TimerSection` — kind select, ISO 8601 expression and a HUMAN i18n preview
  built from the parser's structured result; an invalid expression shows ONLY
  the glyph+text notice (never a guessed preview) and an empty expression
  removes the property entirely.

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
  - @buildtovalue/identity@1.1.0-next.0
  - @buildtovalue/agentflow@1.1.0-next.0
  - @buildtovalue/copilot@1.1.0-next.0

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
