import {
  isContainerType,
  routeAStar,
  type BpmnDiagram,
  type BpmnEdge,
  type EdgeGeometry,
  type Point,
  type Rect,
} from '@bpmn-react/core';
import type { EdgeRouterContext, EdgeRouterFn } from '../plugins/types.js';
import { astarConnection, resolveRouter } from './routers.js';

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

/**
 * Computes the cached A* waypoints for an edge — only when its resolved router
 * is the obstacle-avoiding `astar` (the cheap routers route per-render and are
 * not cached). Returns the waypoints plus `routed` (false = no corridor, the
 * fallback state). `undefined` for a non-astar edge or a missing endpoint.
 */
export function computeRoutedWaypoints(
  diagram: BpmnDiagram,
  edge: BpmnEdge,
  defaultRouter: EdgeRouterFn,
): { waypoints: Point[]; routed: boolean } | undefined {
  const source = diagram.nodes[edge.sourceId];
  const target = diagram.nodes[edge.targetId];
  if (!source || !target) return undefined;
  const router = resolveRouter(resolveEdgeRouterName(diagram, edge), defaultRouter);
  if (router !== astarConnection) return undefined;
  return routeAStar(asRect(source), asRect(target), {
    obstacles: edgeObstacles(diagram, edge),
    routedEdges: routedEdgeWaypoints(diagram, edge),
  });
}

/** Route mode marker (Handoff 10 §11): `'auto'` = derived/cached A* route,
 * `'manual'` = user-authored (R-3). Absent + has waypoints = external import,
 * treated as manual by R-3. */
export type RouteMode = 'auto' | 'manual';

/** One rerouted edge produced by a host-node move (Handoff 10 R-2b). */
export interface EdgeReroute {
  edgeId: string;
  /** Fresh A* waypoints, cached back onto the edge inside the move command. */
  waypoints: Point[];
  /** `false` = no corridor found (fallback state). */
  routed: boolean;
  /** Default-router path at the final positions — the fading crossfade layer. */
  previewPath: string;
}

/**
 * Reroutes the auto A* edges connected to the moved nodes, against a POST-move
 * diagram snapshot. This is the central zero-recalc guarantee (Handoff 10
 * R-2b): only edges that (a) touch a moved node, (b) resolve to `astar`, and
 * (c) are not manual/external are re-routed — every unrelated or non-astar edge
 * is left exactly as it was. Each entry carries the fresh waypoints (cached
 * inside the same atomic move command by the caller) and the default-router
 * preview path used for the settle crossfade.
 */
export function rerouteConnectedEdges(
  nextDiagram: BpmnDiagram,
  movedNodeIds: ReadonlySet<string>,
  defaultRouter: EdgeRouterFn,
): EdgeReroute[] {
  const out: EdgeReroute[] = [];
  for (const edge of Object.values(nextDiagram.edges)) {
    if (!movedNodeIds.has(edge.sourceId) && !movedNodeIds.has(edge.targetId)) continue;
    if (edge.properties.routeMode === 'manual') continue;
    // An external import (waypoints without our `auto` marker) is manual too.
    if (edge.waypoints && edge.waypoints.length >= 2 && edge.properties.routeMode !== 'auto') {
      continue;
    }
    const result = computeRoutedWaypoints(nextDiagram, edge, defaultRouter);
    if (!result) continue;
    const source = nextDiagram.nodes[edge.sourceId];
    const target = nextDiagram.nodes[edge.targetId];
    if (!source || !target) continue;
    out.push({
      edgeId: edge.id,
      waypoints: result.waypoints,
      routed: result.routed,
      previewPath: defaultRouter(asRect(source), asRect(target)).path,
    });
  }
  return out;
}

/**
 * Derives A* routes for `astar` edges that have no waypoints yet, returning a
 * new diagram with them cached (`routeMode: 'auto'`, plus `routeFallback` when
 * no corridor was found). Presentation derivation, NOT an edit — the caller
 * applies it outside the command stack (no undo entry, no ledger) at load /
 * import time. Edges that already carry waypoints are left untouched (a cached
 * auto route, or an external/manual one). Returns the same diagram reference
 * when nothing changed, so callers can cheaply skip.
 */
export function deriveAstarRoutes(diagram: BpmnDiagram, defaultRouter: EdgeRouterFn): BpmnDiagram {
  let changed = false;
  const edges = { ...diagram.edges };
  for (const edge of Object.values(diagram.edges)) {
    if (edge.waypoints && edge.waypoints.length >= 2) continue;
    const result = computeRoutedWaypoints(diagram, edge, defaultRouter);
    if (!result) continue;
    changed = true;
    edges[edge.id] = {
      ...edge,
      waypoints: result.waypoints,
      properties: {
        ...edge.properties,
        routeMode: 'auto' satisfies RouteMode,
        ...(result.routed ? {} : { routeFallback: true }),
      },
    };
  }
  return changed ? { ...diagram, edges } : diagram;
}
