import { describe, expect, it } from 'vitest';
import {
  clamp,
  collapseWaypoints,
  cubicBezierConnection,
  DEFAULT_PORT_OFFSET,
  distance,
  getAnchorPoint,
  getBoundingBox,
  orthogonalConnection,
  rectCenter,
  rectContains,
  rectsIntersect,
  routeOrthogonal,
  snapToGrid,
  waypointsToPath,
} from '../src/index.js';

const rect = (x: number, y: number, width = 100, height = 60) => ({ x, y, width, height });

describe('geometry basics', () => {
  it('clamp, distance, center', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(rectCenter(rect(0, 0))).toEqual({ x: 50, y: 30 });
  });

  it('rectContains / rectsIntersect', () => {
    expect(rectContains(rect(0, 0), { x: 50, y: 30 })).toBe(true);
    expect(rectContains(rect(0, 0), { x: 101, y: 30 })).toBe(false);
    expect(rectsIntersect(rect(0, 0), rect(50, 30))).toBe(true);
    expect(rectsIntersect(rect(0, 0), rect(200, 200))).toBe(false);
  });

  it('snapToGrid', () => {
    expect(snapToGrid(13, 10)).toBe(10);
    expect(snapToGrid(17, 10)).toBe(20);
    expect(snapToGrid(17, 0)).toBe(17);
  });
});

describe('getAnchorPoint', () => {
  it('picks the side facing the target', () => {
    const source = rect(0, 0);
    expect(getAnchorPoint(source, { x: 300, y: 30 }).side).toBe('right');
    expect(getAnchorPoint(source, { x: -300, y: 30 }).side).toBe('left');
    expect(getAnchorPoint(source, { x: 50, y: 300 }).side).toBe('bottom');
    expect(getAnchorPoint(source, { x: 50, y: -300 }).side).toBe('top');
  });

  it('normalizes by size so flat shapes prefer horizontal sides', () => {
    const wide = rect(0, 0, 200, 20);
    // Diagonal target: dx/w = 100/200 = 0.5; dy/h = 100/20 = 5 → vertical wins
    expect(getAnchorPoint(wide, { x: 200, y: 110 }).side).toBe('bottom');
  });

  it('returns the side midpoint', () => {
    const { point } = getAnchorPoint(rect(0, 0), { x: 300, y: 30 });
    expect(point).toEqual({ x: 100, y: 30 });
  });
});

describe('connections', () => {
  it('builds a cubic bezier path between rects', () => {
    const geometry = cubicBezierConnection(rect(0, 0), rect(300, 0));
    expect(geometry.path).toMatch(/^M 100 30 C /);
    expect(geometry.start).toEqual({ x: 100, y: 30 });
    expect(geometry.end).toEqual({ x: 300, y: 30 });
    expect(geometry.midpoint.x).toBeGreaterThan(100);
    expect(geometry.midpoint.x).toBeLessThan(300);
  });

  it('routes orthogonally with collapsed collinear points', () => {
    const points = routeOrthogonal(rect(0, 0), rect(300, 200));
    // start → vertical/horizontal bends → end, no duplicated points
    expect(points.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      // Each segment is strictly horizontal or vertical
      expect(a.x === b.x || a.y === b.y).toBe(true);
      expect(a.x === b.x && a.y === b.y).toBe(false);
    }
  });

  it('collapses straight-line routes to two points', () => {
    const points = routeOrthogonal(rect(0, 0), rect(300, 0));
    // Even with the port offset, a purely collinear route collapses back to
    // its two anchors — straight edges are unchanged.
    expect(points).toEqual([
      { x: 100, y: 30 },
      { x: 300, y: 30 },
    ]);
  });

  it('leaves and enters nodes perpendicular via a port stub (pendencias §2)', () => {
    // Source anchors on its bottom (n=+y); target anchors on its top (−y).
    const points = routeOrthogonal(rect(0, 0), rect(300, 200));
    expect(points.length).toBeGreaterThanOrEqual(3);
    const [p0, p1] = points;
    const last = points[points.length - 1];
    const beforeLast = points[points.length - 2];
    // First segment departs straight down the source normal; last segment
    // arrives straight down into the target — both vertical, no lateral turn
    // riding the node face.
    expect(p0.x).toBe(p1.x);
    expect(p1.y).toBeGreaterThan(p0.y);
    expect(last.x).toBe(beforeLast.x);
    expect(last.y).toBeGreaterThan(beforeLast.y);
    // The perpendicular stub clears at least DEFAULT_PORT_OFFSET before bending.
    expect(p1.y - p0.y).toBeGreaterThanOrEqual(DEFAULT_PORT_OFFSET);
    expect(last.y - beforeLast.y).toBeGreaterThanOrEqual(DEFAULT_PORT_OFFSET);
  });

  it('no route segment cuts through the source or target node interior', () => {
    const source = rect(0, 0);
    const target = rect(300, 200);
    const points = routeOrthogonal(source, target);
    const interiorHit = (a: { x: number; y: number }, b: { x: number; y: number }, r: typeof source) => {
      // Sample the (axis-aligned) segment and check no sample lands strictly
      // inside the rect (borders — where the anchors live — are allowed).
      for (let t = 0; t <= 1; t += 0.05) {
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        if (x > r.x && x < r.x + r.width && y > r.y && y < r.y + r.height) return true;
      }
      return false;
    };
    for (let i = 1; i < points.length; i++) {
      expect(interiorHit(points[i - 1], points[i], source)).toBe(false);
      expect(interiorHit(points[i - 1], points[i], target)).toBe(false);
    }
  });

  it('clamps the port offset so it never overshoots on tight layouts', () => {
    // Anchors 4px apart: offset clamps to 2, the route stays monotonic and
    // never jumps past the far node.
    const points = routeOrthogonal(rect(0, 0), rect(0, 64), 16);
    expect(points).toEqual([
      { x: 50, y: 60 },
      { x: 50, y: 64 },
    ]);
  });

  it('accepts an explicit port offset of 0 (legacy anchor-to-anchor route)', () => {
    const points = routeOrthogonal(rect(0, 0), rect(300, 200), 0);
    expect(points).toEqual([
      { x: 50, y: 60 },
      { x: 50, y: 130 },
      { x: 350, y: 130 },
      { x: 350, y: 200 },
    ]);
  });

  it('waypointsToPath renders M/L path', () => {
    expect(
      waypointsToPath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toBe('M 0 0 L 10 0');
    expect(waypointsToPath([])).toBe('');
  });

  it('waypointsToPath with radius 0 matches the legacy polyline output', () => {
    const z = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 40 },
    ];
    expect(waypointsToPath(z, 0)).toBe(waypointsToPath(z));
    expect(waypointsToPath(z)).toBe('M 0 0 L 50 0 L 50 40 L 100 40');
  });

  it('waypointsToPath rounds interior corners with quadratic curves', () => {
    const path = waypointsToPath(
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 40 },
        { x: 100, y: 40 },
      ],
      8,
    );
    // Tangent points sit 8px before/after each bend; the bend is the control point.
    expect(path).toBe('M 0 0 L 42 0 Q 50 0 50 8 L 50 32 Q 50 40 58 40 L 100 40');
  });

  it('waypointsToPath clamps the radius to half the shorter adjacent segment', () => {
    const path = waypointsToPath(
      [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 60 },
      ],
      8,
    );
    // First segment is 6 long → radius clamps to 3.
    expect(path).toBe('M 0 0 L 3 0 Q 6 0 6 3 L 6 60');
  });

  it('waypointsToPath keeps collinear and duplicate points safe under rounding', () => {
    const path = waypointsToPath(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 25, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 40 },
      ],
      8,
    );
    expect(path).toBe('M 0 0 L 42 0 Q 50 0 50 8 L 50 40');
    // Diagonal straight-through points stay sharp (no zero-angle curve).
    expect(
      waypointsToPath(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 20, y: 20 },
        ],
        8,
      ),
    ).toBe('M 0 0 L 10 10 L 20 20');
  });

  it('waypointsToPath handles short inputs with any radius', () => {
    expect(waypointsToPath([], 8)).toBe('');
    expect(waypointsToPath([{ x: 5, y: 5 }], 8)).toBe('M 5 5 ');
    expect(
      waypointsToPath(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        8,
      ),
    ).toBe('M 0 0 L 10 0');
  });

  it('orthogonalConnection exposes midpoint for labels', () => {
    const geometry = orthogonalConnection(rect(0, 0), rect(300, 200));
    expect(geometry.path.startsWith('M ')).toBe(true);
    expect(geometry.midpoint).toBeDefined();
  });

  it('orthogonalConnection accepts a corner radius', () => {
    const sharp = orthogonalConnection(rect(0, 0), rect(300, 200));
    const rounded = orthogonalConnection(rect(0, 0), rect(300, 200), { cornerRadius: 8 });
    expect(sharp.path).not.toContain('Q');
    expect(rounded.path).toContain('Q');
    // Endpoints and midpoint are radius-independent.
    expect(rounded.start).toEqual(sharp.start);
    expect(rounded.end).toEqual(sharp.end);
    expect(rounded.midpoint).toEqual(sharp.midpoint);
  });
});

describe('collapseWaypoints', () => {
  it('removes duplicates and collinear midpoints', () => {
    const collapsed = collapseWaypoints([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(collapsed).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
  });
});

describe('getBoundingBox', () => {
  it('computes the union of rects', () => {
    expect(getBoundingBox([rect(0, 0), rect(200, 100)])).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 160,
    });
    expect(getBoundingBox([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
