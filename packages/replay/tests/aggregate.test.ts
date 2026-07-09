import { describe, expect, it } from 'vitest';
import { aggregate, normalizeName } from '../src/index.js';
import { linearGraph, trace } from './fixtures.js';

describe('token-replay fitness (cerca §0.2 — never alignments)', () => {
  it('a fully-conformant log scores fitness 1 with zero deviations (§7.6)', () => {
    const result = aggregate(linearGraph, [
      trace('c1', ['A', 'B', 'C', 'D']),
      trace('c2', ['A', 'B', 'C', 'D']),
    ]);
    expect(result.fitness.fitness).toBe(1);
    expect(result.fitness.conformingCases).toBe(2);
    expect(result.fitness.totalCases).toBe(2);
    expect(result.deviations).toEqual([]);
  });

  it('reports exact fitness and deviations for a known non-conformance (§7.6)', () => {
    const result = aggregate(linearGraph, [
      trace('c1', ['A', 'B', 'C', 'D']), // 3/3 fit
      trace('c2', ['A', 'C', 'D']), // A→C is a deviation, C→D fit → 1/2
    ]);
    // total moves = 3 + 2 = 5; fit = 3 + 1 = 4.
    expect(result.fitness.fitMoves).toBe(4);
    expect(result.fitness.totalMoves).toBe(5);
    expect(result.fitness.fitness).toBeCloseTo(0.8, 10);
    expect(result.fitness.conformingCases).toBe(1);
    expect(result.deviations).toEqual([{ from: 'a', to: 'c', count: 1, cases: 1 }]);
  });

  it('counts a repeated activity with no self-edge as a deviation', () => {
    const result = aggregate(linearGraph, [trace('c1', ['A', 'B', 'B', 'C', 'D'])]);
    expect(result.deviations).toEqual([{ from: 'b', to: 'b', count: 1, cases: 1 }]);
    expect(result.fitness.conformingCases).toBe(0);
  });
});

describe('frequency and time aggregation (one pass)', () => {
  it('accumulates edge frequency and average transition time', () => {
    const result = aggregate(linearGraph, [
      trace('c1', ['A', 'B', 'C', 'D'], [0, 1000, 3000, 6000]),
      trace('c2', ['A', 'B', 'C', 'D'], [0, 3000, 4000, 5000]),
    ]);
    const ab = result.edges.find((e) => e.edgeId === 'ab')!;
    expect(ab.count).toBe(2);
    expect(ab.avgMs).toBe(2000); // (1000 + 3000) / 2
    const cd = result.edges.find((e) => e.edgeId === 'cd')!;
    expect(cd.avgMs).toBe(2000); // (3000 + 1000) / 2
  });

  it('computes node sojourn times and flags the bottleneck', () => {
    const result = aggregate(linearGraph, [trace('c1', ['A', 'B', 'C', 'D'], [0, 1000, 3000, 6000])]);
    const c = result.nodes.find((n) => n.nodeId === 'c')!;
    expect(c.avgMs).toBe(3000); // C→D took 3000ms
    expect(result.bottleneckNodeId).toBe('c'); // longest sojourn
  });

  it('omits times when timestamps are absent but still counts frequency', () => {
    const result = aggregate(linearGraph, [trace('c1', ['A', 'B', 'C'])]);
    expect(result.edges.find((e) => e.edgeId === 'ab')?.avgMs).toBeUndefined();
    expect(result.edges.find((e) => e.edgeId === 'ab')?.count).toBe(1);
    expect(result.bottleneckNodeId).toBeUndefined();
  });
});

describe('variants and unmapped activities', () => {
  it('extracts top variants by share', () => {
    const result = aggregate(
      linearGraph,
      [
        trace('c1', ['A', 'B', 'C', 'D']),
        trace('c2', ['A', 'B', 'C', 'D']),
        trace('c3', ['A', 'C', 'D']),
      ],
      { topVariants: 2 },
    );
    expect(result.variants).toHaveLength(2);
    expect(result.variants[0]).toMatchObject({ count: 2, share: 2 / 3 });
    expect(result.variants[0].activities).toEqual(['A', 'B', 'C', 'D']);
    expect(result.variants[1]).toMatchObject({ count: 1, share: 1 / 3, sampleCaseId: 'c3' });
  });

  it('reports activities with no matching node and treats their moves as deviations', () => {
    const result = aggregate(linearGraph, [trace('c1', ['A', 'B', 'Z', 'D'])]);
    expect(result.unmapped).toEqual(['Z']);
    // B→Z and Z→D both deviate (Z has no node).
    expect(result.deviations.map((d) => `${d.from}>${d.to}`).sort()).toEqual(['?Z>d', 'b>?Z']);
  });

  it('matches activity names case/space-insensitively', () => {
    const result = aggregate(linearGraph, [trace('c1', ['  a ', 'B', 'c', 'D'])]);
    expect(result.unmapped).toEqual([]);
    expect(result.fitness.fitness).toBe(1);
  });
});

describe('normalizeName', () => {
  it('trims, lowercases and collapses whitespace', () => {
    expect(normalizeName('  Coletar   Briefing ')).toBe('coletar briefing');
  });
});

describe('totals', () => {
  it('reports total events and cases', () => {
    const result = aggregate(linearGraph, [
      trace('c1', ['A', 'B']),
      trace('c2', ['A', 'B', 'C']),
    ]);
    expect(result.totalCases).toBe(2);
    expect(result.totalEvents).toBe(5);
  });
});
