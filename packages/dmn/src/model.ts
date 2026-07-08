import type { NodeTypeDefinition } from '@bpmn-react/core';

/**
 * DRD node types (Handoff 5 §4.1) — minimum viable DMN family. Sizes are the
 * spec's; geometry differentiates the family internally (OMG DMN notation),
 * the 185° teal step differentiates it from BPMN. The `dmn:` prefix keeps
 * the vocabulary out of the BPMN namespace, mirroring domain plugins.
 */
export const DMN_NODE_TYPES: NodeTypeDefinition[] = [
  {
    type: 'dmn:decision',
    label: 'Decision',
    category: 'custom',
    defaultSize: { width: 150, height: 60 },
    xml: { tag: 'decision' },
  },
  {
    type: 'dmn:inputData',
    label: 'Input Data',
    category: 'custom',
    defaultSize: { width: 140, height: 44 },
    xml: { tag: 'inputData' },
  },
  {
    type: 'dmn:knowledgeSource',
    label: 'Knowledge Source',
    category: 'custom',
    defaultSize: { width: 120, height: 60 },
    xml: { tag: 'knowledgeSource' },
  },
  {
    type: 'dmn:businessKnowledgeModel',
    label: 'Business Knowledge Model',
    category: 'custom',
    defaultSize: { width: 140, height: 44 },
    xml: { tag: 'businessKnowledgeModel' },
  },
];

/**
 * Requirement edge types (§4.1): one family color, differentiated by FORM —
 * information solid/filled arrow, knowledge dashed/open arrow, authority
 * dotted/filled disc. Direction in the model: source = required element,
 * target = requiring element (matches how DMN nests the requirement inside
 * the requiring element).
 */
export const DMN_EDGE_TYPES = [
  'dmn:informationRequirement',
  'dmn:knowledgeRequirement',
  'dmn:authorityRequirement',
] as const;

export type DmnEdgeType = (typeof DMN_EDGE_TYPES)[number];

/** Node types that may own each requirement kind (per the DMN spec). */
export const REQUIREMENT_OWNERS: Record<DmnEdgeType, string[]> = {
  'dmn:informationRequirement': ['dmn:decision'],
  'dmn:knowledgeRequirement': ['dmn:decision', 'dmn:businessKnowledgeModel'],
  'dmn:authorityRequirement': [
    'dmn:decision',
    'dmn:businessKnowledgeModel',
    'dmn:knowledgeSource',
  ],
};
