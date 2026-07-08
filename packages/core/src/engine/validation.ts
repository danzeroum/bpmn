import {
  activeEdges,
  activeNodes,
  boundaryAttachedTo,
  isContainerType,
  laneFlowNodeRefs,
  nodeParentId,
  type BpmnDiagram,
  type BpmnNode,
} from '../model/types.js';
import type { NodeTypeRegistry } from '../model/registry.js';

/** `info` never affects validity — it flags readability/model-hygiene noise. */
export type IssueSeverity = 'error' | 'warning' | 'info';

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

/**
 * A process should have at least one TOP-LEVEL start event — a start event
 * nested inside a sub-process belongs to that scope and must not satisfy the
 * outer process.
 */
export const missingStartEventRule: ValidationRule = (diagram) => {
  const nodes = activeNodes(diagram);
  if (nodes.length === 0) return [];
  if (nodes.some((n) => n.type === 'startEvent' && nodeParentId(n) === undefined)) return [];
  return [
    {
      code: 'MISSING_START_EVENT',
      severity: 'warning',
      message: 'Process has no start event',
    },
  ];
};

const NON_FLOW_TYPES = new Set(['textAnnotation', 'dataObject', 'dataStore', 'group']);

/** Flow nodes (other than start events) should be reachable. Containers
 * (pools/lanes) are visual grouping, not flow — never flagged. Boundary events
 * receive control from their host attachment, not an incoming sequence flow. */
export const unreachableNodeRule: ValidationRule = (diagram) => {
  const issues: ValidationIssue[] = [];
  const edges = activeEdges(diagram);
  for (const node of activeNodes(diagram)) {
    if (
      node.type === 'startEvent' ||
      node.type === 'boundaryEvent' ||
      NON_FLOW_TYPES.has(node.type) ||
      isContainerType(node.type)
    )
      continue;
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

/** Lane memberships must point at nodes that still exist in the flow. */
export const staleLaneRefRule: ValidationRule = (diagram) => {
  const issues: ValidationIssue[] = [];
  for (const lane of activeNodes(diagram).filter((n) => n.type === 'lane')) {
    for (const ref of laneFlowNodeRefs(lane)) {
      const target = diagram.nodes[ref];
      if (!target || target.removedInVersion) {
        issues.push({
          code: 'STALE_LANE_REF',
          severity: 'warning',
          message: `Lane "${lane.label}" references a node that is not in the flow (${ref})`,
          nodeId: lane.id,
        });
      }
    }
  }
  return issues;
};

/** Boundary events must attach to a host activity that exists in the flow. */
export const boundaryEventHostRule: ValidationRule = (diagram) => {
  const issues: ValidationIssue[] = [];
  for (const node of activeNodes(diagram).filter((n) => n.type === 'boundaryEvent')) {
    const host = boundaryAttachedTo(node);
    const target = host ? diagram.nodes[host] : undefined;
    if (!host || !target || target.removedInVersion) {
      issues.push({
        code: 'BOUNDARY_EVENT_WITHOUT_HOST',
        severity: 'error',
        message: `Boundary event "${node.label}" is not attached to a host activity`,
        nodeId: node.id,
      });
    }
  }
  return issues;
};

/**
 * Sub-process containment must be sound: a `parentId` has to point at an
 * existing, non-removed sub-process, and parent chains must not cycle.
 */
export const subProcessParentRule: ValidationRule = (diagram) => {
  const issues: ValidationIssue[] = [];
  for (const node of activeNodes(diagram)) {
    const parentId = nodeParentId(node);
    if (parentId === undefined) continue;
    const parent = diagram.nodes[parentId];
    if (!parent || parent.removedInVersion || parent.type !== 'subProcess') {
      issues.push({
        code: 'INVALID_PARENT_REF',
        severity: 'error',
        message: `Node "${node.label}" declares parent ${parentId}, which is not a sub-process in the flow`,
        nodeId: node.id,
      });
      continue;
    }
    // Walk up the chain; revisiting a node means a containment cycle.
    const seen = new Set<string>([node.id]);
    let current: string | undefined = parentId;
    while (current !== undefined) {
      if (seen.has(current)) {
        issues.push({
          code: 'PARENT_CYCLE',
          severity: 'error',
          message: `Node "${node.label}" is part of a sub-process containment cycle`,
          nodeId: node.id,
        });
        break;
      }
      seen.add(current);
      const ancestor: BpmnNode | undefined = diagram.nodes[current];
      current = ancestor ? nodeParentId(ancestor) : undefined;
    }
  }
  return issues;
};

/**
 * Sequence flows must stay inside one scope: BPMN forbids a flow crossing a
 * sub-process boundary. A boundary event's scope is its host's scope (it sits
 * ON the border and its outgoing flows run in the host's container).
 */
export const crossScopeEdgeRule: ValidationRule = (diagram) => {
  const scopeOf = (node: BpmnNode): string | undefined => {
    const host = boundaryAttachedTo(node);
    const anchor = host ? (diagram.nodes[host] ?? node) : node;
    return nodeParentId(anchor);
  };
  const issues: ValidationIssue[] = [];
  for (const edge of activeEdges(diagram)) {
    // Message flows cross pools by definition; (data) associations may reach
    // data/annotation elements in any scope.
    if (
      edge.type === 'messageFlow' ||
      edge.type === 'association' ||
      edge.type === 'dataAssociation'
    ) {
      continue;
    }
    const source = diagram.nodes[edge.sourceId];
    const target = diagram.nodes[edge.targetId];
    if (!source || !target) continue; // orphanEdgeRule owns this
    if (scopeOf(source) !== scopeOf(target)) {
      issues.push({
        code: 'CROSS_SCOPE_EDGE',
        severity: 'error',
        message: `Edge ${edge.id} crosses a sub-process boundary (sequence flows must stay inside one scope)`,
        edgeId: edge.id,
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
  staleLaneRefRule,
  boundaryEventHostRule,
  subProcessParentRule,
  crossScopeEdgeRule,
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
