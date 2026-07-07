import {
  activeEdges,
  activeNodes,
  type BpmnDiagram,
  type NodeTypeDefinition,
  type ValidationIssue,
  type ValidationRule,
} from '@bpmn-react/core';
import type { BpmnPlugin } from '@bpmn-react/react';
import {
  ConnectorShape,
  DeliverableShape,
  GateShape,
  PersonaShape,
  PromptShape,
  SquadShape,
} from './shapes.js';

export * from './shapes.js';

/** Domain edge types layered on top of the generic model. */
export const DOMAIN_EDGE_TYPES = ['handoff', 'approval', 'feedback', 'escalation'] as const;

/**
 * Domain vocabulary mapped onto interoperable BPMN tags: exported files open
 * in any BPMN tool; the domain identity round-trips via extensionElements.
 */
export const DOMAIN_NODE_TYPES: NodeTypeDefinition[] = [
  { type: 'btv:squad', label: 'Squad', category: 'custom', defaultSize: { width: 180, height: 100 }, xml: { tag: 'subProcess' } },
  { type: 'btv:persona', label: 'Persona', category: 'custom', defaultSize: { width: 150, height: 56 }, xml: { tag: 'userTask' } },
  { type: 'btv:gate', label: 'Approval Gate', category: 'custom', defaultSize: { width: 72, height: 56 }, xml: { tag: 'inclusiveGateway' } },
  { type: 'btv:prompt', label: 'Prompt', category: 'custom', defaultSize: { width: 130, height: 64 }, xml: { tag: 'scriptTask' } },
  { type: 'btv:connector', label: 'Connector', category: 'custom', defaultSize: { width: 130, height: 60 }, xml: { tag: 'serviceTask' } },
  { type: 'btv:deliverable', label: 'Deliverable', category: 'custom', defaultSize: { width: 120, height: 70 }, xml: { tag: 'endEvent' } },
];

/** Approval gates accept a single predecessor (single-funnel approvals). */
export const gateSinglePredecessorRule: ValidationRule = (diagram: BpmnDiagram) => {
  const issues: ValidationIssue[] = [];
  const edges = activeEdges(diagram);
  for (const gate of activeNodes(diagram).filter((n) => n.type === 'btv:gate')) {
    const incoming = edges.filter((e) => e.targetId === gate.id);
    if (incoming.length > 1) {
      issues.push({
        code: 'GATE_MULTIPLE_PREDECESSORS',
        severity: 'error',
        message: `Gate "${gate.label}" has ${incoming.length} incoming connections (max 1)`,
        nodeId: gate.id,
      });
    }
  }
  return issues;
};

/** Every squad must have at least one persona connected. */
export const squadNeedsPersonaRule: ValidationRule = (diagram: BpmnDiagram) => {
  const issues: ValidationIssue[] = [];
  const edges = activeEdges(diagram);
  const nodes = activeNodes(diagram);
  for (const squad of nodes.filter((n) => n.type === 'btv:squad')) {
    const connected = edges.some((edge) => {
      const other =
        edge.sourceId === squad.id
          ? diagram.nodes[edge.targetId]
          : edge.targetId === squad.id
            ? diagram.nodes[edge.sourceId]
            : undefined;
      return other?.type === 'btv:persona';
    });
    if (!connected) {
      issues.push({
        code: 'SQUAD_WITHOUT_PERSONA',
        severity: 'error',
        message: `Squad "${squad.label}" has no personas connected`,
        nodeId: squad.id,
      });
    }
  }
  return issues;
};

/** Handoffs are contracts: they must declare a purpose. */
export const handoffNeedsPurposeRule: ValidationRule = (diagram: BpmnDiagram) => {
  return activeEdges(diagram)
    .filter((e) => e.type === 'handoff' && !(e.purpose ?? '').trim())
    .map((e) => ({
      code: 'HANDOFF_WITHOUT_PURPOSE',
      severity: 'warning' as const,
      message: `Handoff ${e.id} has no purpose declared`,
      edgeId: e.id,
    }));
};

/**
 * The example domain plugin. Use it as-is or as a template for your own
 * vocabulary:
 *
 * ```tsx
 * <BpmnEditor diagram={diagram} plugins={[domainExamplePlugin]} />
 * ```
 */
export const domainExamplePlugin: BpmnPlugin = {
  id: 'bpmn-react/domain-example',
  name: 'Squad / Persona / Gate example domain',
  nodeTypes: DOMAIN_NODE_TYPES,
  shapes: {
    'btv:squad': SquadShape,
    'btv:persona': PersonaShape,
    'btv:gate': GateShape,
    'btv:prompt': PromptShape,
    'btv:connector': ConnectorShape,
    'btv:deliverable': DeliverableShape,
  },
  paletteItems: [
    { id: 'btv-squad', label: 'Squad', nodeType: 'btv:squad', icon: '⬚' },
    { id: 'btv-persona', label: 'Persona', nodeType: 'btv:persona', icon: '👤', defaultProperties: { role: '' } },
    { id: 'btv-gate', label: 'Approval Gate', nodeType: 'btv:gate', icon: '✋', defaultProperties: { approved: false } },
    { id: 'btv-prompt', label: 'Prompt', nodeType: 'btv:prompt', icon: '📝' },
    { id: 'btv-connector', label: 'Connector', nodeType: 'btv:connector', icon: '🔌' },
    { id: 'btv-deliverable', label: 'Deliverable', nodeType: 'btv:deliverable', icon: '🏁' },
  ],
  validationRules: [gateSinglePredecessorRule, squadNeedsPersonaRule, handoffNeedsPurposeRule],
  registerRules: (engine) => {
    // Approved gates are frozen: incoming/outgoing rewiring must go through a
    // new revision of the gate, not silent edits.
    engine.register<{ sourceId: string; targetId: string }>('edge.connect.pre', (payload, diagram) => {
      const target = diagram.nodes[payload.targetId];
      if (target?.type === 'btv:gate' && target.properties.approved === true) {
        return { allowed: false, reason: `Gate "${target.label}" is already approved — supersede it instead` };
      }
      return { allowed: true };
    });
  },
};

export default domainExamplePlugin;
