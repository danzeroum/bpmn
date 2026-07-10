import {
  activeEdges,
  activeNodes,
  type BpmnDiagram,
  type NodeTypeDefinition,
  type ValidationIssue,
  type ValidationRule,
} from '@buildtovalue/core';
import type { BpmnPlugin, EdgeStyle } from '@buildtovalue/react';
import {
  BTV_PALETTE_ICONS,
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
 * Visual language for the domain edge types (§5.4). Colors are `var(--btv-*)`
 * so dark mode and export stay correct; the EdgeRenderer composes these with
 * the closed/selected states. A handoff carries a purpose chip (paired with
 * `handoffNeedsPurposeRule`); an approval carries a check disc.
 */
export const DOMAIN_EDGE_STYLES: Record<string, EdgeStyle> = {
  handoff: {
    stroke: 'var(--btv-edge-handoff, #44403a)',
    strokeWidth: 1.5,
    marker: 'filled',
    midDecoration: 'purpose-chip',
  },
  approval: {
    stroke: 'var(--btv-edge-approval, #1a6a54)',
    strokeWidth: 2,
    marker: 'filled',
    midDecoration: 'check-disc',
  },
  feedback: {
    stroke: 'var(--btv-edge-feedback, #9a5580)',
    strokeWidth: 1.5,
    dash: '5,4',
    marker: 'open',
  },
  escalation: {
    stroke: 'var(--btv-edge-escalation, #b3372f)',
    strokeWidth: 1.5,
    marker: 'double-chevron',
  },
};

/**
 * Domain vocabulary mapped onto interoperable BPMN tags: exported files open
 * in any BPMN tool; the domain identity round-trips via extensionElements.
 */
export const DOMAIN_NODE_TYPES: NodeTypeDefinition[] = [
  // Cards cast the canvas shadow (craft pack); the gate is the domain's
  // "gateway" and stays flat like core gateways.
  { type: 'btv:squad', label: 'Squad', category: 'custom', defaultSize: { width: 180, height: 100 }, xml: { tag: 'subProcess' }, visual: { shadow: true } },
  { type: 'btv:persona', label: 'Persona', category: 'custom', defaultSize: { width: 150, height: 56 }, xml: { tag: 'userTask' }, visual: { shadow: true } },
  { type: 'btv:gate', label: 'Approval Gate', category: 'custom', defaultSize: { width: 72, height: 56 }, xml: { tag: 'inclusiveGateway' } },
  { type: 'btv:prompt', label: 'Prompt', category: 'custom', defaultSize: { width: 130, height: 64 }, xml: { tag: 'scriptTask' }, visual: { shadow: true } },
  { type: 'btv:connector', label: 'Connector', category: 'custom', defaultSize: { width: 130, height: 60 }, xml: { tag: 'serviceTask' }, visual: { shadow: true } },
  { type: 'btv:deliverable', label: 'Deliverable', category: 'custom', defaultSize: { width: 120, height: 70 }, xml: { tag: 'endEvent' }, visual: { shadow: true } },
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
  edgeStyles: DOMAIN_EDGE_STYLES,
  paletteGroups: [
    {
      id: 'buildtovalue',
      label: 'BuildToValue',
      headerColor: 'var(--btv-gold, #9a7b1e)',
      itemBackground: 'var(--btv-palette-item-bg, #fdfaf1)',
      itemHoverBackground: 'var(--btv-gold-soft, #f6edd4)',
    },
  ],
  paletteItems: [
    { id: 'btv-squad', label: 'Squad', nodeType: 'btv:squad', icon: BTV_PALETTE_ICONS['btv:squad'], group: 'buildtovalue' },
    { id: 'btv-persona', label: 'Persona', nodeType: 'btv:persona', icon: BTV_PALETTE_ICONS['btv:persona'], defaultProperties: { role: '' }, group: 'buildtovalue' },
    { id: 'btv-gate', label: 'Approval Gate', nodeType: 'btv:gate', icon: BTV_PALETTE_ICONS['btv:gate'], defaultProperties: { approved: false }, group: 'buildtovalue' },
    { id: 'btv-prompt', label: 'Prompt', nodeType: 'btv:prompt', icon: BTV_PALETTE_ICONS['btv:prompt'], group: 'buildtovalue' },
    { id: 'btv-connector', label: 'Connector', nodeType: 'btv:connector', icon: BTV_PALETTE_ICONS['btv:connector'], group: 'buildtovalue' },
    { id: 'btv-deliverable', label: 'Deliverable', nodeType: 'btv:deliverable', icon: BTV_PALETTE_ICONS['btv:deliverable'], group: 'buildtovalue' },
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
