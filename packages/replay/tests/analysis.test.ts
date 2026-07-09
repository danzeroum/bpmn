import { describe, expect, it } from 'vitest';
import { aggregate, summarizeReplay } from '../src/index.js';
import { linearGraph, trace } from './fixtures.js';

const HOUR = 3_600_000;

function analyze(candidate?: { semanticVersion: string; change: string }) {
  const log = aggregate(linearGraph, [
    trace('c1', ['A', 'B', 'C', 'D'], [0, 5 * HOUR, 6 * HOUR, 7 * HOUR]),
    trace('c2', ['A', 'B', 'C', 'D'], [0, 5 * HOUR, 6 * HOUR, 7 * HOUR]),
    trace('c3', ['A', 'C', 'D']), // deviation A→C
  ]);
  return summarizeReplay(log, {
    diagramId: 'd1',
    versionId: 'v20',
    semanticVersion: '2.0.0',
    author: 'ana',
    timestamp: '2026-07-09T00:00:00.000Z',
    label: (id) => id.toUpperCase(),
    formatMs: (ms) => `${Math.round(ms / HOUR)} h`,
    ...(candidate
      ? { candidateSemanticVersion: candidate.semanticVersion, candidateChange: candidate.change }
      : {}),
  });
}

describe('summarizeReplay', () => {
  it('captures the bottleneck, fitness and top deviation', () => {
    const analysis = analyze();
    expect(analysis.bottleneck).toEqual({ nodeId: 'b', label: 'B', avgMs: 5 * HOUR }); // slowest node
    expect(analysis.topDeviation).toMatchObject({ label: 'A → C', cases: 1 });
    expect(analysis.topDeviation?.share).toBeCloseTo(1 / 3, 5);
    expect(analysis.fitness).toBeCloseTo(7 / 8, 5); // 2×3 fit + 1 fit of 8 moves
    expect(analysis).toMatchObject({ versionId: 'v20', author: 'ana', totalCases: 3 });
  });

  it('builds a headline that names the bottleneck and the candidate fix', () => {
    const analysis = analyze({ semanticVersion: '2.1.0', change: 'timer de 48h' });
    expect(analysis.headline).toContain('O gargalo real da v2.0.0 é "B" (⌀ 5 h)');
    expect(analysis.headline).toContain('1 casos desviam em "A → C"');
    expect(analysis.headline).toContain('a v2.1.0 ataca isso: timer de 48h');
    expect(analysis.candidateSemanticVersion).toBe('2.1.0');
  });

  it('omits the candidate clause when none is supplied', () => {
    expect(analyze().headline).not.toContain('ataca isso');
  });
});
