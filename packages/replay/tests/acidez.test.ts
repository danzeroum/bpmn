import { describe, expect, it } from 'vitest';
import { aggregate, type ReplayGraph, type Trace } from '../src/index.js';

/**
 * Acid test (Handoff 7 §7.3, same spirit as the library's recipe adapter): the
 * replay engine reasons over an ABSTRACT graph and knows nothing about BPMN.
 * Here the "model" is a coffee-brewing recipe and the "log" is brew runs — no
 * node, edge, gateway or diagram in sight. If fitness/heatmap/deviations work
 * on this, the engine is genuinely decoupled (it operates on injected data).
 */
const coffeeGraph: ReplayGraph = {
  nodes: [
    { id: 'n1', name: 'grind' },
    { id: 'n2', name: 'heat water' },
    { id: 'n3', name: 'brew' },
    { id: 'n4', name: 'serve' },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
  ],
};

const brews: Trace[] = [
  { caseId: 'mug-1', events: [{ activity: 'grind', timestamp: 0 }, { activity: 'heat water', timestamp: 60_000 }, { activity: 'brew', timestamp: 120_000 }, { activity: 'serve', timestamp: 300_000 }] },
  { caseId: 'mug-2', events: [{ activity: 'grind' }, { activity: 'brew' }, { activity: 'serve' }] }, // skipped "heat water"
];

describe('replay over a fake, non-BPMN graph', () => {
  it('computes fitness, deviations and a bottleneck with zero ecosystem knowledge', () => {
    const result = aggregate(coffeeGraph, brews);
    // mug-2 skips "heat water": grind→brew is not an edge → one deviation.
    expect(result.deviations).toEqual([{ from: 'n1', to: 'n3', count: 1, cases: 1 }]);
    expect(result.fitness.conformingCases).toBe(1);
    expect(result.fitness.totalCases).toBe(2);
    // The slow step (brew→serve, 3 min) is the bottleneck.
    expect(result.bottleneckNodeId).toBe('n3');
    expect(result.variants).toHaveLength(2);
  });
});
