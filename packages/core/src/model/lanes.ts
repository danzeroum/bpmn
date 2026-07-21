import type { BpmnDiagram, BpmnNode } from './types.js';
import { activeNodes } from './types.js';

/**
 * Lane/pool body geometry (#154) — the ONE source both the editor's
 * snap+tiling gesture (react) and the `LANE_BODY_TILING` lint rule consume,
 * so interaction and diagnosis never drift. Import stays sovereign: nothing
 * here runs on import — these are pure helpers callers invoke from gestures
 * and rules only.
 */

/**
 * Width of the rotated title band on the left edge of a pool. The lane body
 * (the area lanes are expected to partition) starts after it.
 */
export const POOL_TITLE_BAND = 30;

export interface LaneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The pool body: everything right of the title band, full pool height. */
export function poolBodyOf(pool: LaneRect): LaneRect {
  return {
    x: pool.x + POOL_TITLE_BAND,
    y: pool.y,
    width: pool.width - POOL_TITLE_BAND,
    height: pool.height,
  };
}

/** Center-point containment, shared by pool/lane lookups. */
function containsCenter(container: LaneRect, rect: LaneRect): boolean {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return (
    cx >= container.x &&
    cx <= container.x + container.width &&
    cy >= container.y &&
    cy <= container.y + container.height
  );
}

/** Smallest active pool whose bounds contain the rect's center, if any. */
export function poolContainingRect(diagram: BpmnDiagram, rect: LaneRect): BpmnNode | undefined {
  let best: BpmnNode | undefined;
  for (const node of activeNodes(diagram)) {
    if (node.type !== 'pool') continue;
    if (!containsCenter(node, rect)) continue;
    if (!best || node.width * node.height < best.width * best.height) best = node;
  }
  return best;
}

/** Active lanes whose center falls inside the pool, in vertical order. */
export function lanesOfPool(diagram: BpmnDiagram, pool: LaneRect): BpmnNode[] {
  return activeNodes(diagram)
    .filter((node) => node.type === 'lane' && containsCenter(pool, node))
    .sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
}

/**
 * Tile `lanes` (already in vertical order) over the pool body: every lane
 * spans the body's full width and the heights — proportional to the given
 * `heights` weights — partition the body with no gap, no overlap and no
 * remainder. Boundaries are rounded per-cut so the sum stays EXACT.
 */
export function tileLaneRects(body: LaneRect, heights: number[]): LaneRect[] {
  const total = heights.reduce((sum, h) => sum + Math.max(h, 1), 0);
  const rects: LaneRect[] = [];
  let cursor = body.y;
  let accumulated = 0;
  for (let i = 0; i < heights.length; i++) {
    accumulated += Math.max(heights[i], 1);
    const nextEdge =
      i === heights.length - 1
        ? body.y + body.height
        : body.y + Math.round((body.height * accumulated) / total);
    rects.push({ x: body.x, y: cursor, width: body.width, height: nextEdge - cursor });
    cursor = nextEdge;
  }
  return rects;
}

/** Float-tolerant equality for DI coordinates. */
const EPSILON = 0.5;

/**
 * True when the lanes exactly partition the pool body (the invariant the
 * `LANE_BODY_TILING` lint checks and the editor gesture maintains). Lanes
 * must be in vertical order — as returned by {@link lanesOfPool}.
 */
export function lanesTileBody(body: LaneRect, lanes: LaneRect[]): boolean {
  if (lanes.length === 0) return true;
  let cursor = body.y;
  for (const lane of lanes) {
    if (Math.abs(lane.x - body.x) > EPSILON) return false;
    if (Math.abs(lane.width - body.width) > EPSILON) return false;
    if (Math.abs(lane.y - cursor) > EPSILON) return false;
    cursor = lane.y + lane.height;
  }
  return Math.abs(cursor - (body.y + body.height)) <= EPSILON;
}
