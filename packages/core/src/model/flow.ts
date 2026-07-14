import { boundaryAttachedTo, isContainerType, nodeParentId } from './types.js';
import type { BpmnDiagram, BpmnEdge, BpmnNode } from './types.js';

/**
 * Sequence-flow classification shared by every structural analysis
 * (soundness, simulation, replay). Hosted in core so the analyses agree by
 * construction — previously each package carried its own copy pinned
 * together by a test.
 */

/** Node types that never take part in the sequence flow. */
export const NON_FLOW_TYPES: ReadonlySet<string> = new Set([
  'dataObject',
  'dataStore',
  'textAnnotation',
  'group',
]);

/** Edge types that are not sequence flow (inter-pool / artifact / data links). */
export const NON_FLOW_EDGE_TYPES: ReadonlySet<string> = new Set([
  'messageFlow',
  'association',
  'dataAssociation',
]);

export function isFlowNode(node: BpmnNode): boolean {
  return !isContainerType(node.type) && !NON_FLOW_TYPES.has(node.type);
}

export function isFlowEdge(edge: BpmnEdge): boolean {
  return !NON_FLOW_EDGE_TYPES.has(edge.type);
}

/** Scope a node's flow runs in: a boundary event works in its host's scope. */
export function flowScopeOf(diagram: BpmnDiagram, node: BpmnNode): string | undefined {
  const host = boundaryAttachedTo(node);
  const anchor = host ? (diagram.nodes[host] ?? node) : node;
  return nodeParentId(anchor);
}
