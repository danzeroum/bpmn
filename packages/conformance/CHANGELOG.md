# @buildtovalue/conformance

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

### Patch Changes

- c4ad4fe: Errata da matriz de conformidade (pré-Handoff 18): a linha `eventSubProcess`
  ainda declarava `⛔ unsupported` ("Deliberately out of scope before v2.x."),
  o que a main não pode afirmar depois do Handoff 17 — o event subprocess foi
  entregue e está verde (ES-1..ES-5, PRs #128–#133). Corrigida via a fonte única
  `packages/conformance/src/matrix.ts` para `✅ supported` / classe `analytic`,
  mapeando para `subProcess (triggeredByEvent)` (contenção F7 reusada, helper
  `isEventSubprocess`; starts tipados interrupting/não-interrupting round-trip
  byte-estáveis; lint `EVT_SUBPROC_START`/`EVT_SUBPROC_FLOW`; precedência honesta
  na simulação). `CONFORMANCE.md` regenerado pelo gerador (gate de frescor
  intacto — `matrix.test.ts`). A matriz não pode mentir; fora do escopo do
  Handoff 18.
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
- Updated dependencies [0627ee6]
- Updated dependencies [a99b6f9]
- Updated dependencies [cbe56a7]
- Updated dependencies [b9b625a]
- Updated dependencies [e04c719]
- Updated dependencies [2dc3518]
- Updated dependencies [6d7f410]
- Updated dependencies [56fe142]
- Updated dependencies [40d6efd]
- Updated dependencies [8825d62]
- Updated dependencies [24c4684]
- Updated dependencies [47d0de8]
- Updated dependencies [dc29b38]
- Updated dependencies [031c379]
  - @buildtovalue/core@1.2.0-next.0

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

### Patch Changes

- Updated dependencies [9bee584]
- Updated dependencies [8ba65ae]
- Updated dependencies [943006f]
- Updated dependencies [9bee584]
  - @buildtovalue/core@1.1.0
