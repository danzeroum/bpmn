import { activeEdges, activeNodes } from '@buildtovalue/core';
import type { BpmnDiagram, BpmnEdge, BpmnNode } from '@buildtovalue/core';

/**
 * Per-diagram cache over `activeNodes`/`activeEdges` for the editor's hot
 * paths (per-frame hit-testing, render-list selection, lasso). Diagrams that
 * reach the editor come from the `CommandStack`, whose commands use
 * structural sharing — every mutation yields a *new* diagram object — so the
 * object identity is a sound cache key here.
 *
 * This deliberately lives in the react layer: core cannot cache safely
 * because import/fixture code builds diagrams by assigning into
 * `diagram.nodes`/`edges` in place.
 */
const nodesCache = new WeakMap<BpmnDiagram, BpmnNode[]>();
const edgesCache = new WeakMap<BpmnDiagram, BpmnEdge[]>();

export function activeNodesCached(diagram: BpmnDiagram): BpmnNode[] {
  let list = nodesCache.get(diagram);
  if (!list) {
    list = activeNodes(diagram);
    nodesCache.set(diagram, list);
  }
  return list;
}

export function activeEdgesCached(diagram: BpmnDiagram): BpmnEdge[] {
  let list = edgesCache.get(diagram);
  if (!list) {
    list = activeEdges(diagram);
    edgesCache.set(diagram, list);
  }
  return list;
}
