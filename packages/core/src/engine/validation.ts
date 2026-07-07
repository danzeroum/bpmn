import { activeEdges, activeNodes, type BpmnDiagram } from '../model/types.js';
import type { NodeTypeRegistry } from '../model/registry.js';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export type ValidationRule = (diagram: BpmnDiagram) => ValidationIssue[];

/** Edges must reference nodes that exist in the diagram. */
export const orphanEdgeRule: ValidationRule = (diagram) => {
  const issues: ValidationIssue[] = [];
  for (const edge of Object.values(diagram.edges)) {
    if (!diagram.nodes[edge.sourceId] || !diagram.nodes[edge.targetId]) {
      issues.push({
        code: 'ORPHAN_EDGE',
        severity: 'error',
        message: `Edge ${edge.id} references a missing node`,
        edgeId: edge.id,
      });
    }
  }
  return issues;
};

/** Self-connections are invalid. */
export const selfConnectionRule: ValidationRule = (diagram) => {
  return Object.values(diagram.edges)
    .filter((e) => e.sourceId === e.targetId)
    .map((e) => ({
      code: 'SELF_CONNECTION',
      severity: 'error' as const,
      message: `Edge ${e.id} connects a node to itself`,
      edgeId: e.id,
    }));
};

/** A process should have at least one start event. */
export const missingStartEventRule: ValidationRule = (diagram) => {
  const nodes = activeNodes(diagram);
  if (nodes.length === 0) return [];
  if (nodes.some((n) => n.type === 'startEvent')) return [];
  return [
    {
      code: 'MISSING_START_EVENT',
      severity: 'warning',
      message: 'Process has no start event',
    },
  ];
};

const NON_FLOW_TYPES = new Set(['textAnnotation', 'dataObject']);

/** Flow nodes (other than start events) should be reachable. */
export const unreachableNodeRule: ValidationRule = (diagram) => {
  const issues: ValidationIssue[] = [];
  const edges = activeEdges(diagram);
  for (const node of activeNodes(diagram)) {
    if (node.type === 'startEvent' || NON_FLOW_TYPES.has(node.type)) continue;
    const hasIncoming = edges.some((e) => e.targetId === node.id);
    if (!hasIncoming) {
      issues.push({
        code: 'UNREACHABLE_NODE',
        severity: 'warning',
        message: `Node "${node.label}" has no incoming connections`,
        nodeId: node.id,
      });
    }
  }
  return issues;
};

/** End events must not have outgoing flows; start events no incoming. */
export const eventFlowDirectionRule: ValidationRule = (diagram) => {
  const issues: ValidationIssue[] = [];
  const edges = activeEdges(diagram);
  for (const node of activeNodes(diagram)) {
    if (node.type === 'endEvent' && edges.some((e) => e.sourceId === node.id)) {
      issues.push({
        code: 'END_EVENT_OUTGOING',
        severity: 'error',
        message: `End event "${node.label}" has outgoing connections`,
        nodeId: node.id,
      });
    }
    if (node.type === 'startEvent' && edges.some((e) => e.targetId === node.id)) {
      issues.push({
        code: 'START_EVENT_INCOMING',
        severity: 'error',
        message: `Start event "${node.label}" has incoming connections`,
        nodeId: node.id,
      });
    }
  }
  return issues;
};

/** Every node type must exist in the given registry. */
export function unknownTypeRule(registry: NodeTypeRegistry): ValidationRule {
  return (diagram) =>
    Object.values(diagram.nodes)
      .filter((n) => !registry.has(n.type))
      .map((n) => ({
        code: 'UNKNOWN_NODE_TYPE',
        severity: 'error' as const,
        message: `Node ${n.id} has unregistered type "${n.type}"`,
        nodeId: n.id,
      }));
}

export const BUILT_IN_VALIDATION_RULES: ValidationRule[] = [
  orphanEdgeRule,
  selfConnectionRule,
  missingStartEventRule,
  unreachableNodeRule,
  eventFlowDirectionRule,
];

/**
 * Runs structural and (plugin-provided) domain validation rules.
 * `valid` is false only when *errors* are present; warnings don't block.
 */
export class ValidationEngine {
  private readonly rules: ValidationRule[];

  constructor(rules: ValidationRule[] = BUILT_IN_VALIDATION_RULES) {
    this.rules = [...rules];
  }

  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  validate(diagram: BpmnDiagram): ValidationResult {
    const issues = this.rules.flatMap((rule) => rule(diagram));
    return { valid: !issues.some((i) => i.severity === 'error'), issues };
  }
}
