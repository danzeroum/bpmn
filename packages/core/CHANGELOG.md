# @buildtovalue/core

## 1.2.0-next.0

### Minor Changes

- 0627ee6: Handoff 19 CO-1 (§6a) — compensation in the core model + converter, completing
  the OMG trigger family. No named root and no bucket (unlike the H16–H18 path):
  the internal event kind is `compensate` (== the OMG element prefix
  `compensateEventDefinition`), so it round-trips through the generic
  `${kind}EventDefinition` machinery with zero special-case.

  - The trio round-trips byte-stably: a compensation boundary (⟲) with a bare
    `compensateEventDefinition` (no `cancelActivity` — it fires post-completion),
    linked to its handler by `bpmn:association` (an already first-class built-in
    edge type, reused not forked), and the handler carrying `isForCompensation`.
  - `isForCompensation` is now read on import (it was silently dropped before —
    an un-prefixed native attribute) and emitted, default `false` omitted.
  - The compensate THROW carries an optional `activityRef`
    (`properties.compensateActivityRef`; absent = broadcast) and `waitForCompletion`
    (default `true` omitted); a CATCH never emits them.
  - Structural veto (`edge.connect.pre`, both sides): a handler neither receives
    nor emits sequence flow, and a compensation boundary emits no outgoing
    sequence flow — the handler is reached only by association. An error/message
    boundary keeps flowing normally (kind-gated); associations pass.
  - CONFORMANCE promotes `bpmn:compensateEventDefinition`; a real book-hotel corpus
    file (`60-compensation-v1.bpmn`) imports the full trio with zero warnings.

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

- cbe56a7: feat(core): escalation como o 4º bucket nomeado (Handoff 18 EC-1, §5a)

  Escalation entra nas MESMAS fontes únicas da E-1/E-3 (zero fork), completando a
  família de gatilhos OMG pelo caminho já pavimentado:

  - **Modelo aditivo**: `EscalationEventDefinition { id, name, escalationCode? }`
    (molde exato do `errorCode`, código omitido quando indefinido); `EventDefinitions`
    ganha `escalations` (opcional/aditivo — `eventDefinitionsOf` preenche o bucket
    ausente, então o resto do core o trata como sempre-presente).
  - **Fonte única**: `EVENT_DEFINITION_REF_KINDS`/`EVENT_DEFINITION_BUCKETS`/`ID_PREFIX`
    (prefixo `esc`) ganham o kind; os comandos parametrizados (add id auto `esc-1`,
    update `name`/`escalationCode`, remoção vetada listando usos, rename cascata 1
    undo) e a resolução de picker/refs seguem por construção.
  - **Converter OMG**: root `<bpmn:escalation id name escalationCode?/>` na ordem do
    XSD (após error, antes do process); `escalationRef` no child dos 4 hosts (throw
    intermediate/end, catch boundary + start de event subprocess); órfã sintetiza com
    warning; round-trip byte-estável (fixpoint com o anchor de boundary re-derivado).
  - **Neutralidade congelada**: fixture nova `escalationFrozen.json` (bucket ausente/
    vazio = bytes e hash idênticos); `eventDefsFrozen`/`passthroughFrozen`/
    `eventSubprocFrozen` intactas.
  - **CONFORMANCE**: promove `bpmn:escalation` (root) via o gerador; `certify` passa a
    mapear os roots de definição nomeada (message/signal/error/escalation) — lacuna
    latente da H16 que o 1º corpus com root de definição expôs. Corpus real novo
    `59-escalation-v1.bpmn` (root + boundary não-interrupting + end throw) importa com
    significado pleno e 0 warnings.

  Fora da EC-1 (próximas PRs): glifo/paleta/chips/autoridade (EC-2), ponte
  agente→humano + ledger (EC-3), regras de lint + perfis 1.3.0 (EC-4),
  `throwEscalation`/dissolve/limitations (EC-5).

- 2dc3518: Handoff 17 ES-1 — event subprocess in the core (spec §4a). New single-source
  predicates `isEventSubprocess` (a common `subProcess` with
  `properties.triggeredByEvent === true` — F7 containment reused whole) and
  `startIsInterrupting` (OMG default true; `false` only when explicit) — the
  E-4 execution matrix and the tightened lint rules will CONSUME these helpers,
  never reimplement the predicate. Converter: `triggeredByEvent="true"` and
  `isInterrupting="false"` serialize as the standard OMG attributes on their
  element kinds, reserved from the property soup exactly when emitted, with the
  OMG default OMITTED — and a DECLARED emission rule: the attributes round-trip
  byte-stably wherever they appear (the converter preserves, it never judges —
  semantics are the 4d lint's job). Sequence flow to or from the
  event-subprocess SHELL is vetoed by the default rules (both directions,
  always declared; children connect normally), and the shell is exempt from
  `UNREACHABLE_NODE` like a boundary event. Frozen fixture
  `eventSubprocFrozen.json` proves neutrality: without `triggeredByEvent`,
  `toXml` and `computeDiagramHash` are byte-identical to the pre-ES-1 build.
- 56fe142: Foreign extension passthrough (`zeebe:*`/`camunda:*` — the registered
  pendency's dedicated PR). Foreign `extensionElements` children on flow nodes,
  edges and the `<bpmn:process>` itself, foreign-prefixed attributes
  (`zeebe:modelerTemplate`, `camunda:asyncBefore`) and the root's foreign
  `xmlns:*` declarations now survive the round-trip: semantically lossless on
  import, byte-stable between bpmn-react exports. Model storage is additive
  (`foreignExtensions`/`foreignAttributes` on nodes/edges,
  `processForeignExtensions`/`foreignNamespaces` on the diagram) — absent
  fields keep every pre-existing hash and export byte-identical (frozen-fixture
  proven). Changed foreign extensions surface in `computeDiff`/`diffDiagrams`
  as NAMED fields (the element tag, or `@`-prefixed attribute name) so the
  review ΔN popover renders them per field — never an opaque blob. The
  whitespace-trim and CDATA→escaped-text normalizations are documented contract
  in `docs/format-spec.md`. Conformance: real-corpus assertion that preserved
  extensions re-export; CONFORMANCE.md generator gains the passthrough section.
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

- 8825d62: Named event definitions of first class (Handoff 16 §3a, E-1 — headless).
  `diagram.definitions.{messages,signals,errors}[]` stores the OMG root
  elements (`bpmn:message`/`bpmn:signal`/`bpmn:error` with `errorCode`);
  events reference them via `properties.eventDefinitionRef`, exported as the
  standard `messageRef`/`signalRef`/`errorRef` attributes. Undoable CRUD
  commands: add (collision-safe auto ids `msg-1`/`sig-1`/`err-1` via
  `nextEventDefinitionId`), update (rename cascades to every referencing event
  by construction — nodes are never touched — and one undo restores all), and
  remove, VETOED by the default rules while referenced, listing every usage.
  Import populates the model from root elements; an orphan `*Ref` is
  synthesized (`id = name = ref`) WITH an informative warning naming the event
  — never silent loss. Round-trip is byte-stable and the additive field keeps
  every pre-existing hash and export byte-identical (frozen fixture
  `eventDefsFrozen.json`). CONFORMANCE matrix promotes the three root elements;
  real-corpus assertion covers `messageRef` files importing without discard.
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

- b9b625a: feat(lint): escalação nas regras vivas + perfis 1.3.0 (Handoff 18 EC-4, §5d)

  Escalação entra nas regras de lint pela MESMA fonte única (zero fork):

  - **`EVT_REF_MISSING` ganha o kind**: `NAMED_REF_KINDS` ganha `escalation`; o
    quick-fix cria `bpmn:escalation` no bucket `escalations` (molde do «+», nunca
    genérica).
  - **`EVT_ESCALATION_START_TOPLEVEL`** (erro): molde EXATO do de erro, consumindo
    o mesmo `isEventSubprocess` — concordância com a matriz E-4 testada nos dois
    lados (escalação não carrega I/O de engine, então a matriz a trata como null,
    DECLARADO; o predicado compartilhado é `isEventSubprocess`).
  - **`ESC_NO_CATCH`** (WARNING, não erro): throw de escalação sem catch elegível.
    A razão de ser warning está no código — escalação sem destino DISSOLVE (legal
    na OMG, diferente de erro, que é parada). Destino via a fonte única do core
    `eligibleEscalationCatches` (boundaries + esub-starts; ref ou catch-all).
  - **`EVT_ESCALATION_CATCH_ILLEGAL`** (reforço 8): um `intermediateCatchEvent` de
    escalação é ilegal (só boundary/esub-start capturam) — nunca silêncio sobre um
    catch que nenhum matching alcança. (Regra geral erro+escalação = follow-up em
    `pendencias.md`.)
  - **`EVT_SUBPROC_START` ganha escalation** em `SUBPROC_TRIGGER_KINDS` — fecha o
    transitório EC-2→EC-4; os testes ES-4 que rejeitavam escalation migraram para
    positivos. `EVT_START_THROW`/`EVT_END_CATCH` revisadas (escalação legal em
    end-throw e esub-start).
  - **Perfis 1.2.0 → 1.3.0** pela MESMA fonte — header do dock + `lintProfileAdapter`
    da Biblioteca refletem por construção (teste dedicado).

  core (patch): `eligibleEscalationCatches(diagram, throwRef?)` — enumeração
  headless diagram-wide (sem escopo/tiers) com retorno estruturado
  `{node, catchKind, matchType}`; a EC-5 constrói a RESOLUÇÃO (escopo+tiers) por
  cima sem re-derivar — o lint e a simulação nunca forkam a topologia de catch.

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
- 24c4684: Handoff 21 N-1 — `preferredTypes` no longer degrades a node's type identity in
  silence (the library's "declared, never silent" fence).

  - On import, the two paths that dropped a requested type identity without a
    warning now declare it: an unregistered `meta.type` warns per element
    (`… requested meta type "X", which is not registered — imported as <tag>`),
    and an unregistered `preferredTypes` entry warns once per requested type
    (`Preferred type "X" is not registered — ignored`). Type resolution itself is
    unchanged; `NodeTypeRegistry.typeForXmlTag` stays a pure primitive.
  - The full behavior is frozen as a **contract matrix** in `docs/format-spec.md`
    (using the conformance vocabulary supported/degraded/unsupported), and every
    row cites the test in `packages/core/tests/preferredTypesContract.test.ts`
    that pins it — matrix and suite cannot drift.
  - Fidelity snapshot `corpus-warnings.json` regenerated: `58-agent-task-v1.bpmn`
    goes 0 → 1 warning, surfacing a `btv:gate` identity that was silently
    downgraded to `<task>`.

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
