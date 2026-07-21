import {
  lanesOfPool,
  poolBodyOf,
  poolContainingRect,
  resizeNodeCommand,
  tileLaneRects,
  type BpmnDiagram,
  type BpmnNode,
  type Command,
  type LaneRect,
} from '@buildtovalue/core';

/**
 * Lane snap+tiling (#154) — DESIGN-TIME only: these planners run inside the
 * create/resize gestures and emit ordinary commands folded into the SAME
 * composite as the triggering edit (one undo). Import never calls them —
 * imported DI geometry stays sovereign; the lint rule (LANE_BODY_TILING)
 * only *points at* violations there.
 */

/** Minimum lane height a tiling step will produce (the lane band width). */
const MIN_LANE_HEIGHT = 24;

const rectOf = (node: BpmnNode): LaneRect => ({
  x: node.x,
  y: node.y,
  width: node.width,
  height: node.height,
});

const sameRect = (a: LaneRect, b: LaneRect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** Resize commands mapping each lane (vertical order) onto its tiled rect. */
function retileCommands(lanes: BpmnNode[], rects: LaneRect[], skipId?: string): Command[] {
  const commands: Command[] = [];
  for (let i = 0; i < lanes.length; i++) {
    if (lanes[i].id === skipId) continue;
    const from = rectOf(lanes[i]);
    if (!sameRect(from, rects[i])) commands.push(resizeNodeCommand(lanes[i].id, from, rects[i]));
  }
  return commands;
}

/**
 * Plan for inserting a lane at `dropRect`: when the drop lands in a pool, the
 * new lane snaps to the pool body and the body is re-tiled EQUALLY over the
 * existing lanes plus the new one (inserted at its vertical drop position).
 * Outside a pool the insert is untouched → returns null.
 */
export function laneInsertPlan(
  diagram: BpmnDiagram,
  dropRect: LaneRect,
): { laneRect: LaneRect; commands: Command[] } | null {
  const pool = poolContainingRect(diagram, dropRect);
  if (!pool) return null;
  const body = poolBodyOf(pool);
  const siblings = lanesOfPool(diagram, pool);
  const dropCenter = dropRect.y + dropRect.height / 2;
  let index = siblings.findIndex((lane) => dropCenter < lane.y + lane.height / 2);
  if (index === -1) index = siblings.length;
  const rects = tileLaneRects(body, Array.from({ length: siblings.length + 1 }, () => 1));
  const ordered = [...siblings.slice(0, index), null, ...siblings.slice(index)];
  const commands: Command[] = [];
  let laneRect = rects[index];
  for (let i = 0; i < ordered.length; i++) {
    const lane = ordered[i];
    if (lane === null) {
      laneRect = rects[i];
      continue;
    }
    const from = rectOf(lane);
    if (!sameRect(from, rects[i])) commands.push(resizeNodeCommand(lane.id, from, rects[i]));
  }
  return { laneRect, commands };
}

/**
 * Adjustment for a finished lane-resize gesture: the lane snaps to the pool
 * body (x/width) and keeps its requested height (clamped); the sibling lanes
 * absorb the remainder proportionally so the body stays exactly partitioned.
 * Returns the snapped rect for the resized lane plus the sibling commands —
 * null when the lane sits outside any pool (behavior unchanged).
 */
export function laneResizeAdjust(
  diagram: BpmnDiagram,
  laneId: string,
  requested: LaneRect,
): { snapped: LaneRect; commands: Command[] } | null {
  const pool = poolContainingRect(diagram, requested);
  if (!pool) return null;
  const body = poolBodyOf(pool);
  const lanes = lanesOfPool(diagram, pool).filter((lane) => lane.id !== laneId);
  if (lanes.length === 0) {
    return { snapped: body, commands: [] };
  }
  const maxHeight = body.height - MIN_LANE_HEIGHT * lanes.length;
  const height = Math.min(Math.max(requested.height, MIN_LANE_HEIGHT), maxHeight);
  // Rebuild the vertical order with the resized lane at its requested center.
  const center = requested.y + height / 2;
  let index = lanes.findIndex((lane) => center < lane.y + lane.height / 2);
  if (index === -1) index = lanes.length;
  const ordered: Array<BpmnNode | null> = [...lanes.slice(0, index), null, ...lanes.slice(index)];
  // The resized lane keeps `height`; siblings share the rest proportionally.
  const rest = body.height - height;
  const siblingTotal = lanes.reduce((sum, lane) => sum + lane.height, 0) || 1;
  const weights = ordered.map((lane) =>
    lane === null ? height : Math.max((lane.height / siblingTotal) * rest, MIN_LANE_HEIGHT),
  );
  const rects = tileLaneRects(body, weights);
  const snapped = rects[index];
  const lanesInOrder = ordered.filter((lane): lane is BpmnNode => lane !== null);
  const rectsForLanes = rects.filter((_, i) => ordered[i] !== null);
  return { snapped, commands: retileCommands(lanesInOrder, rectsForLanes) };
}

/**
 * Reflow for a finished pool-resize gesture: every member lane keeps its
 * PROPORTION of the old body and is re-tiled onto the new one — same gesture,
 * same composite, one undo. No lanes (or an already-clean pool that stays
 * clean) → no commands.
 */
export function poolResizeReflow(
  diagram: BpmnDiagram,
  from: LaneRect,
  to: LaneRect,
): Command[] {
  const oldBody = poolBodyOf(from);
  const lanes = lanesOfPool(diagram, oldBody);
  if (lanes.length === 0) return [];
  // A pool whose lanes DON'T currently tile it (e.g. imported with a gap) is
  // reflowed too — the user grabbed the pool handle, so this gesture owns the
  // layout — but proportions always come from the lanes' own heights.
  const newBody = poolBodyOf(to);
  const rects = tileLaneRects(newBody, lanes.map((lane) => lane.height));
  return retileCommands(lanes, rects);
}
