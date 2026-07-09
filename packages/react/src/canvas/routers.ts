import {
  cubicBezierConnection,
  orthogonalConnection,
  routeAStar,
  straightConnection,
  waypointsToPath,
  type EdgeGeometry,
} from '@bpmn-react/core';
import { EDGE_CORNER_RADIUS } from '../shapes/common.js';
import type { EdgeRouterFn } from '../plugins/types.js';

/** Built-in orthogonal router with the craft-pack rounded corners applied. */
export const roundedOrthogonalConnection: EdgeRouterFn = (source, target) =>
  orthogonalConnection(source, target, { cornerRadius: EDGE_CORNER_RADIUS });

/** Built-in straight (direct-line) router — no bends, so no corner radius. */
export const straightRouter: EdgeRouterFn = (source, target) =>
  straightConnection(source, target);

/**
 * Obstacle-avoiding router (Handoff 10). Delegates to the headless core
 * {@link routeAStar}; reads obstacles / already-routed edges from the optional
 * context (empty when a caller routes without it, e.g. the live per-render path
 * before R-2b wires the context in). Rounded to the craft-pack radius.
 */
export const astarConnection: EdgeRouterFn = (source, target, context) => {
  const { waypoints } = routeAStar(source, target, {
    obstacles: context?.obstacles ?? [],
    routedEdges: context?.routedEdges ?? [],
  });
  return {
    path: waypointsToPath(waypoints, EDGE_CORNER_RADIUS),
    start: waypoints[0],
    end: waypoints[waypoints.length - 1],
    midpoint: waypoints[Math.floor(waypoints.length / 2)],
  } satisfies EdgeGeometry;
};

export type RouterName = 'bezier' | 'orthogonal' | 'straight' | 'astar';

/** The four built-in named routers (Handoff 10 §1.1 / §3). */
export const NAMED_ROUTERS: Record<RouterName, EdgeRouterFn> = {
  bezier: cubicBezierConnection,
  orthogonal: roundedOrthogonalConnection,
  straight: straightRouter,
  astar: astarConnection,
};

/**
 * Resolves an `edgeRouter` value (built-in name or custom function) to a router
 * function, falling back to `fallback` for `undefined` or an unknown name.
 */
export function resolveRouter(
  value: string | EdgeRouterFn | undefined,
  fallback: EdgeRouterFn,
): EdgeRouterFn {
  if (typeof value === 'function') return value;
  if (value && value in NAMED_ROUTERS) return NAMED_ROUTERS[value as RouterName];
  return fallback;
}
