import type { NodeTypeDefinition } from '@bpmn-react/core';

/**
 * Healthcare vocabulary (Handoff 5 §6): every clinical type maps to a
 * standard BPMN element (`xml.tag`), so the export stays interoperable —
 * third-party tools read plain BPMN while `bpmnr:meta type` preserves the
 * clinical identity for lossless round-trips (same mechanism as the btv
 * and dmn families).
 */
export const HC_NODE_TYPES: NodeTypeDefinition[] = [
  {
    type: 'hc:clinicalTask',
    label: 'Clinical Task',
    category: 'custom',
    defaultSize: { width: 120, height: 60 },
    xml: { tag: 'userTask' },
    visual: { shadow: true },
  },
  {
    type: 'hc:clinicalDecision',
    label: 'Clinical Decision',
    category: 'custom',
    defaultSize: { width: 120, height: 60 },
    xml: { tag: 'businessRuleTask' },
    visual: { shadow: true },
  },
  {
    type: 'hc:guideline',
    label: 'Guideline',
    category: 'custom',
    defaultSize: { width: 110, height: 70 },
    xml: { tag: 'dataObjectReference' },
  },
  {
    type: 'hc:pathwayGate',
    label: 'Pathway Gate',
    category: 'custom',
    defaultSize: { width: 56, height: 56 },
    xml: { tag: 'exclusiveGateway' },
  },
];
