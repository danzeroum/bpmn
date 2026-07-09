import {
  isContainerType,
  type BpmnDiagram,
  type BpmnEdge,
  type EdgeGeometry,
  type Point,
  type Rect,
} from '@bpmn-react/core';
import type { EdgeRouterContext, EdgeRouterFn } from '../plugins/types.js';
import { resolveRouter } from './routers.js';

/**
 * Router preference is **presentation metadata** (Handoff 10 §1.3), stored in
 * the `bpmnr:` extension channel so external tools ignore it and it round-trips:
 * a per-edge override in `edge.properties.router`, a diagram default in
 * `diagram.metadata.router`. Inheritance (§1.1): edge override → diagram default
 * → the editor's configured router. Returns the resolved name, or `undefined`
 * to defer to the editor default.
 */
export function resolveEdgeRouterName(diagram: BpmnDiagram, edge: BpmnEdge): string | undefined {
  const edgePref = typeof edge.properties.router === 'string' ? edge.properties.router : undefined;
  const diagramPref =
    typeof diagram.metadata.router === 'string' ? diagram.metadata.router : undefined;
  return edgePref ?? diagramPref;
}

const asRect = (node: { x: number; y: number; width: number; height: number }): Rect => ({
  x: node.x,
  y: node.y,
  width: node.width,
  height: node.height,
});

/** Obstacle rects for routing `edge`: every flow node except the two endpoints
 * (pools/lanes are containers, not obstacles). */
export function edgeObstacles(diagram: BpmnDiagram, edge: BpmnEdge): Rect[] {
  const out: Rect[] = [];
  for (const node of Object.values(diagram.nodes)) {
    if (node.id === edge.sourceId || node.id === edge.targetId) continue;
    if (isContainerType(node.type)) continue;
    out.push(asRect(node));
  }
  return out;
}

/** Waypoints of the other already-routed edges, for the crossing cost. */
export function routedEdgeWaypoints(diagram: BpmnDiagram, edge: BpmnEdge): Point[][] {
  const out: Point[][] = [];
  for (const other of Object.values(diagram.edges)) {
    if (other.id === edge.id) continue;
    if (other.waypoints && other.waypoints.length >= 2) out.push(other.waypoints);
  }
  return out;
}

/**
 * Routes one edge with the resolved router (inheritance) and the obstacle
 * context built from the diagram. This is the single routing entrypoint the
 * R-2b interaction lifecycle drives (on load / on drag-release); the cheap
 * per-render path stays on the editor's default router. Returns `undefined`
 * when an endpoint is missing.
 */
export function routeEdge(
  diagram: BpmnDiagram,
  edge: BpmnEdge,
  defaultRouter: EdgeRouterFn,
): EdgeGeometry | undefined {
  const source = diagram.nodes[edge.sourceId];
  const target = diagram.nodes[edge.targetId];
  if (!source || !target) return undefined;
  const router = resolveRouter(resolveEdgeRouterName(diagram, edge), defaultRouter);
  const context: EdgeRouterContext = {
    obstacles: edgeObstacles(diagram, edge),
    routedEdges: routedEdgeWaypoints(diagram, edge),
  };
  return router(asRect(source), asRect(target), context);
}
