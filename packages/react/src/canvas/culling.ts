import type { BpmnEdge, BpmnNode } from '@bpmn-react/core';
import type { Viewport } from '../state/canvasStore.js';

/**
 * Viewport culling (virtualization) for the SVG canvas.
 *
 * Pure SVG rendering degrades once a few hundred elements are mounted, because
 * every shape stays in the DOM regardless of whether it is on screen. Above
 * {@link CULL_THRESHOLD} total elements we render only the nodes/edges whose
 * bounding box intersects the visible world rect (the viewBox), expanded by a
 * margin so nothing pops in at the edge of a pan. Below the threshold nothing
 * changes — small diagrams keep the original "render everything" behaviour, so
 * there is no visible difference for the common case.
 *
 * The canvas already re-renders on every viewport frame (the viewport is
 * subscribed store state), so culling adds no re-renders; it only shrinks how
 * many node/edge components are mounted at once.
 */

/** Total node+edge count above which culling kicks in. */
export const CULL_THRESHOLD = 300;

/** Fraction of the viewport added as a buffer on every side. */
const MARGIN_RATIO = 0.5;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function nodeRect(node: BpmnNode): Rect {
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

/**
 * Bounding box of an edge from its waypoints, or — when it has none — from the
 * centres of its endpoint nodes, so a long edge crossing the viewport between
 * two off-screen nodes still renders. Returns `undefined` only when neither
 * endpoint is known (the edge is then kept, never wrongly culled).
 */
function edgeRect(edge: BpmnEdge, nodes: Record<string, BpmnNode>): Rect | undefined {
  const points: Array<{ x: number; y: number }> = [];
  if (edge.waypoints && edge.waypoints.length > 0) {
    points.push(...edge.waypoints);
  } else {
    const source = nodes[edge.sourceId];
    const target = nodes[edge.targetId];
    if (source) points.push({ x: source.x + source.width / 2, y: source.y + source.height / 2 });
    if (target) points.push({ x: target.x + target.width / 2, y: target.y + target.height / 2 });
  }
  if (points.length === 0) return undefined;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/** The visible world rect (viewBox) expanded by {@link MARGIN_RATIO}. */
function visibleRect(viewport: Viewport): Rect {
  const mx = viewport.width * MARGIN_RATIO;
  const my = viewport.height * MARGIN_RATIO;
  return {
    x: viewport.x - mx,
    y: viewport.y - my,
    width: viewport.width + 2 * mx,
    height: viewport.height + 2 * my,
  };
}

/**
 * Filters `nodes` and `edges` to those intersecting the expanded viewport.
 * Below {@link CULL_THRESHOLD} total elements the inputs are returned as-is
 * (identity), so callers can pass the result straight to the render loop.
 */
export function cullToViewport(
  nodes: BpmnNode[],
  edges: BpmnEdge[],
  allNodes: Record<string, BpmnNode>,
  viewport: Viewport,
): { nodes: BpmnNode[]; edges: BpmnEdge[] } {
  if (nodes.length + edges.length <= CULL_THRESHOLD) {
    return { nodes, edges };
  }
  const view = visibleRect(viewport);
  return {
    nodes: nodes.filter((node) => intersects(nodeRect(node), view)),
    edges: edges.filter((edge) => {
      const rect = edgeRect(edge, allNodes);
      return rect ? intersects(rect, view) : true;
    }),
  };
}
