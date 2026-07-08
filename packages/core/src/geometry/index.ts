import type { Point, Rect } from '../model/types.js';

export type Side = 'left' | 'right' | 'top' | 'bottom';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/**
 * Picks the side of `rect` facing `towards` by comparing the normalized
 * deltas (dx/width vs dy/height), so wide/flat shapes prefer horizontal
 * anchors and tall shapes prefer vertical ones.
 */
export function getAnchorSide(rect: Rect, towards: Point): Side {
  const center = rectCenter(rect);
  const dx = towards.x - center.x;
  const dy = towards.y - center.y;
  const nx = rect.width === 0 ? dx : dx / rect.width;
  const ny = rect.height === 0 ? dy : dy / rect.height;
  if (Math.abs(nx) >= Math.abs(ny)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

/** Midpoint of the rect side that faces `towards`. */
export function getAnchorPoint(rect: Rect, towards: Point): { point: Point; side: Side } {
  const side = getAnchorSide(rect, towards);
  const center = rectCenter(rect);
  switch (side) {
    case 'left':
      return { point: { x: rect.x, y: center.y }, side };
    case 'right':
      return { point: { x: rect.x + rect.width, y: center.y }, side };
    case 'top':
      return { point: { x: center.x, y: rect.y }, side };
    case 'bottom':
      return { point: { x: center.x, y: rect.y + rect.height }, side };
  }
}

function sideNormal(side: Side): Point {
  switch (side) {
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
  }
}

export interface EdgeGeometry {
  /** SVG path `d` attribute. */
  path: string;
  start: Point;
  end: Point;
  /** Point suitable for placing a label. */
  midpoint: Point;
}

/**
 * Cubic Bézier connection between two rectangles. Control points extend
 * outward along each anchor side's normal with adaptive curvature.
 */
export function cubicBezierConnection(source: Rect, target: Rect): EdgeGeometry {
  const sourceAnchor = getAnchorPoint(source, rectCenter(target));
  const targetAnchor = getAnchorPoint(target, rectCenter(source));
  const start = sourceAnchor.point;
  const end = targetAnchor.point;
  const curvature = Math.max(Math.abs(end.x - start.x) / 2, Math.abs(end.y - start.y) / 2, 60);
  const n1 = sideNormal(sourceAnchor.side);
  const n2 = sideNormal(targetAnchor.side);
  const c1 = { x: start.x + n1.x * curvature, y: start.y + n1.y * curvature };
  const c2 = { x: end.x + n2.x * curvature, y: end.y + n2.y * curvature };
  const midpoint = cubicBezierPoint(start, c1, c2, end, 0.5);
  return {
    path: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
    start,
    end,
    midpoint,
  };
}

export function cubicBezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Removes consecutive duplicate and collinear waypoints. */
export function collapseWaypoints(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const prev = result[result.length - 1];
    if (prev && prev.x === point.x && prev.y === point.y) continue;
    result.push(point);
  }
  let index = 1;
  while (index < result.length - 1) {
    const [a, b, c] = [result[index - 1], result[index], result[index + 1]];
    const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
    if (collinear) result.splice(index, 1);
    else index++;
  }
  return result;
}

/**
 * Orthogonal (Manhattan) route between two rectangles: an L / Z path routed
 * through a midpoint, with redundant waypoints collapsed.
 */
export function routeOrthogonal(source: Rect, target: Rect): Point[] {
  const sourceAnchor = getAnchorPoint(source, rectCenter(target));
  const targetAnchor = getAnchorPoint(target, rectCenter(source));
  const start = sourceAnchor.point;
  const end = targetAnchor.point;
  const horizontalFirst = sourceAnchor.side === 'left' || sourceAnchor.side === 'right';
  let bends: Point[];
  if (horizontalFirst) {
    const midX = (start.x + end.x) / 2;
    bends = [
      { x: midX, y: start.y },
      { x: midX, y: end.y },
    ];
  } else {
    const midY = (start.y + end.y) / 2;
    bends = [
      { x: start.x, y: midY },
      { x: end.x, y: midY },
    ];
  }
  return collapseWaypoints([start, ...bends, end]);
}

/** Rounds to 2 decimals so corner tangent points don't emit float noise. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Converts waypoints to an SVG path. With `cornerRadius > 0` each interior
 * bend is rounded with a quadratic curve; the radius is clamped to half of
 * the shorter adjacent segment so short segments never overlap. Radius 0
 * (the default) emits the plain polyline unchanged.
 */
export function waypointsToPath(points: Point[], cornerRadius = 0): string {
  if (points.length === 0) return '';
  const rounded = cornerRadius > 0 ? collapseWaypoints(points) : points;
  if (cornerRadius <= 0 || rounded.length < 3) {
    const [first, ...rest] = rounded;
    return `M ${first.x} ${first.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ');
  }
  const segments = [`M ${rounded[0].x} ${rounded[0].y}`];
  for (let index = 1; index < rounded.length - 1; index++) {
    const [a, b, c] = [rounded[index - 1], rounded[index], rounded[index + 1]];
    const abLength = distance(a, b);
    const bcLength = distance(b, c);
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    const radius = Math.min(cornerRadius, abLength / 2, bcLength / 2);
    // Straight-through (collinear diagonals) or degenerate corners stay sharp.
    if (radius < 0.5 || Math.abs(cross) < 1e-9) {
      segments.push(`L ${b.x} ${b.y}`);
      continue;
    }
    const entry = {
      x: round2(b.x - ((b.x - a.x) / abLength) * radius),
      y: round2(b.y - ((b.y - a.y) / abLength) * radius),
    };
    const exit = {
      x: round2(b.x + ((c.x - b.x) / bcLength) * radius),
      y: round2(b.y + ((c.y - b.y) / bcLength) * radius),
    };
    segments.push(`L ${entry.x} ${entry.y}`, `Q ${b.x} ${b.y} ${exit.x} ${exit.y}`);
  }
  const last = rounded[rounded.length - 1];
  segments.push(`L ${last.x} ${last.y}`);
  return segments.join(' ');
}

export function orthogonalConnection(
  source: Rect,
  target: Rect,
  options: { cornerRadius?: number } = {},
): EdgeGeometry {
  const waypoints = routeOrthogonal(source, target);
  const start = waypoints[0];
  const end = waypoints[waypoints.length - 1];
  const mid = waypoints[Math.floor(waypoints.length / 2)];
  return { path: waypointsToPath(waypoints, options.cornerRadius ?? 0), start, end, midpoint: mid };
}

export function getBoundingBox(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function rectContains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

/** Snaps a value to the nearest multiple of `gridSize` (no-op for gridSize ≤ 0). */
export function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}
