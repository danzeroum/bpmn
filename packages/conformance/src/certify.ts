import {
  BpmnXmlConverter,
  createDefaultRegistry,
  MiniXmlParser,
  normalizeForDiff,
  type XmlElement,
} from '@buildtovalue/core';
import { classCoverage, CONFORMANCE_MATRIX, type ConformanceEntry } from './matrix.js';
import { STRUCTURAL_MANIFEST } from './manifest.js';

export interface CertifyIssue {
  code: 'STRUCT_MISSING_ATTR' | 'STRUCT_BAD_PARENT';
  element: string;
  message: string;
}

export type CertifiableClass = 'descriptive' | 'analytic';

export interface CertifyReport {
  wellFormed: boolean;
  /** False when the document was rejected for DOCTYPE/DTD (XXE protection). */
  xxeSafe: boolean;
  /** Parser error when not well-formed. */
  parseError?: string;
  structuralIssues: CertifyIssue[];
  importWarnings: string[];
  roundTripLossless: boolean;
  /** Model elements used by the document (local names, deduplicated). */
  elementsUsed: string[];
  /** Used elements outside the supported profile (per the matrix). */
  unsupportedElements: string[];
  /**
   * Highest class this document certifies at: 'descriptive' when it only
   * uses Descriptive-class elements; 'analytic' when it also uses (supported)
   * Analytic-class elements; 'none' when it is broken or uses unsupported
   * elements or loses content on round-trip.
   */
  achievedClass: CertifiableClass | 'none';
  /** Tool-level class coverage from the conformance matrix. */
  matrixCoverage: { descriptive: number; analytic: number };
  requiredClass?: CertifiableClass;
  /** Present when `require` was requested. */
  requirementMet?: boolean;
}

/** Structure-only children (never classified as model elements). */
const IGNORED_LOCAL_NAMES = new Set([
  'definitions',
  'process',
  'collaboration',
  'laneSet',
  'extensionElements',
  'documentation',
  'incoming',
  'outgoing',
  'flowNodeRef',
  'text',
  'conditionExpression',
  // Data-association plumbing (F7-3): the associations themselves map to the
  // matrix; their ref children and bpmn.io's synthesized io wiring are
  // structure, not model elements.
  'sourceRef',
  'targetRef',
  'property',
  'ioSpecification',
  'dataInput',
  'dataOutput',
  'inputSet',
  'outputSet',
  'BPMNDiagram',
  'BPMNPlane',
  'BPMNShape',
  'BPMNEdge',
  'BPMNLabel',
  'Bounds',
  'waypoint',
]);

/** Local name → conformance matrix row. */
const LOCAL_TO_MATRIX: Record<string, string> = {
  task: 'bpmn:task',
  userTask: 'bpmn:userTask',
  serviceTask: 'bpmn:serviceTask',
  scriptTask: 'bpmn:scriptTask',
  sendTask: 'bpmn:sendTask',
  receiveTask: 'bpmn:receiveTask',
  manualTask: 'bpmn:manualTask',
  businessRuleTask: 'bpmn:businessRuleTask',
  subProcess: 'bpmn:subProcess',
  callActivity: 'bpmn:callActivity',
  transaction: 'bpmn:transaction',
  adHocSubProcess: 'bpmn:adHocSubProcess',
  standardLoopCharacteristics: 'loopCharacteristics (standard)',
  multiInstanceLoopCharacteristics: 'loopCharacteristics (multiInstance)',
  startEvent: 'bpmn:startEvent',
  endEvent: 'bpmn:endEvent',
  intermediateCatchEvent: 'bpmn:intermediateCatchEvent',
  intermediateThrowEvent: 'bpmn:intermediateThrowEvent',
  boundaryEvent: 'bpmn:boundaryEvent',
  messageEventDefinition: 'bpmn:messageEventDefinition',
  timerEventDefinition: 'bpmn:timerEventDefinition',
  errorEventDefinition: 'bpmn:errorEventDefinition',
  signalEventDefinition: 'bpmn:signalEventDefinition',
  escalationEventDefinition: 'bpmn:escalationEventDefinition',
  conditionalEventDefinition: 'bpmn:conditionalEventDefinition',
  linkEventDefinition: 'bpmn:linkEventDefinition',
  terminateEventDefinition: 'bpmn:terminateEventDefinition',
  // Named-definition roots (Handoff 16 §3a / Handoff 18 §5a): supported model
  // elements carrying the definitions that events reference by *Ref.
  message: 'bpmn:message (root)',
  signal: 'bpmn:signal (root)',
  error: 'bpmn:error (root)',
  escalation: 'bpmn:escalation (root)',
  exclusiveGateway: 'bpmn:exclusiveGateway',
  parallelGateway: 'bpmn:parallelGateway',
  inclusiveGateway: 'bpmn:inclusiveGateway',
  eventBasedGateway: 'bpmn:eventBasedGateway',
  complexGateway: 'bpmn:complexGateway',
  sequenceFlow: 'bpmn:sequenceFlow',
  messageFlow: 'bpmn:messageFlow',
  association: 'bpmn:association',
  dataInputAssociation: 'bpmn:dataAssociation',
  dataOutputAssociation: 'bpmn:dataAssociation',
  participant: 'bpmn:participant (pool)',
  lane: 'bpmn:lane / laneSet',
  dataObjectReference: 'bpmn:dataObjectReference',
  dataObject: 'bpmn:dataObjectReference',
  dataStoreReference: 'bpmn:dataStoreReference',
  textAnnotation: 'bpmn:textAnnotation',
  group: 'bpmn:group',
};

const MATRIX_BY_ELEMENT = new Map<string, ConformanceEntry>(
  CONFORMANCE_MATRIX.map((entry) => [entry.element, entry]),
);

function localName(tag: string): string {
  const index = tag.indexOf(':');
  return index === -1 ? tag : tag.slice(index + 1);
}

function walk(el: XmlElement, parent: XmlElement | null, visit: (el: XmlElement, parent: XmlElement | null) => void): void {
  visit(el, parent);
  // Vendor content inside <extensionElements> is opaque by spec (BPMN 2.0
  // §8.2.3 ExtensionElements): it is NOT part of the process model and must
  // not count against the conformance matrix — otherwise any tool's own
  // export (bpmnr:*, camunda:*, …) would certify as 'none'.
  if (localName(el.tag) === 'extensionElements') return;
  for (const child of el.children) walk(child, el, visit);
}

/**
 * Certifies a BPMN document (Handoff 4 §A2): well-formedness + XXE safety,
 * structural manifest validation, import warnings, round-trip losslessness
 * and the conformance class the document achieves. Pure — no I/O; the CLI
 * `certify` command wraps it.
 */
export function certifyXml(
  xml: string,
  options: { require?: CertifiableClass } = {},
): CertifyReport {
  const matrixCoverage = {
    descriptive: classCoverage(CONFORMANCE_MATRIX, 'descriptive'),
    analytic: classCoverage(CONFORMANCE_MATRIX, 'analytic'),
  };
  const base: CertifyReport = {
    wellFormed: true,
    xxeSafe: true,
    structuralIssues: [],
    importWarnings: [],
    roundTripLossless: false,
    elementsUsed: [],
    unsupportedElements: [],
    achievedClass: 'none',
    matrixCoverage,
    ...(options.require ? { requiredClass: options.require } : {}),
  };

  let root: XmlElement;
  try {
    root = new MiniXmlParser().parse(xml);
  } catch (cause) {
    const message = (cause as Error).message;
    const xxe = /doctype/i.test(message);
    return {
      ...base,
      wellFormed: false,
      xxeSafe: !xxe,
      parseError: message,
      ...(options.require ? { requirementMet: false } : {}),
    };
  }

  // Structural manifest pass (XSD digest — see manifest.ts).
  const used = new Set<string>();
  walk(root, null, (el, parent) => {
    const name = localName(el.tag);
    if (!IGNORED_LOCAL_NAMES.has(name)) used.add(name);
    const rule = STRUCTURAL_MANIFEST[name];
    if (!rule) return;
    for (const attr of rule.requiredAttrs ?? []) {
      if (el.attributes[attr] === undefined || el.attributes[attr] === '') {
        base.structuralIssues.push({
          code: 'STRUCT_MISSING_ATTR',
          element: name,
          message: `<${el.tag}${el.attributes.id ? ` id="${el.attributes.id}"` : ''}> is missing required attribute "${attr}"`,
        });
      }
    }
    if (rule.parents && parent && !rule.parents.includes(localName(parent.tag))) {
      base.structuralIssues.push({
        code: 'STRUCT_BAD_PARENT',
        element: name,
        message: `<${el.tag}> is not allowed under <${parent.tag}> (expected: ${rule.parents.join(', ')})`,
      });
    }
  });
  base.elementsUsed = [...used].sort();

  // Profile classification per the conformance matrix.
  let highestClass: CertifiableClass = 'descriptive';
  for (const name of base.elementsUsed) {
    const key = LOCAL_TO_MATRIX[name];
    const entry = key ? MATRIX_BY_ELEMENT.get(key) : undefined;
    if (!entry || entry.status === 'unsupported' || entry.status === 'degraded') {
      base.unsupportedElements.push(name);
      continue;
    }
    if (entry.conformanceClass !== 'descriptive') highestClass = 'analytic';
  }
  base.unsupportedElements.sort();

  // Import + round-trip losslessness.
  const converter = () => new BpmnXmlConverter({ registry: createDefaultRegistry() });
  try {
    const first = converter().fromXml(xml);
    base.importWarnings = first.warnings;
    const reExport = converter().toXml(first.diagram);
    const second = converter().fromXml(reExport);
    base.roundTripLossless =
      JSON.stringify(normalizeForDiff(second.diagram)) ===
      JSON.stringify(normalizeForDiff(first.diagram));
  } catch (cause) {
    base.importWarnings = [`Import failed: ${(cause as Error).message}`];
    base.roundTripLossless = false;
  }

  const certifiable =
    base.structuralIssues.length === 0 &&
    base.unsupportedElements.length === 0 &&
    base.roundTripLossless;
  base.achievedClass = certifiable ? highestClass : 'none';

  if (options.require) {
    base.requirementMet =
      base.achievedClass !== 'none' &&
      (options.require === 'analytic' || base.achievedClass === 'descriptive');
  }
  return base;
}
