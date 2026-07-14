import { describe, expect, it } from 'vitest';
import type { Point, Rect } from '../src/model/types.js';
import { routeAStar, DEFAULT_CLEARANCE } from '../src/index.js';

const rect = (x: number, y: number, width = 80, height = 60): Rect => ({ x, y, width, height });

/** A polyline segment enters a rect's (un-inflated) interior — the "crosses a
 * shape" test of §8.1. */
function segmentInsideRect(a: Point, b: Point, r: Rect): boolean {
  const left = r.x;
  const right = r.x + r.width;
  const top = r.y;
  const bottom = r.y + r.height;
  const eps = 0.5;
  if (a.y === b.y) {
    if (a.y <= top + eps || a.y >= bottom - eps) return false;
    return Math.min(a.x, b.x) < right - eps && Math.max(a.x, b.x) > left + eps;
  }
  if (a.x === b.x) {
    if (a.x <= left + eps || a.x >= right - eps) return false;
    return Math.min(a.y, b.y) < bottom - eps && Math.max(a.y, b.y) > top + eps;
  }
  return false;
}

function crossesAny(waypoints: Point[], obstacles: Rect[]): boolean {
  for (let i = 0; i < waypoints.length - 1; i++) {
    for (const o of obstacles) {
      if (segmentInsideRect(waypoints[i], waypoints[i + 1], o)) return true;
    }
  }
  return false;
}

function isOrthogonal(waypoints: Point[]): boolean {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (Math.abs(a.x - b.x) > 0.01 && Math.abs(a.y - b.y) > 0.01) return false;
  }
  return true;
}

describe('routeAStar', () => {
  it('routes cleanly with no obstacles (orthogonal, endpoints on borders)', () => {
    const source = rect(0, 100);
    const target = rect(400, 100);
    const { waypoints, routed } = routeAStar(source, target, { obstacles: [] });
    expect(routed).toBe(true);
    expect(waypoints.length).toBeGreaterThanOrEqual(2);
    expect(isOrthogonal(waypoints)).toBe(true);
  });

  it('detours around an obstacle directly in the path (never crosses the shape)', () => {
    const source = rect(0, 100);
    const target = rect(400, 100);
    const obstacle = rect(200, 80, 80, 120); // tall box straddling the straight line
    const { waypoints, routed } = routeAStar(source, target, { obstacles: [obstacle] });
    expect(routed).toBe(true);
    expect(isOrthogonal(waypoints)).toBe(true);
    expect(crossesAny(waypoints, [obstacle])).toBe(false);
  });

  it('is deterministic: the same input routed 10× is byte-identical', () => {
    const source = rect(0, 100);
    const target = rect(400, 300);
    const obstacles = [rect(180, 120, 80, 100), rect(180, 260, 100, 80)];
    const first = JSON.stringify(routeAStar(source, target, { obstacles }).waypoints);
    for (let i = 0; i < 10; i++) {
      expect(JSON.stringify(routeAStar(source, target, { obstacles }).waypoints)).toBe(first);
    }
  });

  it('self-loop: a U off the right side (§5.1)', () => {
    const node = rect(100, 100, 80, 60);
    const { waypoints, routed } = routeAStar(node, node);
    expect(routed).toBe(true);
    expect(waypoints).toHaveLength(4);
    const right = node.x + node.width;
    // The two middle points bulge out to the right by the loop offset.
    expect(waypoints[1].x).toBeGreaterThan(right);
    expect(waypoints[2].x).toBe(waypoints[1].x);
  });

  it('fan-out: N edges to nearby targets each route and avoid the siblings', () => {
    const source = rect(0, 200);
    const targets = [rect(300, 80), rect(300, 200), rect(300, 320)];
    for (const t of targets) {
      const others = targets.filter((o) => o !== t);
      const { waypoints, routed } = routeAStar(source, t, { obstacles: others });
      expect(routed).toBe(true);
      expect(crossesAny(waypoints, others)).toBe(false);
    }
  });

  it('no corridor: falls back (routed=false) when every port is enclosed', () => {
    const target = rect(300, 200, 40, 40);
    const source = rect(0, 200, 40, 40);
    // A box that swallows the target and all its ports.
    const cage = rect(300 - 30, 200 - 30, 100, 100);
    const { routed, waypoints } = routeAStar(source, target, { obstacles: [cage] });
    expect(routed).toBe(false);
    expect(waypoints.length).toBeGreaterThanOrEqual(2); // still draws something
  });

  it('respects the crossing cost without crashing when routed edges are supplied', () => {
    const source = rect(0, 100);
    const target = rect(400, 100);
    const routedEdges: Point[][] = [
      [
        { x: 200, y: 0 },
        { x: 200, y: 400 },
      ],
    ];
    const { routed, waypoints } = routeAStar(source, target, { obstacles: [], routedEdges });
    expect(routed).toBe(true);
    expect(isOrthogonal(waypoints)).toBe(true);
  });

  it('routes a typical edge within the per-route budget on a 100-node field', () => {
    const obstacles: Rect[] = [];
    for (let i = 0; i < 100; i++) obstacles.push(rect((i % 10) * 160, Math.floor(i / 10) * 120));
    // A typical edge connects nearby nodes (the §3 budget case); min of several
    // runs suppresses shared-runner noise.
    const source = rect(0, 600);
    const target = rect(320, 600);
    let best = Infinity;
    for (let k = 0; k < 20; k++) {
      const start = performance.now();
      routeAStar(source, target, { obstacles });
      best = Math.min(best, performance.now() - start);
    }
     
    console.log(`[astar] typical route in 100-node field: ${best.toFixed(2)}ms (target < 5ms)`);
    // Regression canary, not the NFR (cf. perf.spec.ts): the real target is
    // < 5ms (see the logged value in a plain run, ~1.3ms). Coverage-v8
    // instrumentation inflates this ~7×, so the CI ceiling only trips on a
    // gross regression.
    expect(best).toBeLessThan(25);
  });

  it('bounds the worst case (corner-to-corner across the whole field)', () => {
    const obstacles: Rect[] = [];
    for (let i = 0; i < 100; i++) obstacles.push(rect((i % 10) * 160, Math.floor(i / 10) * 120));
    const start = performance.now();
    const { routed } = routeAStar(rect(-160, 0), rect(1600, 1080), { obstacles });
    const ms = performance.now() - start;
     
    console.log(`[astar] worst-case corner-to-corner: ${ms.toFixed(2)}ms (routed=${routed})`);
    // A full-field diagonal builds the whole grid; the batch "clear routing"
    // path (R-4) amortizes this by reusing one grid. Bounded (with coverage
    // instrumentation headroom) so it never hangs.
    expect(ms).toBeLessThan(400);
  });

  it('exposes the default clearance', () => {
    expect(DEFAULT_CLEARANCE).toBe(12);
  });

  it('reports the chosen source/target sides (feeds port hysteresis)', () => {
    const source = rect(0, 100);
    const target = rect(400, 100);
    const r = routeAStar(source, target, { obstacles: [] });
    expect(r.sourceSide).toBe('right');
    expect(r.targetSide).toBe('left');
  });

  it('port hysteresis: keeps the preferred side pair unless another is >20% cheaper', () => {
    // Endpoints roughly diagonal so left/right and top/bottom pairings are
    // close in cost — the regime where flip-flop happens.
    const source = rect(0, 0);
    const target = rect(120, 120);
    const baseline = routeAStar(source, target, { obstacles: [] });
    // Force a preference for a pairing that is NOT the natural min; with a big
    // hysteresis margin the router must honour it (it's not 100% cheaper).
    const held = routeAStar(source, target, {
      obstacles: [],
      preferredSourceSide: 'bottom',
      preferredTargetSide: 'top',
      hysteresis: 0.99,
    });
    expect(held.sourceSide).toBe('bottom');
    expect(held.targetSide).toBe('top');
    // With hysteresis 0 the router is free to pick its natural minimum again.
    const free = routeAStar(source, target, {
      obstacles: [],
      preferredSourceSide: 'bottom',
      preferredTargetSide: 'top',
      hysteresis: 0,
    });
    expect(free.sourceSide).toBe(baseline.sourceSide);
  });

  it('forced source port: routes from the supplied port (parallel corridors)', () => {
    const source = rect(0, 100);
    const target = rect(400, 100);
    const r = routeAStar(source, target, {
      obstacles: [],
      sourcePort: {
        side: 'right',
        anchor: { x: 80, y: 108 }, // 8px below the border centre (y=130 → 138? centre is 130)
        port: { x: 96, y: 108 },
      },
    });
    expect(r.routed).toBe(true);
    expect(r.sourceSide).toBe('right');
    expect(r.waypoints[0]).toEqual({ x: 80, y: 108 }); // exits from the forced anchor
  });
});
