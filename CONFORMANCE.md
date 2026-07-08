# BPMN 2.0 Conformance

<!-- GENERATED FILE — do not edit by hand.
     Source of truth: packages/conformance/src/matrix.ts
     Regenerate with: node scripts/gen-conformance.mjs -->

Element-by-element conformance of the bpmn-react import/export profile
(`@bpmn-react/core` BpmnXmlConverter). Statuses: **supported** — imports,
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
| `bpmn:callActivity` | ✅ supported | descriptive | `callActivity` | Native calledElement; @bpmn-react/registry resolves the called process version (resolveCallActivities/activeAt). |
| `bpmn:transaction` | ⛔ unsupported | extended | — | Deliberately out of scope before v2.x. |
| `bpmn:adHocSubProcess` | ⛔ unsupported | extended | — |  |
| `loopCharacteristics (standard)` | ✅ supported | analytic | `activity marker` |  |
| `loopCharacteristics (multiInstance)` | ✅ supported | analytic | `activity marker` | Sequential and parallel markers. |
| `bpmn:startEvent` | ✅ supported | descriptive | `startEvent` |  |
| `bpmn:endEvent` | ✅ supported | descriptive | `endEvent` |  |
| `bpmn:intermediateCatchEvent` | ✅ supported | analytic | `intermediateCatchEvent` |  |
| `bpmn:intermediateThrowEvent` | ✅ supported | analytic | `intermediateThrowEvent` |  |
| `bpmn:boundaryEvent` | ✅ supported | analytic | `boundaryEvent` | Interrupting and non-interrupting (cancelActivity). |
| `bpmn:messageEventDefinition` | ✅ supported | analytic | `eventDefinition: 'message'` |  |
| `bpmn:timerEventDefinition` | ✅ supported | analytic | `eventDefinition: 'timer'` |  |
| `bpmn:errorEventDefinition` | ✅ supported | analytic | `eventDefinition: 'error'` |  |
| `bpmn:signalEventDefinition` | ✅ supported | analytic | `eventDefinition: 'signal'` |  |
| `bpmn:escalationEventDefinition` | ✅ supported | analytic | `eventDefinition: 'escalation'` |  |
| `bpmn:conditionalEventDefinition` | ✅ supported | analytic | `eventDefinition: 'conditional'` |  |
| `bpmn:linkEventDefinition` | ✅ supported | analytic | `eventDefinition: 'link'` |  |
| `bpmn:terminateEventDefinition` | ✅ supported | analytic | `eventDefinition: 'terminate'` |  |
| `eventSubProcess` | ⛔ unsupported | extended | — | Deliberately out of scope before v2.x. |
| `bpmn:exclusiveGateway` | ✅ supported | descriptive | `exclusiveGateway` |  |
| `bpmn:parallelGateway` | ✅ supported | descriptive | `parallelGateway` |  |
| `bpmn:inclusiveGateway` | ✅ supported | analytic | `inclusiveGateway` |  |
| `bpmn:eventBasedGateway` | ✅ supported | analytic | `eventBasedGateway` |  |
| `bpmn:complexGateway` | ⛔ unsupported | extended | — | Ignored with a warning (import degrades). |
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
| `bpmndi:BPMNDiagram / BPMNShape / BPMNEdge` | ✅ supported | descriptive | — | Missing DI falls back to an automatic grid layout (warning). |
| `conversation / choreography diagrams` | ⛔ unsupported | extended | — | Deliberately out of scope. |

Interoperability is exercised by the corpus in `packages/conformance/corpus/`
(structural equivalents of Camunda Modeler / bpmn.io / OMG-spec exports —
see each file header): every file must import without a fatal error and the
re-export must re-import identically (`normalizeForDiff`); the per-file
warning counts are snapshotted so fidelity regressions are detectable.
