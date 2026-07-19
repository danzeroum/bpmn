# BPMN 2.0 Conformance

<!-- GENERATED FILE — do not edit by hand.
     Source of truth: packages/conformance/src/matrix.ts
     Regenerate with: node scripts/gen-conformance.mjs -->

Element-by-element conformance of the bpmn-react import/export profile
(`@buildtovalue/core` BpmnXmlConverter). Statuses: **supported** — imports,
renders, exports and round-trips losslessly; **partial** — model and
round-trip work, some interactions pending; **degraded** — imported with a
warning and downgraded; **unsupported** — ignored on import with a warning.

- **Descriptive class: 100%** — declarable ✅
- **Analytic class: 100%**

| Element | Status | Class | Maps to | Notes |
|---|---|---|---|---|
| `bpmn:task` | ✅ supported | descriptive | `task` |  |
| `bpmn:userTask` | ✅ supported | descriptive | `userTask` |  |
| `bpmn:serviceTask` | ✅ supported | descriptive | `serviceTask` |  |
| `bpmn:scriptTask` | ✅ supported | analytic | `scriptTask` |  |
| `bpmn:sendTask` | ✅ supported | analytic | `sendTask` |  |
| `bpmn:receiveTask` | ✅ supported | analytic | `receiveTask` |  |
| `bpmn:manualTask` | ✅ supported | analytic | `manualTask` |  |
| `bpmn:businessRuleTask` | ✅ supported | analytic | `businessRuleTask` | DMN table glyph + decision-link badge (properties.decisionRef); decision table editor lands with Handoff 5 F-B. |
| `bpmn:subProcess` | ✅ supported | descriptive | `subProcess` | Nested children as first-class nodes (lossless round-trip, DI isExpanded); expand/collapse and drill-down in the editor. |
| `bpmn:subProcess @triggeredByEvent` | ✅ supported | analytic | `properties.triggeredByEvent` | Event subprocess (F7 containment reused whole); sequence flow to/from the shell is vetoed by the default rules; exempt from UNREACHABLE_NODE. |
| `bpmn:startEvent @isInterrupting` | ✅ supported | analytic | `properties.isInterrupting` | OMG default (true) omitted on export; only isInterrupting="false" is written. Round-trips wherever it appears — semantics are policed by lint, never the converter. |
| `bpmn:callActivity` | ✅ supported | descriptive | `callActivity` | Native calledElement; @buildtovalue/registry resolves the called process version (resolveCallActivities/activeAt). |
| `btv:agentTask (extension)` | ✅ supported | extended | `agentTask` | Agent Lane (Handoff 12): a governed AI-agent sub-workflow. Exports as bpmn:task (external editors read it as a plain task — graceful degradation); agentWorkflowRef/autonomyLevel/mappings + an optional read-degraded snapshot ride in extensionElements. The @buildtovalue/agentflow schema/simulation back it. |
| `bpmn:transaction` | ⛔ unsupported | extended | — | Deliberately out of scope before v2.x. |
| `bpmn:adHocSubProcess` | ⛔ unsupported | extended | — |  |
| `loopCharacteristics (standard)` | ✅ supported | analytic | `activity marker` |  |
| `loopCharacteristics (multiInstance)` | ✅ supported | analytic | `activity marker` | Sequential and parallel markers. |
| `bpmn:startEvent` | ✅ supported | descriptive | `startEvent` |  |
| `bpmn:endEvent` | ✅ supported | descriptive | `endEvent` |  |
| `bpmn:intermediateCatchEvent` | ✅ supported | analytic | `intermediateCatchEvent` |  |
| `bpmn:intermediateThrowEvent` | ✅ supported | analytic | `intermediateThrowEvent` |  |
| `bpmn:boundaryEvent` | ✅ supported | analytic | `boundaryEvent` | Interrupting and non-interrupting (cancelActivity). |
| `bpmn:message (root)` | ✅ supported | analytic | `definitions.messages[]` | Named definition; events reference via messageRef (properties.eventDefinitionRef). Orphan refs are synthesized with an informative warning. |
| `bpmn:signal (root)` | ✅ supported | analytic | `definitions.signals[]` | Named definition; referenced via signalRef. |
| `bpmn:error (root)` | ✅ supported | analytic | `definitions.errors[]` | Named definition with errorCode; referenced via errorRef. |
| `bpmn:escalation (root)` | ✅ supported | analytic | `definitions.escalations[]` | Named definition with escalationCode (Handoff 18 §5a); referenced via escalationRef on throw (intermediate/end) and catch (boundary/event-subprocess start). Orphan refs are synthesized with an informative warning. |
| `bpmn:messageEventDefinition` | ✅ supported | analytic | `eventDefinition: 'message'` |  |
| `bpmn:timerEventDefinition` | ✅ supported | analytic | `eventDefinition: 'timer'` |  |
| `bpmn:timeDate` | ✅ supported | analytic | `properties.timer` | Canonical { kind: 'date', expression } — validated by the headless ISO 8601 parser (TIMER_MALFORMED). |
| `bpmn:timeDuration` | ✅ supported | analytic | `properties.timer` | Canonical { kind: 'duration', expression } (PnYnMnDTnHnMnS). |
| `bpmn:timeCycle` | ✅ supported | analytic | `properties.timer` | Canonical { kind: 'cycle', expression } (Rn/…). |
| `bpmn:errorEventDefinition` | ✅ supported | analytic | `eventDefinition: 'error'` |  |
| `bpmn:signalEventDefinition` | ✅ supported | analytic | `eventDefinition: 'signal'` |  |
| `bpmn:escalationEventDefinition` | ✅ supported | analytic | `eventDefinition: 'escalation'` |  |
| `bpmn:compensateEventDefinition` | ✅ supported | analytic | `eventDefinition: 'compensate'` | Handoff 19 §6a: completes the OMG trigger family. No named root/bucket — the throw carries an OPTIONAL activityRef (target activity; absent = broadcast) and waitForCompletion (default true omitted); the handler links by bpmn:association and carries isForCompensation; the boundary has no cancelActivity. Catch never emits activityRef/waitForCompletion (COMP_CATCH_ATTRS warns + preserves on import). |
| `bpmn:conditionalEventDefinition` | ✅ supported | analytic | `eventDefinition: 'conditional'` |  |
| `bpmn:linkEventDefinition` | ✅ supported | analytic | `eventDefinition: 'link'` |  |
| `bpmn:terminateEventDefinition` | ✅ supported | analytic | `eventDefinition: 'terminate'` |  |
| `eventSubProcess` | ✅ supported | analytic | `subProcess (triggeredByEvent)` | Delivered in Handoff 17 (ES-1..ES-5): subProcess with triggeredByEvent (F7 containment reused, isEventSubprocess helper); interrupting/non-interrupting typed starts round-trip byte-stable (isInterrupting); lint EVT_SUBPROC_START/EVT_SUBPROC_FLOW and honest simulation start precedence. |
| `bpmn:exclusiveGateway` | ✅ supported | descriptive | `exclusiveGateway` |  |
| `bpmn:parallelGateway` | ✅ supported | descriptive | `parallelGateway` |  |
| `bpmn:inclusiveGateway` | ✅ supported | analytic | `inclusiveGateway` |  |
| `bpmn:eventBasedGateway` | ✅ supported | analytic | `eventBasedGateway` |  |
| `bpmn:complexGateway` | ✅ supported | extended | `complexGateway` |  |
| `bpmn:sequenceFlow` | ✅ supported | descriptive | `sequenceFlow` |  |
| `bpmn:messageFlow` | ✅ supported | descriptive | `messageFlow` |  |
| `bpmn:association` | ✅ supported | descriptive | `association` |  |
| `bpmn:dataAssociation` | ✅ supported | analytic | `dataAssociation` | dataInput/OutputAssociation nested in activities; bpmn.io-style synthesized property targets resolve to the owning activity. |
| `bpmn:participant (pool)` | ✅ supported | descriptive | `pool` | v1 profile: N participants map onto a single process. |
| `bpmn:lane / laneSet` | ✅ supported | descriptive | `lane` | Interactive membership via flowNodeRefs. |
| `bpmn:dataObjectReference` | ✅ supported | analytic | `dataObject` |  |
| `bpmn:dataStoreReference` | ✅ supported | analytic | `dataStore` | Native dataStoreRef attribute; root-level <dataStore> declarations are not modelled. |
| `bpmn:textAnnotation` | ✅ supported | descriptive | `textAnnotation` |  |
| `bpmn:group` | ✅ supported | analytic | `group` |  |
| `bpmndi:BPMNDiagram / BPMNShape / BPMNEdge` | ✅ supported | descriptive | — | Missing DI falls back to an automatic layered layout (warning; grid when pools/lanes are present). |
| `conversation / choreography diagrams` | ⛔ unsupported | extended | — | Deliberately out of scope. |

## Comparativo — declarações de terceiros (Handoff 14 §1g)

> **Regra de honestidade:** as células de terceiros refletem SOMENTE o que a
> documentação do próprio fornecedor declara (link no cabeçalho da coluna) —
> nunca verificação ou claim nosso sobre concorrentes. "—" significa apenas
> "sem declaração registrada na fonte", **não** falta de suporte.

| Element | bpmn-react | [bpmn-js (bpmn.io)](https://bpmn.io/toolkit/bpmn-js/) | [Camunda 8 (Zeebe)](https://docs.camunda.io/docs/components/modeler/bpmn/bpmn-coverage/) |
|---|---|---|---|
| `bpmn:task` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:userTask` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:serviceTask` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:scriptTask` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:sendTask` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:receiveTask` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:manualTask` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:businessRuleTask` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:subProcess` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:subProcess @triggeredByEvent` | ✅ supported | modela (declarado) | — |
| `bpmn:startEvent @isInterrupting` | ✅ supported | modela (declarado) | — |
| `bpmn:callActivity` | ✅ supported | modela (declarado) | executa (declarado) |
| `btv:agentTask (extension)` | ✅ supported | — | — |
| `bpmn:transaction` | ⛔ unsupported | modela (declarado) | — |
| `bpmn:adHocSubProcess` | ⛔ unsupported | modela (declarado) | — |
| `loopCharacteristics (standard)` | ✅ supported | modela (declarado) | — |
| `loopCharacteristics (multiInstance)` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:startEvent` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:endEvent` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:intermediateCatchEvent` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:intermediateThrowEvent` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:boundaryEvent` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:message (root)` | ✅ supported | modela (declarado) | — |
| `bpmn:signal (root)` | ✅ supported | modela (declarado) | — |
| `bpmn:error (root)` | ✅ supported | modela (declarado) | — |
| `bpmn:escalation (root)` | ✅ supported | modela (declarado) | — |
| `bpmn:messageEventDefinition` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:timerEventDefinition` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:timeDate` | ✅ supported | modela (declarado) | — |
| `bpmn:timeDuration` | ✅ supported | modela (declarado) | — |
| `bpmn:timeCycle` | ✅ supported | modela (declarado) | — |
| `bpmn:errorEventDefinition` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:signalEventDefinition` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:escalationEventDefinition` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:compensateEventDefinition` | ✅ supported | modela (declarado) | — |
| `bpmn:conditionalEventDefinition` | ✅ supported | modela (declarado) | — |
| `bpmn:linkEventDefinition` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:terminateEventDefinition` | ✅ supported | modela (declarado) | executa (declarado) |
| `eventSubProcess` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:exclusiveGateway` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:parallelGateway` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:inclusiveGateway` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:eventBasedGateway` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:complexGateway` | ✅ supported | modela (declarado) | — |
| `bpmn:sequenceFlow` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:messageFlow` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:association` | ✅ supported | modela (declarado) | — |
| `bpmn:dataAssociation` | ✅ supported | modela (declarado) | — |
| `bpmn:participant (pool)` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:lane / laneSet` | ✅ supported | modela (declarado) | executa (declarado) |
| `bpmn:dataObjectReference` | ✅ supported | modela (declarado) | — |
| `bpmn:dataStoreReference` | ✅ supported | modela (declarado) | — |
| `bpmn:textAnnotation` | ✅ supported | modela (declarado) | — |
| `bpmn:group` | ✅ supported | modela (declarado) | — |
| `bpmndi:BPMNDiagram / BPMNShape / BPMNEdge` | ✅ supported | modela (declarado) | — |
| `conversation / choreography diagrams` | ⛔ unsupported | — | — |

Interoperability is exercised by the corpus in `packages/conformance/corpus/`
(structural equivalents of Camunda Modeler / bpmn.io / OMG-spec exports —
see each file header): every file must import without a fatal error and the
re-export must re-import identically (`normalizeForDiff`); the per-file
warning counts are snapshotted so fidelity regressions are detectable.

## Passthrough de extensões estrangeiras (`zeebe:*`/`camunda:*`)

Conteúdo de extensão de OUTROS namespaces não é descartado: filhos estrangeiros de
`extensionElements` (nó, aresta e processo), atributos prefixados estrangeiros e as
declarações `xmlns:*` do root round-tripam — semanticamente lossless na importação,
byte-estável entre exports do bpmn-react. Contrato de normalização (trim/CDATA) e
detalhes em `docs/format-spec.md` §"Foreign extension passthrough".

## Corpus real vs gerado (Handoff 11 N-2)

- **Gerados (commitados):** 60 arquivos em `corpus/` — equivalentes
  estruturais, zero material proprietário.
- **Reais (fetch em CI):** ≥ 20 exigidos pelo gate (cap 40), baixados por
  `pnpm fetch:corpus` para `corpus-external/` (git-ignorado) a partir de:
  - `bpmn-io/bpmn-js-examples` (MIT)
  - `camunda/camunda-get-started-quickstart` (Apache-2.0)
- **Proveniência:** origem + licença POR ARQUIVO vivem no `corpus-external/MANIFEST.json`,
  nunca como header dentro do arquivo — a suíte de round-trip exercita os bytes
  exatos do upstream, e um header os alteraria (decisão em pendencias.md §13).

## `certify --strict` vs validação XSD

O flag `--strict` do CLI transforma o passe estrutural em GATE (exit 1 quando há
violações). Ele valida contra o **manifesto estrutural** destilado dos XSDs
oficiais (BPMN20.xsd/Semantic.xsd: atributos obrigatórios + pais legais do perfil
suportado — `packages/conformance/src/manifest.ts`). Isso **NÃO é validação XSD
integral** (sem facets de tipo, sem content models completos) — por honestidade,
o flag deliberadamente não se chama `--xsd`; `--xsd` é rejeitado pelo CLI até
existir um validador XSD real. Exit codes: 0 ok · 1 violação (strict/require) ·
2 XML mal-formado ou uso incorreto.
