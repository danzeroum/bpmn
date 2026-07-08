/**
 * Structural validation manifest (Handoff 4 §A2).
 *
 * Chosen option (documented in pendencias.md): instead of a full XSD
 * validator — prohibitive with zero runtime deps — the rules below are a
 * hand-derived digest of the official OMG BPMN20.xsd / Semantic.xsd for the
 * elements in the supported profile: required attributes and legal direct
 * parents. It catches the structural mistakes that break interchange
 * (flows without endpoints, detached boundary events, lanes outside
 * laneSets) without a schema engine.
 */

export interface ElementRule {
  /** Attributes the XSD marks as required (profile-relevant subset). */
  requiredAttrs?: string[];
  /** Legal direct parents (local names). Omitted = unconstrained. */
  parents?: string[];
}

export const STRUCTURAL_MANIFEST: Record<string, ElementRule> = {
  definitions: {},
  process: { parents: ['definitions'] },
  collaboration: { parents: ['definitions'] },
  participant: { requiredAttrs: ['id'], parents: ['collaboration'] },
  messageFlow: { requiredAttrs: ['sourceRef', 'targetRef'], parents: ['collaboration'] },
  laneSet: { parents: ['process', 'subProcess'] },
  lane: { parents: ['laneSet'] },
  sequenceFlow: { requiredAttrs: ['sourceRef', 'targetRef'], parents: ['process', 'subProcess'] },
  association: { requiredAttrs: ['sourceRef', 'targetRef'], parents: ['process', 'subProcess'] },
  boundaryEvent: { requiredAttrs: ['id', 'attachedToRef'], parents: ['process', 'subProcess'] },
  startEvent: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  endEvent: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  intermediateCatchEvent: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  intermediateThrowEvent: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  task: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  userTask: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  serviceTask: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  scriptTask: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  sendTask: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  receiveTask: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  manualTask: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  businessRuleTask: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  callActivity: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  subProcess: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  exclusiveGateway: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  parallelGateway: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  inclusiveGateway: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  eventBasedGateway: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  complexGateway: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  dataObjectReference: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  dataStoreReference: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  textAnnotation: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  group: { requiredAttrs: ['id'], parents: ['process', 'subProcess'] },
  BPMNShape: { requiredAttrs: ['bpmnElement'] },
  BPMNEdge: { requiredAttrs: ['bpmnElement'] },
  Bounds: { requiredAttrs: ['x', 'y', 'width', 'height'] },
};
