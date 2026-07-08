import {
  isSubProcessExpanded,
  nodeParentId,
  type BpmnDiagram,
  type BpmnNode,
} from '@bpmn-react/core';

/**
 * Whether a node renders on the canvas (F7-2). With no drill: hidden when its
 * ancestry contains a collapsed sub-process. Drilled into `drillId`: only that
 * sub-process' contents show — the container itself and everything outside it
 * hide (collapsed containers *inside* the drill scope still hide their own
 * children; the drilled container's own collapsed state is ignored so drilling
 * works from a collapsed marker too). A stale `drillId` (node gone) behaves
 * like no drill.
 */
export function isNodeVisible(
  diagram: BpmnDiagram,
  node: BpmnNode,
  drillId: string | null,
): boolean {
  if (drillId !== null && !diagram.nodes[drillId]) drillId = null;
  if (node.id === drillId) return false;
  const seen = new Set<string>();
  let parentId = nodeParentId(node);
  while (parentId !== undefined && !seen.has(parentId)) {
    if (parentId === drillId) return true;
    seen.add(parentId);
    const container: BpmnNode | undefined = diagram.nodes[parentId];
    if (!container) return drillId === null;
    if (container.type === 'subProcess' && !isSubProcessExpanded(container)) return false;
    parentId = nodeParentId(container);
  }
  // Walked to the root without meeting the drill scope.
  return drillId === null;
}

/** Ids of every node that must not render — see {@link isNodeVisible}. */
export function hiddenNodeIds(diagram: BpmnDiagram, drillId: string | null): Set<string> {
  const hidden = new Set<string>();
  for (const node of Object.values(diagram.nodes)) {
    if (!isNodeVisible(diagram, node, drillId)) hidden.add(node.id);
  }
  return hidden;
}
