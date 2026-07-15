import { CONFORMANCE_MATRIX } from './matrix.js';

/**
 * Third-party comparative columns (Handoff 14 §1g). HONESTY RULE, binding:
 * every cell reflects ONLY what the vendor's own documentation declares —
 * "declarado pela doc deles", linked per column — never our own testing or
 * claims about a competitor. An element absent from `declaredElements`
 * renders "—" (no recorded declaration), which is NOT a claim of absence.
 * Updating a column = re-reading THEIR doc and adjusting this fixture.
 */
export interface ThirdPartyDeclaration {
  /** Column header, e.g. 'bpmn-js (bpmn.io)'. */
  vendor: string;
  /** The vendor documentation page the declarations were read from. */
  sourceUrl: string;
  /** Short claim rendered in declared cells, e.g. 'modela' / 'executa'. */
  claim: string;
  /** Matrix elements THEIR doc declares as covered. */
  declaredElements: string[];
}

/** Every spec element of our matrix (excludes our own btv: extension). */
const SPEC_ELEMENTS = CONFORMANCE_MATRIX.map((entry) => entry.element).filter(
  (element) => !element.startsWith('btv:'),
);

export const THIRD_PARTY_DECLARATIONS: ThirdPartyDeclaration[] = [
  {
    vendor: 'bpmn-js (bpmn.io)',
    sourceUrl: 'https://bpmn.io/toolkit/bpmn-js/',
    claim: 'modela (declarado)',
    // bpmn.io declares BPMN 2.0 rendering/modeling coverage; conversation and
    // choreography diagram kinds are not part of the declared toolkit scope.
    declaredElements: SPEC_ELEMENTS.filter(
      (element) => element !== 'conversation / choreography diagrams',
    ),
  },
  {
    vendor: 'Camunda 8 (Zeebe)',
    sourceUrl: 'https://docs.camunda.io/docs/components/modeler/bpmn/bpmn-coverage/',
    claim: 'executa (declarado)',
    // Elements the Camunda 8 BPMN coverage page lists as implemented by the
    // engine. Conspicuous absences on their page (complex gateway,
    // conditional events, transaction/ad-hoc sub-process) render "—".
    declaredElements: [
      'bpmn:task',
      'bpmn:userTask',
      'bpmn:serviceTask',
      'bpmn:scriptTask',
      'bpmn:sendTask',
      'bpmn:receiveTask',
      'bpmn:manualTask',
      'bpmn:businessRuleTask',
      'bpmn:subProcess',
      'bpmn:callActivity',
      'loopCharacteristics (multiInstance)',
      'bpmn:startEvent',
      'bpmn:endEvent',
      'bpmn:intermediateCatchEvent',
      'bpmn:intermediateThrowEvent',
      'bpmn:boundaryEvent',
      'bpmn:messageEventDefinition',
      'bpmn:timerEventDefinition',
      'bpmn:errorEventDefinition',
      'bpmn:signalEventDefinition',
      'bpmn:escalationEventDefinition',
      'bpmn:linkEventDefinition',
      'bpmn:terminateEventDefinition',
      'eventSubProcess',
      'bpmn:exclusiveGateway',
      'bpmn:parallelGateway',
      'bpmn:inclusiveGateway',
      'bpmn:eventBasedGateway',
      'bpmn:sequenceFlow',
      'bpmn:messageFlow',
      'bpmn:participant (pool)',
      'bpmn:lane / laneSet',
    ],
  },
];
