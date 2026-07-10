import { describe, expect, it } from 'vitest';
import { type AgentWorkflow, type Fixtures, simulate } from '../src/index.js';

/**
 * Light benchmark (cerca §5): a 50-node workflow must simulate well under an
 * honest wall-clock threshold. The bound is deliberately generous so it guards
 * against accidental O(n²)/pathological regressions without being flaky in CI;
 * the determinism guarantee is asserted elsewhere.
 */
function linearWorkflow(nodeCount: number): { wf: AgentWorkflow; fixtures: Fixtures } {
  const nodes: AgentWorkflow['nodes'] = [];
  const edges: AgentWorkflow['edges'] = [];
  const fixtures: Fixtures = {};
  for (let i = 0; i < nodeCount; i += 1) {
    const id = `n${i}`;
    // alternate llm and tool so both execution paths are exercised
    if (i % 2 === 0) {
      nodes.push({ id, type: 'llm', config: { model: 'm', promptRef: 'prm:x@1.0.0' } });
    } else {
      nodes.push({ id, type: 'tool', config: { usesTool: 'noop' } });
    }
    fixtures[id] = { outputs: [{ ok: true }] };
    if (i > 0) edges.push({ from: `n${i - 1}`, to: id, edgeType: 'data' });
  }
  return {
    wf: {
      kind: 'AgentWorkflow',
      id: 'agnt-bench',
      version: '1.0.0',
      name: 'Bench',
      autonomyLevel: 1,
      inputSchema: { seed: 'string' },
      outputSchema: { ok: 'boolean' },
      nodes,
      edges,
    },
    fixtures,
  };
}

describe('simulate — light benchmark (§5)', () => {
  it('simulates a 50-node workflow to completion under threshold', () => {
    const { wf, fixtures } = linearWorkflow(50);
    const start = performance.now();
    let state = simulate(wf, { fixtures });
    for (let i = 0; i < 20; i += 1) state = simulate(wf, { fixtures });
    const perRun = (performance.now() - start) / 21;

    expect(state.complete).toBe(true);
    expect(state.visitedNodes).toHaveLength(50);
    // honest, non-flaky ceiling: a 50-node run should be well under 20ms
    expect(perRun).toBeLessThan(20);
  });
});
