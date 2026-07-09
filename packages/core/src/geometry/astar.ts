import type { Point, Rect } from '../model/types.js';
import {
  collapseWaypoints,
  distance,
  getAnchorPoint,
  rectCenter,
  DEFAULT_PORT_OFFSET,
  type Side,
} from './index.js';

/**
 * Headless obstacle-avoiding edge router (Handoff 10, R-1). Resolves the
 * deferred part of pendencias.md §2: a **visibility (Hanan) grid** over the node
 * bounds inflated by a clearance, plus **A\*** with the composite cost
 * `length + 2·bends + 4·crossings` (favouring straight, low-crossing routes —
 * legibility over distance).
 *
 * Pure and **deterministic**: no randomness, stable tie-breaks, so the same
 * inputs always yield byte-identical waypoints. Never mutates its inputs; the
 * caller supplies obstacles and already-routed edges (this function never
 * reroutes globally). When no obstacle-free corridor exists it returns a direct
 * route with `routed: false` so the UI can render the "sem corredor" fallback
 * rather than trapping the edge.
 */

/** Clearance (px) each obstacle is inflated by before routing. */
export const DEFAULT_CLEARANCE = 12;
/** Cost added per 90° bend (A\* tie-break toward fewer corners). */
const BEND_WEIGHT = 2;
/** Cost added per crossing with an already-routed edge. */
const CROSS_WEIGHT = 4;
/** Self-loop lobe depth (§5.1). */
const SELF_LOOP_OFFSET = 24;

export interface AStarRouteOptions {
  /** Node bounds to route around (should EXCLUDE the two endpoints). */
  obstacles?: Rect[];
  /** Waypoints of already-routed edges, for the crossing cost. */
  routedEdges?: Point[][];
  clearance?: number;
  portOffset?: number;
  /**
   * Port hysteresis (§6, R-4): the side pair used by the previous route. When
   * given with `hysteresis > 0`, the router keeps this pairing unless a
   * different one is more than `hysteresis` (fraction) cheaper — killing the
   * flip-flop a small move would otherwise cause.
   */
  preferredSourceSide?: Side;
  preferredTargetSide?: Side;
  /** Fractional cost improvement required to abandon the preferred pairing. */
  hysteresis?: number;
  /**
   * Forces the source port (parallel corridors, R-4): bypasses source-side
   * selection so a fan-out can be spread into 8px lanes. The target side is
   * still chosen by A\*.
   */
  sourcePort?: { anchor: Point; port: Point; side: Side };
}

export interface AStarRoute {
  waypoints: Point[];
  /** false when no obstacle-free corridor was found (fallback state). */
  routed: boolean;
  /** Side pair the router settled on — feeds port hysteresis on the next move. */
  sourceSide?: Side;
  targetSide?: Side;
}

const SIDES: Side[] = ['right', 'left', 'bottom', 'top'];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function inflate(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, width: rect.width + 2 * by, height: rect.height + 2 * by };
}

/** Strictly inside the rect (open interior), with a small tolerance so points
 * sitting exactly on the clearance boundary stay usable. */
function insideInterior(p: Point, rect: Rect): boolean {
  const eps = 0.5;
  return (
    p.x > rect.x + eps &&
    p.x < rect.x + rect.width - eps &&
    p.y > rect.y + eps &&
    p.y < rect.y + rect.height - eps
  );
}

/** An axis-aligned segment enters a rect's open interior. */
function segmentHitsRect(a: Point, b: Point, rect: Rect): boolean {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const eps = 0.5;
  if (a.y === b.y) {
    // horizontal
    if (a.y <= top + eps || a.y >= bottom - eps) return false;
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return lo < right - eps && hi > left + eps;
  }
  // vertical
  if (a.x <= left + eps || a.x >= right - eps) return false;
  const lo = Math.min(a.y, b.y);
  const hi = Math.max(a.y, b.y);
  return lo < bottom - eps && hi > top + eps;
}

/** Do two segments properly cross? (general orientation test, for crossing cost) */
function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) =>
    Math.sign((q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y));
  const o1 = o(a, b, c);
  const o2 = o(a, b, d);
  const o3 = o(c, d, a);
  const o4 = o(c, d, b);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}

function port(rect: Rect, side: Side, offset: number): { anchor: Point; port: Point } {
  const c = rectCenter(rect);
  switch (side) {
    case 'left':
      return { anchor: { x: rect.x, y: c.y }, port: { x: rect.x - offset, y: c.y } };
    case 'right':
      return { anchor: { x: rect.x + rect.width, y: c.y }, port: { x: rect.x + rect.width + offset, y: c.y } };
    case 'top':
      return { anchor: { x: c.x, y: rect.y }, port: { x: c.x, y: rect.y - offset } };
    case 'bottom':
      return { anchor: { x: c.x, y: rect.y + rect.height }, port: { x: c.x, y: rect.y + rect.height + offset } };
  }
}

/** A U-shaped self-loop off the right side (§5.1) — deterministic. */
function selfLoop(rect: Rect): AStarRoute {
  const right = rect.x + rect.width;
  const cy = rect.y + rect.height / 2;
  const top = round2(cy - rect.height * 0.2);
  const bottom = round2(cy + rect.height * 0.2);
  const out = round2(right + SELF_LOOP_OFFSET);
  return {
    routed: true,
    waypoints: [
      { x: right, y: top },
      { x: out, y: top },
      { x: out, y: bottom },
      { x: right, y: bottom },
    ],
  };
}

function directRoute(source: Rect, target: Rect): Point[] {
  const start = getAnchorPoint(source, rectCenter(target)).point;
  const end = getAnchorPoint(target, rectCenter(source)).point;
  return [start, end];
}

/**
 * Routes an orthogonal, obstacle-avoiding path from `source` to `target`.
 * Tries every free port-side pairing and keeps the minimum-cost route, so the
 * anchor side is the one A\* actually prefers (§6). Deterministic.
 */
export function routeAStar(source: Rect, target: Rect, options: AStarRouteOptions = {}): AStarRoute {
  const clearance = options.clearance ?? DEFAULT_CLEARANCE;
  const portOffset = options.portOffset ?? DEFAULT_PORT_OFFSET;
  const routedEdges = options.routedEdges ?? [];

  // Self-loop.
  if (
    source.x === target.x &&
    source.y === target.y &&
    source.width === target.width &&
    source.height === target.height
  ) {
    return selfLoop(source);
  }

  const inflated = (options.obstacles ?? []).map((o) => inflate(o, clearance));

  // Candidate ports for all four sides of each endpoint. A forced source port
  // (parallel corridors) bypasses source-side selection.
  const sourcePorts = options.sourcePort
    ? [{ side: options.sourcePort.side, anchor: options.sourcePort.anchor, port: options.sourcePort.port }]
    : SIDES.map((side) => ({ side, ...port(source, side, portOffset) }));
  const targetPorts = SIDES.map((side) => ({ side, ...port(target, side, portOffset) }));
  const usableSource = sourcePorts.filter((p) => !inflated.some((r) => insideInterior(p.port, r)));
  const usableTarget = targetPorts.filter((p) => !inflated.some((r) => insideInterior(p.port, r)));
  if (usableSource.length === 0 || usableTarget.length === 0) {
    return { waypoints: directRoute(source, target), routed: false };
  }

  // Hanan grid coordinate lines: obstacle clearance edges + every candidate
  // port line, bounded to the region around the two endpoints (keeps the grid
  // — and A\* — small enough for the per-route budget).
  const span = getSpan(source, target, portOffset + clearance + 40);
  const xs = new Set<number>();
  const ys = new Set<number>();
  const add = (set: Set<number>, v: number, lo: number, hi: number) => {
    if (v >= lo && v <= hi) set.add(round2(v));
  };
  add(xs, span.minX, span.minX, span.maxX);
  add(xs, span.maxX, span.minX, span.maxX);
  add(ys, span.minY, span.minY, span.maxY);
  add(ys, span.maxY, span.minY, span.maxY);
  for (const p of [...usableSource, ...usableTarget]) {
    add(xs, p.port.x, span.minX, span.maxX);
    add(ys, p.port.y, span.minY, span.maxY);
    add(xs, p.anchor.x, span.minX, span.maxX);
    add(ys, p.anchor.y, span.minY, span.maxY);
  }
  for (const r of inflated) {
    if (r.x + r.width < span.minX || r.x > span.maxX || r.y + r.height < span.minY || r.y > span.maxY) {
      continue;
    }
    add(xs, r.x, span.minX, span.maxX);
    add(xs, r.x + r.width, span.minX, span.maxX);
    add(ys, r.y, span.minY, span.maxY);
    add(ys, r.y + r.height, span.minY, span.maxY);
  }
  const xLines = [...xs].sort((a, b) => a - b);
  const yLines = [...ys].sort((a, b) => a - b);

  const grid = buildGrid(xLines, yLines, inflated, routedEdges);

  // Try every free port pairing; collect them so port hysteresis (§6) can pick
  // the previous side pair unless another is materially cheaper.
  const sideRank = (side: Side) => SIDES.indexOf(side);
  const candidates: { cost: number; waypoints: Point[]; sSide: Side; tSide: Side }[] = [];
  for (const s of usableSource) {
    for (const t of usableTarget) {
      const result = grid.search(s.port, t.port);
      if (!result) continue;
      const waypoints = collapseWaypoints([
        s.anchor,
        s.port,
        ...result.waypoints,
        t.port,
        t.anchor,
      ]).map((p) => ({ x: round2(p.x), y: round2(p.y) }));
      candidates.push({ cost: result.cost, waypoints, sSide: s.side, tSide: t.side });
    }
  }

  if (candidates.length === 0) return { waypoints: directRoute(source, target), routed: false };
  // Deterministic order: cheapest first, ties broken by side order.
  candidates.sort(
    (a, b) =>
      a.cost - b.cost || sideRank(a.sSide) - sideRank(b.sSide) || sideRank(a.tSide) - sideRank(b.tSide),
  );
  let chosen = candidates[0];
  const hysteresis = options.hysteresis ?? 0;
  if (hysteresis > 0 && options.preferredSourceSide && options.preferredTargetSide) {
    const pref = candidates.find(
      (c) => c.sSide === options.preferredSourceSide && c.tSide === options.preferredTargetSide,
    );
    // Keep the previous pairing unless a different one is > `hysteresis` cheaper.
    if (pref && (pref.sSide !== chosen.sSide || pref.tSide !== chosen.tSide)) {
      if (!(chosen.cost < (1 - hysteresis) * pref.cost)) chosen = pref;
    }
  }
  return { waypoints: chosen.waypoints, routed: true, sourceSide: chosen.sSide, targetSide: chosen.tSide };
}

function getSpan(source: Rect, target: Rect, margin: number) {
  const minX = Math.min(source.x, target.x) - margin;
  const minY = Math.min(source.y, target.y) - margin;
  const maxX = Math.max(source.x + source.width, target.x + target.width) + margin;
  const maxY = Math.max(source.y + source.height, target.y + target.height) + margin;
  return { minX, minY, maxX, maxY };
}

interface Grid {
  search(from: Point, to: Point): { waypoints: Point[]; cost: number } | undefined;
}

interface Neighbour {
  to: number; // point key
  dir: number; // 0=+x,1=-x,2=+y,3=-y
  base: number; // length + crossing cost (turn added at search time)
}

/**
 * Builds the visibility grid ONCE and returns an A\* search bound to it. Grid
 * points are the xLines × yLines intersections not inside an obstacle;
 * adjacency (with the length + crossing cost baked in) is precomputed so the
 * A\* inner loop never rescans obstacles — the per-route budget lives in the
 * search, not the geometry.
 */
function buildGrid(
  xLines: number[],
  yLines: number[],
  obstacles: Rect[],
  routedEdges: Point[][],
): Grid {
  const W = xLines.length;
  const key = (xi: number, yi: number) => yi * W + xi;
  const pointOf = (k: number): Point => ({ x: xLines[k % W], y: yLines[Math.floor(k / W)] });

  const blockedAt = (xi: number, yi: number): boolean => {
    const p = { x: xLines[xi], y: yLines[yi] };
    return obstacles.some((r) => insideInterior(p, r));
  };
  const segmentFree = (a: Point, b: Point): boolean => !obstacles.some((r) => segmentHitsRect(a, b, r));
  const crossCount = (a: Point, b: Point): number => {
    let n = 0;
    for (const wp of routedEdges) {
      for (let i = 0; i < wp.length - 1; i++) {
        if (segmentsCross(a, b, wp[i], wp[i + 1])) n++;
      }
    }
    return n;
  };

  // Precompute blocked points and per-point adjacency (built once).
  const blocked = new Uint8Array(W * yLines.length);
  for (let yi = 0; yi < yLines.length; yi++) {
    for (let xi = 0; xi < W; xi++) {
      if (blockedAt(xi, yi)) blocked[key(xi, yi)] = 1;
    }
  }
  const adjacency = new Map<number, Neighbour[]>();
  const edgeCost = (a: Point, b: Point) => distance(a, b) + CROSS_WEIGHT * crossCount(a, b);
  for (let yi = 0; yi < yLines.length; yi++) {
    for (let xi = 0; xi < W; xi++) {
      if (blocked[key(xi, yi)]) continue;
      const a = { x: xLines[xi], y: yLines[yi] };
      const list: Neighbour[] = [];
      const link = (nxi: number, nyi: number, dir: number) => {
        if (nxi < 0 || nxi >= W || nyi < 0 || nyi >= yLines.length) return;
        if (blocked[key(nxi, nyi)]) return;
        const b = { x: xLines[nxi], y: yLines[nyi] };
        if (!segmentFree(a, b)) return;
        list.push({ to: key(nxi, nyi), dir, base: edgeCost(a, b) });
      };
      link(xi + 1, yi, 0);
      link(xi - 1, yi, 1);
      link(xi, yi + 1, 2);
      link(xi, yi - 1, 3);
      adjacency.set(key(xi, yi), list);
    }
  }

  const indexOf = (value: number, lines: number[]): number => {
    let lo = 0;
    let hi = lines.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (Math.abs(lines[mid] - value) < 0.01) return mid;
      if (lines[mid] < value) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  };

  return {
    search(from: Point, to: Point) {
      const sx = indexOf(round2(from.x), xLines);
      const sy = indexOf(round2(from.y), yLines);
      const tx = indexOf(round2(to.x), xLines);
      const ty = indexOf(round2(to.y), yLines);
      if (sx < 0 || sy < 0 || tx < 0 || ty < 0) return undefined;
      const startKey = key(sx, sy);
      const goalKey = key(tx, ty);
      if (blocked[startKey] || blocked[goalKey]) return undefined;

      // A\* over (point, arrivalDirection) states. Directions: 0=+x,1=-x,2=+y,3=-y,4=start.
      const startState = `${startKey}:4`;
      const gScore = new Map<string, number>();
      const cameFrom = new Map<string, { state: string; key: number }>();
      gScore.set(startState, 0);
      const h = (k: number) => {
        const p = pointOf(k);
        return Math.abs(p.x - to.x) + Math.abs(p.y - to.y);
      };
      const heap = new MinHeap();
      heap.push({ f: h(startKey), g: 0, key: startKey, dir: 4, state: startState });

      while (!heap.isEmpty()) {
        const cur = heap.pop()!;
        if (cur.key === goalKey) {
          return reconstruct(cameFrom, cur.state, cur.key, pointOf, cur.g);
        }
        const g = gScore.get(cur.state);
        if (g === undefined || cur.g > g) continue;
        for (const nb of adjacency.get(cur.key) ?? []) {
          const turn = cur.dir !== 4 && nb.dir !== cur.dir ? BEND_WEIGHT : 0;
          const ng = cur.g + nb.base + turn;
          const nstate = `${nb.to}:${nb.dir}`;
          if (ng < (gScore.get(nstate) ?? Infinity)) {
            gScore.set(nstate, ng);
            cameFrom.set(nstate, { state: cur.state, key: cur.key });
            heap.push({ f: ng + h(nb.to), g: ng, key: nb.to, dir: nb.dir, state: nstate });
          }
        }
      }
      return undefined;
    },
  };
}

function reconstruct(
  cameFrom: Map<string, { state: string; key: number }>,
  endState: string,
  endKey: number,
  pointOf: (k: number) => Point,
  cost: number,
): { waypoints: Point[]; cost: number } {
  const points: Point[] = [pointOf(endKey)];
  let state = endState;
  while (cameFrom.has(state)) {
    const prev = cameFrom.get(state)!;
    points.push(pointOf(prev.key));
    state = prev.state;
  }
  points.reverse();
  return { waypoints: collapseWaypoints(points), cost };
}

interface HeapNode {
  f: number;
  g: number;
  key: number;
  dir: number;
  state: string;
}

/** Binary min-heap ordered by (f, g, state) — the state key tie-break keeps
 * pops deterministic regardless of insertion order. */
class MinHeap {
  private readonly items: HeapNode[] = [];

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  private less(a: HeapNode, b: HeapNode): boolean {
    if (a.f !== b.f) return a.f < b.f;
    if (a.g !== b.g) return a.g < b.g;
    return a.state < b.state;
  }

  push(node: HeapNode): void {
    const items = this.items;
    items.push(node);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.less(items[i], items[parent])) {
        [items[i], items[parent]] = [items[parent], items[i]];
        i = parent;
      } else break;
    }
  }

  pop(): HeapNode | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < items.length && this.less(items[l], items[smallest])) smallest = l;
        if (r < items.length && this.less(items[r], items[smallest])) smallest = r;
        if (smallest === i) break;
        [items[i], items[smallest]] = [items[smallest], items[i]];
        i = smallest;
      }
    }
    return top;
  }
}
