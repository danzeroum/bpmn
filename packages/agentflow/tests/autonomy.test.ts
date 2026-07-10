import { describe, expect, it } from 'vitest';
import {
  APPROVAL_GATE_AGENT,
  AUTONOMY_SCALE,
  type AutonomyLevel,
  DOCUMENT_REVIEW_AGENT,
  gateRequirement,
  minCoherentLevel,
  requiresDownstreamGate,
  RESEARCH_AGENT,
} from '../src/index.js';

describe('autonomy scale (§4)', () => {
  it('has six rungs, indexed by level, with the normative gate obligations', () => {
    expect(AUTONOMY_SCALE).toHaveLength(6);
    AUTONOMY_SCALE.forEach((def, i) => expect(def.level).toBe(i));
    expect(AUTONOMY_SCALE.map((d) => d.gate)).toEqual([
      'required', // 0 Manual
      'required', // 1 Loop-free
      'required', // 2 Bounded Loop
      'required', // 3 Decision Tree
      'optional', // 4 Multi-Agent
      'none', // 5 Self-Modifying
    ]);
  });

  it('requiresDownstreamGate is true for levels 0–3, false above', () => {
    const expected = [true, true, true, true, false, false];
    ([0, 1, 2, 3, 4, 5] as AutonomyLevel[]).forEach((lvl) =>
      expect(requiresDownstreamGate(lvl)).toBe(expected[lvl]),
    );
    expect(gateRequirement(4)).toBe('optional');
    expect(gateRequirement(5)).toBe('none');
  });
});

describe('minCoherentLevel — the graph decides (§4)', () => {
  it('each template sits at the minimum its graph justifies', () => {
    expect(minCoherentLevel(APPROVAL_GATE_AGENT)).toBe(1); // loop-free
    expect(minCoherentLevel(RESEARCH_AGENT)).toBe(2); // bounded loop
    expect(minCoherentLevel(DOCUMENT_REVIEW_AGENT)).toBe(3); // decision tree
    // and each template DECLARES exactly its minimum
    expect(APPROVAL_GATE_AGENT.autonomyLevel).toBe(1);
    expect(RESEARCH_AGENT.autonomyLevel).toBe(2);
    expect(DOCUMENT_REVIEW_AGENT.autonomyLevel).toBe(3);
  });

  it('a delegate edge lifts the minimum to 4 (Multi-Agent)', () => {
    const withDelegate = structuredClone(RESEARCH_AGENT);
    withDelegate.edges.push({ from: 'llm-1', to: 'agnt-verify@1.0.0', edgeType: 'delegate' });
    expect(minCoherentLevel(withDelegate)).toBe(4);
  });
});
