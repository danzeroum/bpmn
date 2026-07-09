import { describe, expect, it } from 'vitest';
import { SimulationEngine, canonicalizeScenario, hashScenario } from '../src/index.js';
import { orRegion, threePaths, xorSplit } from './fixtures.js';

/** Play a scripted session and return the resulting engine. */
function played() {
  const engine = new SimulationEngine(threePaths());
  engine.advance(); // s → prod
  engine.advance(); // prod → x
  engine.choose({ kind: 'exclusive', gateway: 'x', edge: 'e3' }); // reject
  while (engine.canAdvance) engine.advance();
  return engine;
}

describe('scenario capture', () => {
  it('records only the decisions, with diagram provenance', () => {
    const engine = played();
    expect(engine.scenario).toMatchObject({
      semanticVersion: expect.any(String),
      scope: null,
      decisions: [{ kind: 'exclusive', gateway: 'x', edge: 'e3' }],
    });
  });

  it('captures boundary fires in order', () => {
    const engine = new SimulationEngine(threePaths());
    engine.advance();
    engine.fireBoundary('timer');
    while (engine.canAdvance) engine.advance();
    expect(engine.scenario.decisions).toEqual([
      { kind: 'boundary', host: 'prod', boundary: 'timer' },
    ]);
  });
});

describe('deterministic replay', () => {
  it('reproduces a run bit-for-bit from its scenario', () => {
    const original = played();
    const replayed = SimulationEngine.replay(threePaths(), original.scenario);
    expect(replayed.complete).toBe(original.complete);
    expect(replayed.state.traversedEdges.sort()).toEqual(original.state.traversedEdges.sort());
    expect(replayed.state.trail).toEqual(original.state.trail);
  });

  it('replays a boundary + OR scenario', () => {
    const engine = new SimulationEngine(orRegion());
    engine.advance();
    engine.choose({ kind: 'inclusive', gateway: 'o', edges: ['e1', 'e2'] });
    while (engine.canAdvance) engine.advance();
    const replayed = SimulationEngine.replay(orRegion(), engine.scenario);
    expect(replayed.state.trail).toEqual(engine.state.trail);
    expect(replayed.complete).toBe(true);
  });

  it('throws when a scenario does not fit the diagram', () => {
    const foreign = new SimulationEngine(xorSplit());
    foreign.advance();
    foreign.choose({ kind: 'exclusive', gateway: 'x', edge: 'e1' });
    expect(() => SimulationEngine.replay(threePaths(), foreign.scenario)).toThrow();
  });
});

describe('canonical serialization & hash', () => {
  it('is stable and order-independent for inclusive edge sets', () => {
    const diagram = orRegion(); // same diagram → only the edge order differs
    const a = new SimulationEngine(diagram);
    a.advance();
    a.choose({ kind: 'inclusive', gateway: 'o', edges: ['e1', 'e2'] });
    const b = new SimulationEngine(diagram);
    b.advance();
    b.choose({ kind: 'inclusive', gateway: 'o', edges: ['e2', 'e1'] });
    expect(canonicalizeScenario(a.scenario)).toBe(canonicalizeScenario(b.scenario));
  });

  it('produces a short stable hash', async () => {
    const engine = played();
    const h1 = await hashScenario(engine.scenario);
    const h2 = await hashScenario(engine.scenario);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{12}$/);
  });
});
