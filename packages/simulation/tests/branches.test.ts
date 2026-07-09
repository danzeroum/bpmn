import { describe, expect, it } from 'vitest';
import {
  CoverageTracker,
  MAX_PATHS,
  SimulationEngine,
  buildSimGraph,
  canonicalizeScenario,
  enumerateStructuralPaths,
} from '../src/index.js';
import { flow, linear, threePaths, xorSplit } from './fixtures.js';

describe('implicit start & sink', () => {
  it('seeds source nodes when there is no start event and consumes sinks', () => {
    const diagram = flow(['a:task', 'b:task'], ['a->b']); // no start, no end
    const engine = new SimulationEngine(diagram);
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['a']); // seeded at the source
    while (engine.canAdvance) engine.advance();
    expect(engine.complete).toBe(true); // 'b' consumed as an implicit end
    expect(engine.hasApproximateSemantics).toBe(false);
  });
});

describe('graph robustness', () => {
  it('drops edges with a missing endpoint (dangling / cross-scope)', () => {
    const diagram = flow(['s:startEvent', 'a:task', 'e:endEvent'], ['s->a', 'a->e', 'a->ghost']);
    const graph = buildSimGraph(diagram);
    expect(graph.edges.size).toBe(2); // a->ghost skipped
  });

  it('ignores a boundary whose host is not in scope', () => {
    const diagram = flow(['s:startEvent', 'a:task', 'e:endEvent', 'b:boundaryEvent'], ['s->a', 'a->e'], (d) => {
      d.nodes.b.properties.attachedToRef = 'nonexistent';
    });
    const graph = buildSimGraph(diagram);
    expect(graph.boundariesByHost.size).toBe(0);
    expect(graph.nodes.get('b')?.boundaryHost).toBeUndefined();
  });

  it('an empty scope completes immediately', () => {
    const engine = new SimulationEngine(linear(), { scope: 'does-not-exist' });
    expect(engine.graph.nodes.size).toBe(0);
    expect(engine.complete).toBe(true);
    expect(engine.canAdvance).toBe(false);
  });
});

describe('engine edge cases', () => {
  it('advance is a no-op once complete', () => {
    const engine = new SimulationEngine(linear());
    while (engine.canAdvance) engine.advance();
    expect(engine.complete).toBe(true);
    expect(engine.advance()).toEqual({ moved: false, transitions: [] });
  });

  it('choose() routes a boundary decision to fireBoundary', () => {
    const engine = new SimulationEngine(threePaths());
    engine.advance(); // s → prod
    engine.choose({ kind: 'boundary', host: 'prod', boundary: 'timer' });
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['timer']);
  });
});

describe('replay divergence', () => {
  it('throws when the scenario carries a decision that never becomes due', () => {
    const engine = new SimulationEngine(xorSplit());
    engine.advance();
    engine.choose({ kind: 'exclusive', gateway: 'x', edge: 'e1' });
    const scenario = engine.scenario;
    scenario.decisions.push({ kind: 'exclusive', gateway: 'x', edge: 'e2' }); // extra, unreachable
    expect(() => SimulationEngine.replay(xorSplit(), scenario)).toThrow(/unreachable/);
  });
});

describe('coverage helpers', () => {
  it('reports isCovered and never counts an empty-edge path', () => {
    const engine = new SimulationEngine(xorSplit());
    const tracker = new CoverageTracker(engine.graph);
    engine.advance();
    engine.choose({ kind: 'exclusive', gateway: 'x', edge: 'e1' });
    while (engine.canAdvance) engine.advance();
    const [covered] = tracker.record(engine.state.traversedEdges);
    expect(tracker.isCovered(covered)).toBe(true);
    expect(tracker.summary.paths.some((p) => p.edges.length === 0)).toBe(false);
  });
});

describe('path enumeration safety cap', () => {
  it('truncates and flags when a diamond chain exceeds MAX_PATHS', () => {
    // 11 reconverging XOR diamonds → 2^11 routes, well over MAX_PATHS.
    const nodes = ['s:startEvent', 'end:endEvent'];
    const edges = ['s->g0'];
    const diamonds = 11;
    for (let i = 0; i < diamonds; i++) {
      nodes.push(`g${i}:exclusiveGateway`, `a${i}:task`, `b${i}:task`);
      const next = i === diamonds - 1 ? 'end' : `g${i + 1}`;
      edges.push(`g${i}->a${i}`, `g${i}->b${i}`, `a${i}->${next}`, `b${i}->${next}`);
    }
    const graph = buildSimGraph(flow(nodes, edges));
    const paths = enumerateStructuralPaths(graph);
    expect(paths.length).toBe(MAX_PATHS);
    expect(paths.at(-1)?.label.endsWith('…')).toBe(true);
    expect(new CoverageTracker(graph).summary.truncated).toBe(true);
  });
});

describe('scenario canonicalization of boundary decisions', () => {
  it('serializes a boundary decision in canonical form', () => {
    const engine = new SimulationEngine(threePaths());
    engine.advance();
    engine.fireBoundary('timer');
    expect(canonicalizeScenario(engine.scenario)).toContain(
      '"kind":"boundary","host":"prod","boundary":"timer"',
    );
  });
});
