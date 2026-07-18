/**
 * Element-by-element conformance matrix (Handoff 4 §A1). This module is the
 * single source of truth: `CONFORMANCE.md` is rendered from it (freshness
 * checked in CI, same pattern as the apiSurface tests) and the matrix tests
 * cross-check every `supported` element against the core registry/converter.
 */

/**
 * - `supported`: imports, renders, exports and round-trips losslessly.
 * - `partial`: model + render + round-trip work; some interactions pending.
 * - `degraded`: imported with a warning and downgraded to a supported form.
 * - `unsupported`: ignored on import with a warning (roadmap candidates).
 */
export type ConformanceStatus = 'supported' | 'partial' | 'degraded' | 'unsupported';

/** OMG conformance sub-class the element counts toward. */
export type ConformanceClass = 'descriptive' | 'analytic' | 'extended';

export interface ConformanceEntry {
  /** BPMN element (or event definition), e.g. 'bpmn:userTask'. */
  element: string;
  status: ConformanceStatus;
  conformanceClass: ConformanceClass;
  /** Internal node/edge type or event definition key, when applicable. */
  mappedTo?: string;
  notes?: string;
}

export const CONFORMANCE_MATRIX: ConformanceEntry[] = [
  // Flow objects — activities
  { element: 'bpmn:task', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'task' },
  { element: 'bpmn:userTask', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'userTask' },
  { element: 'bpmn:serviceTask', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'serviceTask' },
  { element: 'bpmn:scriptTask', status: 'supported', conformanceClass: 'analytic', mappedTo: 'scriptTask' },
  { element: 'bpmn:sendTask', status: 'supported', conformanceClass: 'analytic', mappedTo: 'sendTask' },
  { element: 'bpmn:receiveTask', status: 'supported', conformanceClass: 'analytic', mappedTo: 'receiveTask' },
  { element: 'bpmn:manualTask', status: 'supported', conformanceClass: 'analytic', mappedTo: 'manualTask' },
  { element: 'bpmn:businessRuleTask', status: 'supported', conformanceClass: 'analytic', mappedTo: 'businessRuleTask', notes: 'DMN table glyph + decision-link badge (properties.decisionRef); decision table editor lands with Handoff 5 F-B.' },
  { element: 'bpmn:subProcess', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'subProcess', notes: 'Nested children as first-class nodes (lossless round-trip, DI isExpanded); expand/collapse and drill-down in the editor.' },
  { element: 'bpmn:callActivity', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'callActivity', notes: 'Native calledElement; @buildtovalue/registry resolves the called process version (resolveCallActivities/activeAt).' },
  { element: 'btv:agentTask (extension)', status: 'supported', conformanceClass: 'extended', mappedTo: 'agentTask', notes: 'Agent Lane (Handoff 12): a governed AI-agent sub-workflow. Exports as bpmn:task (external editors read it as a plain task — graceful degradation); agentWorkflowRef/autonomyLevel/mappings + an optional read-degraded snapshot ride in extensionElements. The @buildtovalue/agentflow schema/simulation back it.' },
  { element: 'bpmn:transaction', status: 'unsupported', conformanceClass: 'extended', notes: 'Deliberately out of scope before v2.x.' },
  { element: 'bpmn:adHocSubProcess', status: 'unsupported', conformanceClass: 'extended' },
  { element: 'loopCharacteristics (standard)', status: 'supported', conformanceClass: 'analytic', mappedTo: 'activity marker' },
  { element: 'loopCharacteristics (multiInstance)', status: 'supported', conformanceClass: 'analytic', mappedTo: 'activity marker', notes: 'Sequential and parallel markers.' },
  // Flow objects — events
  { element: 'bpmn:startEvent', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'startEvent' },
  { element: 'bpmn:endEvent', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'endEvent' },
  { element: 'bpmn:intermediateCatchEvent', status: 'supported', conformanceClass: 'analytic', mappedTo: 'intermediateCatchEvent' },
  { element: 'bpmn:intermediateThrowEvent', status: 'supported', conformanceClass: 'analytic', mappedTo: 'intermediateThrowEvent' },
  { element: 'bpmn:boundaryEvent', status: 'supported', conformanceClass: 'analytic', mappedTo: 'boundaryEvent', notes: 'Interrupting and non-interrupting (cancelActivity).' },
  // Handoff 16 E-1 (§3a): named definitions as first-class OMG root elements.
  { element: 'bpmn:message (root)', status: 'supported', conformanceClass: 'analytic', mappedTo: 'definitions.messages[]', notes: 'Named definition; events reference via messageRef (properties.eventDefinitionRef). Orphan refs are synthesized with an informative warning.' },
  { element: 'bpmn:signal (root)', status: 'supported', conformanceClass: 'analytic', mappedTo: 'definitions.signals[]', notes: 'Named definition; referenced via signalRef.' },
  { element: 'bpmn:error (root)', status: 'supported', conformanceClass: 'analytic', mappedTo: 'definitions.errors[]', notes: 'Named definition with errorCode; referenced via errorRef.' },
  { element: 'bpmn:messageEventDefinition', status: 'supported', conformanceClass: 'analytic', mappedTo: "eventDefinition: 'message'" },
  { element: 'bpmn:timerEventDefinition', status: 'supported', conformanceClass: 'analytic', mappedTo: "eventDefinition: 'timer'" },
  { element: 'bpmn:errorEventDefinition', status: 'supported', conformanceClass: 'analytic', mappedTo: "eventDefinition: 'error'" },
  { element: 'bpmn:signalEventDefinition', status: 'supported', conformanceClass: 'analytic', mappedTo: "eventDefinition: 'signal'" },
  { element: 'bpmn:escalationEventDefinition', status: 'supported', conformanceClass: 'analytic', mappedTo: "eventDefinition: 'escalation'" },
  { element: 'bpmn:conditionalEventDefinition', status: 'supported', conformanceClass: 'analytic', mappedTo: "eventDefinition: 'conditional'" },
  { element: 'bpmn:linkEventDefinition', status: 'supported', conformanceClass: 'analytic', mappedTo: "eventDefinition: 'link'" },
  { element: 'bpmn:terminateEventDefinition', status: 'supported', conformanceClass: 'analytic', mappedTo: "eventDefinition: 'terminate'" },
  { element: 'eventSubProcess', status: 'unsupported', conformanceClass: 'extended', notes: 'Deliberately out of scope before v2.x.' },
  // Flow objects — gateways
  { element: 'bpmn:exclusiveGateway', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'exclusiveGateway' },
  { element: 'bpmn:parallelGateway', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'parallelGateway' },
  { element: 'bpmn:inclusiveGateway', status: 'supported', conformanceClass: 'analytic', mappedTo: 'inclusiveGateway' },
  { element: 'bpmn:eventBasedGateway', status: 'supported', conformanceClass: 'analytic', mappedTo: 'eventBasedGateway' },
  { element: 'bpmn:complexGateway', status: 'supported', conformanceClass: 'extended', mappedTo: 'complexGateway' },
  // Connecting objects
  { element: 'bpmn:sequenceFlow', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'sequenceFlow' },
  { element: 'bpmn:messageFlow', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'messageFlow' },
  { element: 'bpmn:association', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'association' },
  { element: 'bpmn:dataAssociation', status: 'supported', conformanceClass: 'analytic', mappedTo: 'dataAssociation', notes: 'dataInput/OutputAssociation nested in activities; bpmn.io-style synthesized property targets resolve to the owning activity.' },
  // Swimlanes
  { element: 'bpmn:participant (pool)', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'pool', notes: 'v1 profile: N participants map onto a single process.' },
  { element: 'bpmn:lane / laneSet', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'lane', notes: 'Interactive membership via flowNodeRefs.' },
  // Artifacts & data
  { element: 'bpmn:dataObjectReference', status: 'supported', conformanceClass: 'analytic', mappedTo: 'dataObject' },
  { element: 'bpmn:dataStoreReference', status: 'supported', conformanceClass: 'analytic', mappedTo: 'dataStore', notes: 'Native dataStoreRef attribute; root-level <dataStore> declarations are not modelled.' },
  { element: 'bpmn:textAnnotation', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'textAnnotation' },
  { element: 'bpmn:group', status: 'supported', conformanceClass: 'analytic', mappedTo: 'group' },
  // DI
  { element: 'bpmndi:BPMNDiagram / BPMNShape / BPMNEdge', status: 'supported', conformanceClass: 'descriptive', notes: 'Missing DI falls back to an automatic layered layout (warning; grid when pools/lanes are present).' },
  // Other diagram kinds
  { element: 'conversation / choreography diagrams', status: 'unsupported', conformanceClass: 'extended', notes: 'Deliberately out of scope.' },
];

/** Percentage of a class' elements that are usable (supported or partial). */
export function classCoverage(entries: ConformanceEntry[], klass: ConformanceClass): number {
  const relevant = entries.filter((entry) => entry.conformanceClass === klass);
  if (relevant.length === 0) return 100;
  const usable = relevant.filter(
    (entry) => entry.status === 'supported' || entry.status === 'partial',
  );
  return Math.round((usable.length / relevant.length) * 100);
}
