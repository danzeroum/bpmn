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

/* ------------------------------------------------------------------ *
 *  Manual routes (Handoff 10 R-3)
 * ------------------------------------------------------------------ */

/**
 * An edge is **manual** when the user authored its route (R-3) — explicit
 * `routeMode: 'manual'`, OR waypoints carried in from an external import with
 * no `auto` marker (§1.4: imported waypoints are respected as manual). An
 * `'auto'` edge (cached A* route) is never manual, and an edge with no
 * waypoints is not manual. Manual routes are never rewritten by automatic
 * re-routing (§8.3).
 */
export function isManualEdge(edge: BpmnEdge): boolean {
  if (edge.properties.routeMode === 'manual') return true;
  if (edge.properties.routeMode === 'auto') return false;
  return Boolean(edge.waypoints && edge.waypoints.length >= 2);
}

/** True if segment `a→b` crosses the interior of `rect` (Liang–Barsky, with a
 * small inset so an endpoint grazing the border is not a crossing). */
export function segmentIntersectsRect(a: Point, b: Point, rect: Rect): boolean {
  const inset = 0.5;
  const xmin = rect.x + inset;
  const ymin = rect.y + inset;
  const xmax = rect.x + rect.width - inset;
  const ymax = rect.y + rect.height - inset;
  if (xmax <= xmin || ymax <= ymin) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0; // parallel: inside iff not left of the edge
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (
    clip(-dx, a.x - xmin) &&
    clip(dx, xmax - a.x) &&
    clip(-dy, a.y - ymin) &&
    clip(dy, ymax - a.y)
  ) {
    return t0 < t1;
  }
  return false;
}

/** True if any segment of `waypoints` crosses any obstacle rect. */
export function edgeRouteCollides(waypoints: Point[], obstacles: Rect[]): boolean {
  for (let i = 0; i + 1 < waypoints.length; i++) {
    for (const rect of obstacles) {
      if (segmentIntersectsRect(waypoints[i], waypoints[i + 1], rect)) return true;
    }
  }
  return false;
}

/**
 * Rigid translation of a manual route when its anchor node(s) move (edge case
 * 6). If both endpoints move (same drag delta), the whole route shifts
 * rigidly; if only one endpoint moves, only that endpoint's waypoint follows —
 * the interior bends the user authored stay put. The route is NEVER re-routed.
 */
export function translateManualWaypoints(
  waypoints: Point[],
  sourceMoved: boolean,
  targetMoved: boolean,
  dx: number,
  dy: number,
): Point[] {
  const shift = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  if (sourceMoved && targetMoved) return waypoints.map(shift);
  return waypoints.map((p, i) => {
    if (sourceMoved && i === 0) return shift(p);
    if (targetMoved && i === waypoints.length - 1) return shift(p);
    return p;
  });
}

/** One manual edge translated by a host-node move (Handoff 10 R-3). */
export interface ManualTranslation {
  edgeId: string;
  waypoints: Point[];
  /** The translated route now crosses a shape — flag ⚠, never re-route. */
  collides: boolean;
}

/**
 * Rigidly translates the manual edges connected to the moved nodes against a
 * POST-move diagram snapshot (edge case 6). Manual routes are never re-routed;
 * a translation that lands on a shape keeps its route and is flagged
 * (`collides`) so the ⚠ chip appears. Auto edges are handled separately by
 * {@link rerouteConnectedEdges}.
 */
export function translateManualEdges(
  nextDiagram: BpmnDiagram,
  movedNodeIds: ReadonlySet<string>,
  dx: number,
  dy: number,
): ManualTranslation[] {
  const out: ManualTranslation[] = [];
  for (const edge of Object.values(nextDiagram.edges)) {
    if (!edge.waypoints || edge.waypoints.length < 2) continue;
    if (!isManualEdge(edge)) continue;
    const sourceMoved = movedNodeIds.has(edge.sourceId);
    const targetMoved = movedNodeIds.has(edge.targetId);
    if (!sourceMoved && !targetMoved) continue;
    const waypoints = translateManualWaypoints(edge.waypoints, sourceMoved, targetMoved, dx, dy);
    out.push({
      edgeId: edge.id,
      waypoints,
      collides: edgeRouteCollides(waypoints, edgeObstacles(nextDiagram, edge)),
    });
  }
  return out;
}

/**
 * Patch that returns a manual edge to automatic routing (§6): recompute the A*
 * route now and cache it (`routeMode: 'auto'`), or — when the resolved router
 * is not `astar` — clear the waypoints so the edge follows the diagram's router
 * per render. Applied as ONE `updateEdgeCommand`, so undo restores the manual
 * route atomically.
 */
export function backToAutoPatch(
  diagram: BpmnDiagram,
  edge: BpmnEdge,
  defaultRouter: EdgeRouterFn,
): { waypoints: Point[] | null; properties: Record<string, unknown> } {
  const result = computeRoutedWaypoints(diagram, edge, defaultRouter);
  if (result) {
    return {
      waypoints: result.waypoints,
      properties: {
        routeMode: 'auto' satisfies RouteMode,
        routeFallback: result.routed ? undefined : true,
        routeCollision: undefined,
      },
    };
  }
  return {
    waypoints: null,
    properties: { routeMode: 'auto' satisfies RouteMode, routeCollision: undefined },
  };
}
