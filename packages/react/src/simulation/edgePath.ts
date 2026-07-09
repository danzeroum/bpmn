import {
  waypointsToPath,
  type BpmnEdge,
  type BpmnNode,
  type EdgeGeometry,
} from '@bpmn-react/core';
import type { EdgeRouterFn } from '../plugins/types.js';
import { EDGE_CORNER_RADIUS } from '../shapes/common.js';

/**
 * Recomputes the exact geometry the EdgeRenderer paints for an edge, so the
 * simulation token rides the *real* rounded route (the reason PR 0 exists).
 * Mirrors `EdgeRenderer`'s waypoints-vs-router branch: explicit waypoints win
 * (rounded with `EDGE_CORNER_RADIUS`), otherwise the editor's edge router.
 * Returns `null` when an endpoint is missing.
 */
export function edgeGeometryFor(
  edge: BpmnEdge,
  source: BpmnNode | undefined,
  target: BpmnNode | undefined,
  edgeRouter: EdgeRouterFn,
): EdgeGeometry | null {
  if (!source || !target) return null;
  if (edge.waypoints && edge.waypoints.length >= 2) {
    const points = edge.waypoints;
    return {
      path: waypointsToPath(points, EDGE_CORNER_RADIUS),
      start: points[0],
      end: points[points.length - 1],
      midpoint: points[Math.floor(points.length / 2)],
    };
  }
  return edgeRouter(source, target);
}

/** World-space center of a node (where a resting token sits). */
export function nodeCenter(node: BpmnNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}
