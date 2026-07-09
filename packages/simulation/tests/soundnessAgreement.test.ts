import { describe, expect, it } from 'vitest';
import { analyzeSoundness, buildScopeGraphs, type ScopeGraph } from '@bpmn-react/soundness';
import { SimulationEngine } from '../src/index.js';
import { buildSimGraph, type SimGraph } from '../src/graph.js';
import {
  andParallel,
  eventBased,
  nonInterruptingBoundary,
  orRegion,
  threePaths,
  trap,
  xorSplit,
} from './fixtures.js';

/**
 * Handoff 7 §7.2 — the coverage checklist and the deadlock verdict must come
 * from the *same* graph analysis soundness uses. `simulation` may not import
 * `soundness` at runtime (independence test), so the classification is
 * duplicated; this suite pins the duplicate to soundness on shared fixtures,
 * so "tested as identical" is a real guarantee, not a comment.
 */

const simAdjacency = (graph: SimGraph) =>
  [...graph.edges.values()].map((e) => `${e.source}->${e.target}`).sort();

const soundAdjacency = (graph: ScopeGraph) =>
  [...graph.out.values()]
    .flat()
    .filter((f) => !f.implicit) // implicit host→boundary edges aren't sequence flow
    .map((f) => `${f.source}->${f.target}`)
    .sort();

const topScope = (graphs: ScopeGraph[]) => graphs.find((g) => g.scope === undefined)!;

describe('simulation graph == soundness graph', () => {
  const fixtures = {
    xorSplit,
    andParallel,
    trap,
    eventBased,
    orRegion,
    threePaths,
    nonInterruptingBoundary,
  };

  for (const [name, make] of Object.entries(fixtures)) {
    it(`agrees on nodes and sequence-flow adjacency for "${name}"`, () => {
      const diagram = make();
      const sim = buildSimGraph(diagram);
      const sound = topScope(buildScopeGraphs(diagram));
      expect([...sim.nodes.keys()].sort()).toEqual([...sound.nodes.keys()].sort());
      expect(simAdjacency(sim)).toEqual(soundAdjacency(sound));
    });
  }
});

describe('simulator ⇄ soundness verdict agreement', () => {
  it('the trap deadlocks in the engine and soundness flags the same join', () => {
    const diagram = trap();

    const engine = new SimulationEngine(diagram);
    engine.advance(); // s → x
    engine.choose({ kind: 'exclusive', gateway: 'x', edge: 'e1' });
    while (engine.canAdvance) engine.advance();
    expect(engine.deadlocked).toBe(true);

    const deadlockIssues = analyzeSoundness(diagram).filter((i) => i.code === 'SND_DEADLOCK_JOIN');
    expect(deadlockIssues).toHaveLength(1);
    expect(deadlockIssues[0].nodeId).toBe('j'); // the AND-join the token is stuck at
  });

  it('the sound parallel region neither deadlocks nor is flagged', () => {
    const diagram = andParallel();
    const engine = new SimulationEngine(diagram);
    while (engine.canAdvance) engine.advance();
    expect(engine.complete).toBe(true);
    expect(analyzeSoundness(diagram).map((i) => i.code)).not.toContain('SND_DEADLOCK_JOIN');
  });
});
