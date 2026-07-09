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
