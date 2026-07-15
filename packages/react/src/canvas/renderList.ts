import {
  nodeParentId,
  type BpmnDiagram,
  type BpmnEdge,
  type BpmnNode,
} from '@buildtovalue/core';
import { activeEdgesCached, activeNodesCached } from './activeCache.js';
import type { Viewport } from '../state/canvasStore.js';
import { cullToViewport } from './culling.js';

/**
 * Semantic zoom (craft pack A5): below this zoom the canvas is stamped
 * `data-zoom-band="reduced"` and CSS fades out secondary ink — edge labels and
 * domain type tags. Shared by the editor canvas and the lightweight
 * ViewerCanvas so both stamp the same band at the same threshold.
 */
export const SEMANTIC_ZOOM_MIN = 0.6;

/**
 * Shared "what to paint" computation (Handoff 11 N-7). Extracted from
 * `BpmnCanvas` so the editor canvas and the lightweight `ViewerCanvas` derive
 * the exact same visible + z-ordered + culled node/edge lists from a diagram —
 * the substrate of the render-equivalence guarantee. Pure and editor-free (no
 * interactions/commands), so the viewer can import it without pulling the
 * editor graph.
 */
export function selectRenderList(
  diagram: BpmnDiagram,
  hiddenIds: Set<string>,
  viewport: Viewport,
  showClosed: boolean,
): { nodes: BpmnNode[]; edges: BpmnEdge[] } {
  const visibleNodes = orderByZ(
    (showClosed ? Object.values(diagram.nodes) : activeNodesCached(diagram)).filter(
      (node) => !hiddenIds.has(node.id),
    ),
    diagram,
  );
  const visibleEdges = (showClosed ? Object.values(diagram.edges) : activeEdgesCached(diagram)).filter(
    (edge) => !hiddenIds.has(edge.sourceId) && !hiddenIds.has(edge.targetId),
  );
  return cullToViewport(visibleNodes, visibleEdges, diagram.nodes, viewport);
}

/**
 * Draws containers behind their contents so the flow always paints — and
 * stays clickable — on top: pools, then lanes, then flow nodes by containment
 * depth (an expanded sub-process paints before its children). Order within
 * each group is preserved (JS sort is stable).
 */
export function orderByZ(nodes: BpmnNode[], diagram: BpmnDiagram): BpmnNode[] {
  const rank = (node: BpmnNode): number => {
    if (node.type === 'pool') return 0;
    if (node.type === 'lane') return 1;
    let depth = 2;
    const seen = new Set<string>();
    let parentId = nodeParentId(node);
    while (parentId !== undefined && !seen.has(parentId)) {
      seen.add(parentId);
      depth += 1;
      const parent: BpmnNode | undefined = diagram.nodes[parentId];
      parentId = parent ? nodeParentId(parent) : undefined;
    }
    return depth;
  };
  const ranks = new Map(nodes.map((node) => [node.id, rank(node)]));
  return [...nodes].sort((a, b) => (ranks.get(a.id) ?? 2) - (ranks.get(b.id) ?? 2));
}
