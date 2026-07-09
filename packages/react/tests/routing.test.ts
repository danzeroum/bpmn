import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  createDiagram,
  createEdge,
  createNode,
  createDefaultRegistry,
  type EdgeGeometry,
  type Rect,
} from '@bpmn-react/core';
import {
  resolveEditorConfig,
  astarConnection,
  straightRouter,
  resolveEdgeRouterName,
  edgeObstacles,
  routeEdge,
  computeRoutedWaypoints,
  deriveAstarRoutes,
  rerouteConnectedEdges,
  isManualEdge,
  segmentIntersectsRect,
  edgeRouteCollides,
  translateManualWaypoints,
  translateManualEdges,
  backToAutoPatch,
  astarAutoEdgeIds,
  routeAndSpread,
  clearRoutingCommands,
  longestSegmentMidpoint,
  sideOfAnchor,
} from '../src/index.js';
import type { EdgeRouterFn } from '../src/plugins/types.js';

const rect = (x: number, y: number, w = 80, h = 60): Rect => ({ x, y, width: w, height: h });

describe('EdgeRouterFn contract (Handoff 10 R-2a)', () => {
  it('a legacy two-argument router still works — called even with a context arg', () => {
    const geom: EdgeGeometry = {
      path: 'M 0 0 L 100 0',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      midpoint: { x: 50, y: 0 },
    };
    // Deliberately a 2-parameter function (the pre-Handoff-10 shape).
    const legacyRouter: EdgeRouterFn = (_source, _target) => geom;
    const config = resolveEditorConfig([{ id: 'legacy', edgeRouter: legacyRouter }]);
    expect(config.edgeRouter).toBe(legacyRouter);
    // The framework now passes a 3rd context argument; the old fn ignores it.
    const result = config.edgeRouter(rect(0, 0), rect(300, 0), {
      obstacles: [rect(120, -20)],
      routedEdges: [],
    });
    expect(result).toBe(geom);
  });

  it('resolves the built-in names astar and straight', () => {
    expect(resolveEditorConfig([{ id: 'a', edgeRouter: 'astar' }]).edgeRouter).toBe(astarConnection);
    expect(resolveEditorConfig([{ id: 's', edgeRouter: 'straight' }]).edgeRouter).toBe(straightRouter);
  });
});

describe('router inheritance (§1.1) — presentation metadata in bpmnr:', () => {
  function make() {
    const registry = createDefaultRegistry();
    const diagram = createDiagram({ name: 'R', id: 'r' });
    diagram.nodes.a = createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 0 }, registry);
    diagram.nodes.b = createNode({ type: 'task', id: 'b', label: 'B', x: 400, y: 0 }, registry);
    diagram.nodes.mid = createNode({ type: 'task', id: 'mid', label: 'M', x: 200, y: -20 }, registry);
    diagram.edges.e = createEdge({ id: 'e', sourceId: 'a', targetId: 'b' });
    return diagram;
  }

  it('edge override wins over diagram default; diagram default otherwise', () => {
    const diagram = make();
    expect(resolveEdgeRouterName(diagram, diagram.edges.e)).toBeUndefined();
    diagram.metadata.router = 'astar';
    expect(resolveEdgeRouterName(diagram, diagram.edges.e)).toBe('astar');
    diagram.edges.e.properties.router = 'straight';
    expect(resolveEdgeRouterName(diagram, diagram.edges.e)).toBe('straight');
  });

  it('edgeObstacles is every flow node except the two endpoints', () => {
    const diagram = make();
    const obstacles = edgeObstacles(diagram, diagram.edges.e);
    expect(obstacles).toHaveLength(1); // only 'mid'
    expect(obstacles[0]).toMatchObject({ x: 200, y: -20 });
  });

  it('routeEdge uses the resolved router with obstacle context', () => {
    const diagram = make();
    diagram.metadata.router = 'astar';
    const geometry = routeEdge(diagram, diagram.edges.e, straightRouter);
    expect(geometry).toBeDefined();
    // A* with the 'mid' obstacle between the endpoints bends around it, so the
    // path is not the single straight segment a direct router would emit.
    expect(geometry!.path).toContain('L');
    expect(geometry!.path.match(/L/g)?.length ?? 0).toBeGreaterThan(1);
  });
});

describe('cached-waypoint routing (Handoff 10 R-2b)', () => {
  function make() {
    const registry = createDefaultRegistry();
    const diagram = createDiagram({ name: 'R', id: 'r' });
    diagram.nodes.a = createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 0 }, registry);
    diagram.nodes.b = createNode({ type: 'task', id: 'b', label: 'B', x: 400, y: 0 }, registry);
    diagram.nodes.mid = createNode({ type: 'task', id: 'mid', label: 'M', x: 200, y: -20 }, registry);
    diagram.edges.e = createEdge({ id: 'e', sourceId: 'a', targetId: 'b' });
    return diagram;
  }

  it('computeRoutedWaypoints only routes when the resolved router is astar', () => {
    const d = make();
    // Default editor router is not astar → nothing to cache.
    expect(computeRoutedWaypoints(d, d.edges.e, straightRouter)).toBeUndefined();
    d.metadata.router = 'astar';
    const result = computeRoutedWaypoints(d, d.edges.e, straightRouter);
    expect(result).toBeDefined();
    expect(result!.waypoints.length).toBeGreaterThanOrEqual(2);
    expect(typeof result!.routed).toBe('boolean');
  });

  it('deriveAstarRoutes caches waypoints + routeMode for astar edges without them', () => {
    const d = make();
    d.metadata.router = 'astar';
    const out = deriveAstarRoutes(d, straightRouter);
    expect(out).not.toBe(d);
    expect(out.edges.e.waypoints?.length).toBeGreaterThanOrEqual(2);
    expect(out.edges.e.properties.routeMode).toBe('auto');
  });

  it('deriveAstarRoutes is a no-op (same ref) when no astar edge needs routing', () => {
    const d = make(); // non-astar default, no metadata override
    expect(deriveAstarRoutes(d, straightRouter)).toBe(d);
  });

  it('deriveAstarRoutes leaves an already-routed edge untouched', () => {
    const d = make();
    d.metadata.router = 'astar';
    d.edges.e.waypoints = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(deriveAstarRoutes(d, straightRouter)).toBe(d);
  });

  it('rerouteConnectedEdges reroutes only the astar edges touching a moved node', () => {
    const d = make();
    d.metadata.router = 'astar';
    const next = { ...d, nodes: { ...d.nodes, b: { ...d.nodes.b, x: 500 } } };
    const routes = rerouteConnectedEdges(next, new Set(['b']), straightRouter);
    expect(routes).toHaveLength(1);
    expect(routes[0].edgeId).toBe('e');
    expect(routes[0].waypoints.length).toBeGreaterThanOrEqual(2);
    expect(typeof routes[0].previewPath).toBe('string');
  });

  it('rerouteConnectedEdges skips edges not touching any moved node', () => {
    const d = make();
    d.metadata.router = 'astar';
    // 'mid' is an obstacle, not an endpoint of edge e.
    expect(rerouteConnectedEdges(d, new Set(['mid']), straightRouter)).toHaveLength(0);
  });

  it('rerouteConnectedEdges never touches manual or external edges (zero-recalc)', () => {
    const d = make();
    d.metadata.router = 'astar';
    d.edges.e.properties.routeMode = 'manual';
    expect(rerouteConnectedEdges(d, new Set(['b']), straightRouter)).toHaveLength(0);
    // External import: has waypoints but no auto marker → treated as manual.
    delete d.edges.e.properties.routeMode;
    d.edges.e.waypoints = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(rerouteConnectedEdges(d, new Set(['b']), straightRouter)).toHaveLength(0);
  });

  it('rerouteConnectedEdges skips non-astar edges even when connected', () => {
    const d = make(); // no astar override → edge resolves to the default router
    expect(rerouteConnectedEdges(d, new Set(['b']), straightRouter)).toHaveLength(0);
  });
});

describe('manual routes (Handoff 10 R-3)', () => {
  function make() {
    const registry = createDefaultRegistry();
    const diagram = createDiagram({ name: 'M', id: 'm' });
    diagram.nodes.a = createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 0 }, registry);
    diagram.nodes.b = createNode({ type: 'task', id: 'b', label: 'B', x: 400, y: 0 }, registry);
    diagram.nodes.mid = createNode({ type: 'task', id: 'mid', label: 'M', x: 200, y: 200 }, registry);
    diagram.edges.e = createEdge({ id: 'e', sourceId: 'a', targetId: 'b' });
    return diagram;
  }

  it('isManualEdge: explicit manual, external waypoints, auto and unrouted', () => {
    const d = make();
    expect(isManualEdge(d.edges.e)).toBe(false); // no waypoints
    d.edges.e.waypoints = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(isManualEdge(d.edges.e)).toBe(true); // external import = manual
    d.edges.e.properties.routeMode = 'auto';
    expect(isManualEdge(d.edges.e)).toBe(false);
    d.edges.e.properties.routeMode = 'manual';
    expect(isManualEdge(d.edges.e)).toBe(true);
  });

  it('segmentIntersectsRect / edgeRouteCollides detect crossings, not grazes', () => {
    const rect = { x: 100, y: 100, width: 100, height: 100 };
    expect(segmentIntersectsRect({ x: 0, y: 150 }, { x: 300, y: 150 }, rect)).toBe(true);
    expect(segmentIntersectsRect({ x: 0, y: 400 }, { x: 300, y: 400 }, rect)).toBe(false);
    // A segment running exactly along the top edge only grazes (inset guard).
    expect(segmentIntersectsRect({ x: 0, y: 100 }, { x: 300, y: 100 }, rect)).toBe(false);
    expect(
      edgeRouteCollides(
        [
          { x: 0, y: 150 },
          { x: 300, y: 150 },
        ],
        [rect],
      ),
    ).toBe(true);
  });

  it('translateManualWaypoints: rigid when both anchors move, endpoint-only otherwise', () => {
    const wp = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ];
    expect(translateManualWaypoints(wp, true, true, 10, 20)).toEqual([
      { x: 10, y: 20 },
      { x: 60, y: 70 },
      { x: 110, y: 20 },
    ]);
    // Only the source moved → only waypoint[0] follows; interior bend stays.
    expect(translateManualWaypoints(wp, true, false, 10, 20)).toEqual([
      { x: 10, y: 20 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ]);
    // Only the target moved → only the last waypoint follows.
    expect(translateManualWaypoints(wp, false, true, 10, 20)).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 110, y: 20 },
    ]);
  });

  it('translateManualEdges translates only connected manual edges + flags collision', () => {
    const d = make();
    // A manual route that will be pushed onto `mid` when its source moves down.
    d.edges.e.properties.routeMode = 'manual';
    d.edges.e.waypoints = [
      { x: 40, y: 30 },
      { x: 240, y: 30 },
      { x: 440, y: 30 },
    ];
    // Move source `a` down so waypoint[0] lands inside `mid` (200..280, 200..260).
    const next = { ...d, nodes: { ...d.nodes, a: { ...d.nodes.a, y: 200 } } };
    const out = translateManualEdges(next, new Set(['a']), 0, 200);
    expect(out).toHaveLength(1);
    expect(out[0].edgeId).toBe('e');
    // waypoint[0] followed the source; the interior/last stayed put.
    expect(out[0].waypoints[0]).toEqual({ x: 40, y: 230 });
    expect(out[0].waypoints[2]).toEqual({ x: 440, y: 30 });
    // An unrelated moved node touches nothing.
    expect(translateManualEdges(next, new Set(['mid']), 0, 200)).toHaveLength(0);
  });

  it('translateManualEdges never touches an auto edge', () => {
    const d = make();
    d.edges.e.properties.routeMode = 'auto';
    d.edges.e.waypoints = [
      { x: 40, y: 30 },
      { x: 440, y: 30 },
    ];
    expect(translateManualEdges(d, new Set(['a']), 0, 100)).toHaveLength(0);
  });

  it('backToAutoPatch recomputes an astar route, else clears to the diagram router', () => {
    const d = make();
    d.edges.e.properties.routeMode = 'manual';
    d.edges.e.waypoints = [
      { x: 40, y: 30 },
      { x: 200, y: 300 },
      { x: 440, y: 30 },
    ];
    // Non-astar default → back to auto clears the waypoints.
    const cleared = backToAutoPatch(d, d.edges.e, straightRouter);
    expect(cleared.waypoints).toBeNull();
    expect(cleared.properties.routeMode).toBe('auto');
    // Astar default → back to auto caches a fresh A* route.
    d.metadata.router = 'astar';
    const routed = backToAutoPatch(d, d.edges.e, straightRouter);
    expect(routed.waypoints).not.toBeNull();
    expect(routed.waypoints!.length).toBeGreaterThanOrEqual(2);
    expect(routed.properties.routeMode).toBe('auto');
  });
});

describe('clear routing + parallel corridors (Handoff 10 R-4)', () => {
  function fanout() {
    const registry = createDefaultRegistry();
    const diagram = createDiagram({ name: 'Fan', id: 'fan' });
    diagram.metadata.router = 'astar';
    diagram.nodes.g = createNode({ type: 'exclusiveGateway', id: 'g', label: 'G', x: 0, y: 100 }, registry);
    diagram.nodes.t1 = createNode({ type: 'task', id: 't1', label: 'T1', x: 320, y: 100 }, registry);
    diagram.nodes.t2 = createNode({ type: 'task', id: 't2', label: 'T2', x: 320, y: 140 }, registry);
    diagram.nodes.t3 = createNode({ type: 'task', id: 't3', label: 'T3', x: 320, y: 180 }, registry);
    diagram.edges.e1 = createEdge({ id: 'e1', sourceId: 'g', targetId: 't1' });
    diagram.edges.e2 = createEdge({ id: 'e2', sourceId: 'g', targetId: 't2' });
    diagram.edges.e3 = createEdge({ id: 'e3', sourceId: 'g', targetId: 't3' });
    return diagram;
  }

  it('routeAndSpread lays fan-out siblings into distinct 8px lanes ordered by target', () => {
    const d = fanout();
    const routes = routeAndSpread(d, ['e1', 'e2', 'e3']);
    const yOf = (id: string) => routes.find((r) => r.edgeId === id)!.waypoints[0].y;
    // The exit points are distinct, monotonic with target Y, and 8px apart.
    expect(yOf('e1')).toBeLessThan(yOf('e2'));
    expect(yOf('e2')).toBeLessThan(yOf('e3'));
    expect(yOf('e2') - yOf('e1')).toBeCloseTo(8, 5);
    expect(yOf('e3') - yOf('e2')).toBeCloseTo(8, 5);
  });

  it('routeAndSpread is deterministic (byte-identical across runs)', () => {
    const d = fanout();
    const a = JSON.stringify(routeAndSpread(d, ['e1', 'e2', 'e3']));
    for (let i = 0; i < 5; i++) {
      expect(JSON.stringify(routeAndSpread(d, ['e1', 'e2', 'e3']))).toBe(a);
    }
  });

  it('astarAutoEdgeIds excludes manual routes unless includeManual', () => {
    const d = fanout();
    d.edges.e2.properties.routeMode = 'manual';
    d.edges.e2.waypoints = [
      { x: 60, y: 130 },
      { x: 320, y: 170 },
    ];
    expect(astarAutoEdgeIds(d, straightRouter, { includeManual: false }).sort()).toEqual(['e1', 'e3']);
    expect(astarAutoEdgeIds(d, straightRouter, { includeManual: true }).sort()).toEqual([
      'e1',
      'e2',
      'e3',
    ]);
  });

  it('clearRoutingCommands re-optimizes auto edges and preserves manual by default', () => {
    const d = fanout();
    d.edges.e2.properties.routeMode = 'manual';
    d.edges.e2.waypoints = [
      { x: 60, y: 130 },
      { x: 320, y: 170 },
    ];
    const preserve = clearRoutingCommands(d, straightRouter, { includeManual: false });
    expect(preserve.preserved).toBe(1);
    expect(preserve.reoptimized).toBe(2); // e1 + e3, not the manual e2
    expect(preserve.commands).toHaveLength(2);

    const total = clearRoutingCommands(d, straightRouter, { includeManual: true });
    expect(total.preserved).toBe(0);
    expect(total.reoptimized).toBe(3); // manual e2 folded back to auto too
  });

  it('longestSegmentMidpoint returns the midpoint of the longest leg', () => {
    const wp = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 200 }, // longest leg
      { x: 40, y: 200 },
    ];
    expect(longestSegmentMidpoint(wp)).toEqual({ x: 10, y: 100 });
  });

  it('sideOfAnchor detects the border an anchor sits on', () => {
    const rect = { x: 0, y: 0, width: 80, height: 60 };
    expect(sideOfAnchor({ x: 80, y: 30 }, rect)).toBe('right');
    expect(sideOfAnchor({ x: 0, y: 30 }, rect)).toBe('left');
    expect(sideOfAnchor({ x: 40, y: 0 }, rect)).toBe('top');
    expect(sideOfAnchor({ x: 40, y: 60 }, rect)).toBe('bottom');
  });
});

describe('router preference round-trips as bpmnr: extension (§1.3/§8.6)', () => {
  it('preserves diagram default and per-edge override across export/import', () => {
    const registry = createDefaultRegistry();
    const converter = () => new BpmnXmlConverter({ registry });
    const diagram = createDiagram({ name: 'RT', id: 'rt' });
    diagram.metadata.router = 'astar';
    diagram.nodes.a = createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 0 }, registry);
    diagram.nodes.b = createNode({ type: 'task', id: 'b', label: 'B', x: 300, y: 0 }, registry);
    diagram.edges.e = createEdge({
      id: 'e',
      sourceId: 'a',
      targetId: 'b',
      properties: { router: 'straight' },
    });

    const { diagram: imported } = converter().fromXml(converter().toXml(diagram));
    expect(imported.metadata.router).toBe('astar');
    expect(imported.edges.e.properties.router).toBe('straight');
  });
});
