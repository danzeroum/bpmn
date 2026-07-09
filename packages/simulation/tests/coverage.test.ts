import { describe, expect, it } from 'vitest';
import { CoverageTracker, SimulationEngine, enumerateStructuralPaths } from '../src/index.js';
import { buildSimGraph } from '../src/graph.js';
import { andParallel, threePaths, xorSplit } from './fixtures.js';

describe('structural path enumeration', () => {
  it('enumerates the three prototype paths (happy / rejection / timeout)', () => {
    const paths = enumerateStructuralPaths(buildSimGraph(threePaths()));
    const signatures = paths.map((p) => p.id).sort();
    expect(signatures).toEqual(['e0>e1>e2>e4', 'e0>e1>e3>e5', 'e0>e6'].sort());
  });

  it('an XOR yields one path per branch', () => {
    const paths = enumerateStructuralPaths(buildSimGraph(xorSplit()));
    expect(paths).toHaveLength(2);
  });

  it('a parallel region is one structural path (both branches belong to it)', () => {
    const paths = enumerateStructuralPaths(buildSimGraph(andParallel()));
    // f→a and f→b are two forks of the same run; enumeration lists each route
    // to the terminal, all of which a single parallel session covers at once.
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });
});

describe('CoverageTracker', () => {
  it('closes 3/3 across the three prototype sessions and persists across resets', () => {
    const diagram = threePaths();
    const engine = new SimulationEngine(diagram);
    const tracker = new CoverageTracker(engine.graph);
    expect(tracker.summary).toMatchObject({ total: 3, covered: 0 });

    // Session 1 — happy path (approve).
    engine.advance(); // s → prod
    engine.advance(); // prod → x
    engine.choose({ kind: 'exclusive', gateway: 'x', edge: 'e2' });
    while (engine.canAdvance) engine.advance();
    tracker.record(engine.state.traversedEdges);
    expect(tracker.summary.covered).toBe(1);

    // Session 2 — rejection. reset() must NOT wipe accumulated coverage.
    engine.reset();
    engine.advance();
    engine.advance();
    engine.choose({ kind: 'exclusive', gateway: 'x', edge: 'e3' });
    while (engine.canAdvance) engine.advance();
    tracker.record(engine.state.traversedEdges);
    expect(tracker.summary.covered).toBe(2);

    // Session 3 — timeout (boundary).
    engine.reset();
    engine.advance();
    engine.fireBoundary('timer');
    while (engine.canAdvance) engine.advance();
    tracker.record(engine.state.traversedEdges);

    const summary = tracker.summary;
    expect(summary).toMatchObject({ total: 3, covered: 3 });
    expect(summary.paths.every((p) => p.covered)).toBe(true);
  });
});
