import { describe, expect, it } from 'vitest';
import { aggregate, type ReplayGraph, type Trace } from '../src/index.js';

/**
 * Performance canary (cerca §0.3 / aceite §5): a 100k-event log must aggregate
 * in a single pass in well under 2s. This measures the pure O(n) aggregation
 * (no DOM); the honest budget is generous versus the real cost (~tens of ms),
 * so it catches accidental super-linear regressions rather than hardware jitter.
 */
function chainGraph(steps: number): ReplayGraph {
  const nodes = Array.from({ length: steps }, (_, i) => ({ id: `n${i}`, name: `act${i}` }));
  const edges = Array.from({ length: steps - 1 }, (_, i) => ({
    id: `e${i}`,
    source: `n${i}`,
    target: `n${i + 1}`,
  }));
  return { nodes, edges };
}

function conformantLog(cases: number, steps: number): Trace[] {
  const activities = Array.from({ length: steps }, (_, i) => `act${i}`);
  const traces: Trace[] = [];
  for (let c = 0; c < cases; c++) {
    traces.push({
      caseId: `case-${c}`,
      events: activities.map((activity, i) => ({ activity, timestamp: i * 1000 })),
    });
  }
  return traces;
}

describe('performance', () => {
  it('aggregates a 100k-event log in under 2s (§5)', () => {
    const steps = 10;
    const cases = 10_000; // 10 events/case → 100k events
    const graph = chainGraph(steps);
    const traces = conformantLog(cases, steps);
    expect(traces.length * steps).toBe(100_000);

    const start = performance.now();
    const result = aggregate(graph, traces);
    const elapsed = performance.now() - start;

    expect(result.totalEvents).toBe(100_000);
    expect(result.fitness.fitness).toBe(1);
    expect(elapsed).toBeLessThan(2000);
  });
});
