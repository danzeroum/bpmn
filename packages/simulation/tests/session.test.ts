import { describe, expect, it } from 'vitest';
import {
  CoverageTracker,
  SimulationEngine,
  buildSession,
  canonicalizeSession,
  coveragePercent,
} from '../src/index.js';
import { threePaths } from './fixtures.js';

/** Run the happy path and register a session from it. */
async function recordedSession() {
  const diagram = threePaths();
  const engine = new SimulationEngine(diagram);
  const tracker = new CoverageTracker(engine.graph);
  engine.advance(); // s → prod
  engine.advance(); // prod → x
  engine.choose({ kind: 'exclusive', gateway: 'x', edge: 'e2' }); // approve
  while (engine.canAdvance) engine.advance();
  tracker.record(engine.state.traversedEdges);
  const session = await buildSession(engine.scenario, tracker.summary, {
    author: 'ana',
    timestamp: '2026-07-09T00:00:00.000Z',
  });
  return { session, engine };
}

describe('buildSession', () => {
  it('captures roteiro, coverage, version and author/timestamp', async () => {
    const { session } = await recordedSession();
    expect(session).toMatchObject({
      semanticVersion: expect.any(String),
      author: 'ana',
      timestamp: '2026-07-09T00:00:00.000Z',
      coverage: { covered: 1, total: 3, exercised: ['e0>e1>e2>e4'] },
    });
    expect(session.scenarioHash).toMatch(/^[0-9a-f]{12}$/);
    expect(session.scenario.decisions).toEqual([
      { kind: 'exclusive', gateway: 'x', edge: 'e2' },
    ]);
  });

  it('coveragePercent reflects the exercised fraction', async () => {
    const { session } = await recordedSession();
    expect(coveragePercent(session.coverage)).toBe(33); // 1 of 3
  });
});

describe('canonicalizeSession', () => {
  it('is stable and order-independent for the exercised set', async () => {
    const { session } = await recordedSession();
    const shuffled = {
      ...session,
      coverage: { ...session.coverage, exercised: [...session.coverage.exercised].reverse() },
    };
    expect(canonicalizeSession(session)).toBe(canonicalizeSession(shuffled));
  });
});
