import { describe, expect, it } from 'vitest';
import {
  APPROVAL_GATE_AGENT,
  DEFAULT_COST_MODEL,
  DOCUMENT_REVIEW_AGENT,
  RESEARCH_AGENT,
  type Fixtures,
  simulate,
} from '../src/index.js';

/** Fixtures that let the Research loop retry once, then complete. */
const RESEARCH_FIXTURES: Fixtures = {
  'llm-1': {
    outputs: [
      { query: 'origins of coffee', is_complete: false, answer: 'partial', sources: ['a'] },
      { is_complete: true, answer: 'full', sources: ['a', 'b'] },
    ],
  },
  'tool-2': { outputs: [{ results: ['a'] }, { results: ['a', 'b'] }] },
};

describe('simulate — semantics (§2)', () => {
  it('runs the Research loop: one retry, then a clean finish', () => {
    const state = simulate(RESEARCH_AGENT, { fixtures: RESEARCH_FIXTURES });
    expect(state.complete).toBe(true);
    expect(state.blockedDecision).toBeNull();
    expect(state.tokens).toEqual([]); // consumed at end
    // the decision fired twice: false → retry, then true → end
    const decisions = state.trail.filter((t) => t.type === 'decision');
    expect(decisions).toHaveLength(2);
    expect(decisions[0].message).toContain('false (onFalse)');
    expect(decisions[1].message).toContain('true (onTrue)');
    expect(state.trail.some((t) => t.message.includes('↺ retry 1/3'))).toBe(true);
    expect(state.trail.at(-1)?.type).toBe('end');
  });

  it('data-mapping: tool params resolve {{node.output.path}} from context', () => {
    const state = simulate(RESEARCH_AGENT, { fixtures: RESEARCH_FIXTURES });
    const toolStep = state.trail.find((t) => t.message.startsWith('🛠 tool-2'));
    // params.query = "{{llm-1.output.query}}" → resolved to the llm's query
    expect(toolStep?.message).toContain('origins of coffee');
    expect(toolStep?.message).not.toContain('{{');
  });

  it('memory decorator is visible in the trail (§4)', () => {
    const state = simulate(RESEARCH_AGENT, { fixtures: RESEARCH_FIXTURES });
    expect(state.trail.some((t) => t.message.startsWith('💾 llm-1 memory[short·6h]'))).toBe(true);
  });
});

describe('simulate — honest stops (§3)', () => {
  it('retry exhausted → BlockedDecision naming node, reason and count', () => {
    // llm-1 never completes → the retry loop runs out.
    const state = simulate(RESEARCH_AGENT, {
      fixtures: {
        'llm-1': { outputs: [{ is_complete: false }] },
        'tool-2': { outputs: [{ results: [] }] },
      },
    });
    expect(state.complete).toBe(false);
    expect(state.blockedDecision).toEqual({
      nodeId: 'dec-3',
      cell: 'onFalse',
      reason: 'retry exhausted after 3 attempts (4 tries)',
    });
    expect(state.trail.at(-1)?.type).toBe('decision-blocked');
    expect(state.tokens).toEqual([{ id: 'token', nodeId: 'dec-3' }]); // rests on the block
  });

  it('a condition referencing an absent field blocks (never guesses)', () => {
    // no fixtures → merged output has no is_complete
    const state = simulate(RESEARCH_AGENT, {
      fixtures: { 'llm-1': { outputs: [{ answer: 'x' }] }, 'tool-2': { outputs: [{}] } },
    });
    expect(state.blockedDecision?.nodeId).toBe('dec-3');
    expect(state.blockedDecision?.cell).toBe('condition');
    expect(state.blockedDecision?.reason).toMatch(/output\.is_complete, which is absent/);
  });

  it('a condition outside the simulable subset blocks honestly', () => {
    const wf = structuredClone(RESEARCH_AGENT);
    const dec = wf.nodes.find((n) => n.id === 'dec-3')!;
    if (dec.type === 'decision') dec.config.condition = 'output.a && output.b';
    const state = simulate(wf, { fixtures: RESEARCH_FIXTURES });
    expect(state.blockedDecision?.reason).toMatch(/outside the simulable subset/);
  });

  it('a decision route to a non-existent node blocks (never guesses)', () => {
    const wf = structuredClone(RESEARCH_AGENT);
    const dec = wf.nodes.find((n) => n.id === 'dec-3')!;
    if (dec.type === 'decision') dec.config.onTrue.next = 'ghost';
    const state = simulate(wf, { fixtures: RESEARCH_FIXTURES });
    expect(state.blockedDecision).toMatchObject({ nodeId: 'dec-3', cell: 'onTrue' });
    expect(state.blockedDecision?.reason).toMatch(/"ghost", which is not a node/);
  });

  it('an unbounded loop-back route (no maxRetries) blocks honestly', () => {
    const wf = structuredClone(RESEARCH_AGENT);
    const dec = wf.nodes.find((n) => n.id === 'dec-3')!;
    if (dec.type === 'decision') delete dec.config.onFalse.maxRetries; // now unbounded
    const state = simulate(wf, {
      fixtures: { 'llm-1': { outputs: [{ is_complete: false }] }, 'tool-2': { outputs: [{}] } },
    });
    expect(state.blockedDecision).toMatchObject({ nodeId: 'dec-3', cell: 'onFalse' });
    expect(state.blockedDecision?.reason).toMatch(/unbounded retry route/);
  });

  it('the step budget is a safety net that blocks, never hangs', () => {
    const state = simulate(RESEARCH_AGENT, { fixtures: RESEARCH_FIXTURES, maxSteps: 3 });
    expect(state.blockedDecision?.cell).toBe('budget');
    expect(state.blockedDecision?.reason).toMatch(/step budget 3 exhausted/);
  });
});

describe('simulate — decorators: errorBoundary (§4)', () => {
  it('consumes retries with simulated (logical) backoff, then recovers', () => {
    // llm-1 fails twice, then succeeds; errorBoundary maxRetries 3 (exp) absorbs it.
    const state = simulate(RESEARCH_AGENT, {
      fixtures: {
        'llm-1': { fails: 2, outputs: [{ is_complete: true, answer: 'ok' }] },
        'tool-2': { outputs: [{ results: ['a'] }] },
      },
    });
    expect(state.complete).toBe(true);
    const retries = state.trail.filter((t) => t.message.includes('errorBoundary retry'));
    expect(retries).toHaveLength(2);
    // exponential backoff: Δ1 (t=1) then Δ2 (t=3) — logical time, not wall-clock
    expect(retries[0].message).toContain('Δ1 (t=1)');
    expect(retries[1].message).toContain('Δ2 (t=3)');
  });

  it('exhausts the error boundary → BlockedDecision naming the count', () => {
    const state = simulate(RESEARCH_AGENT, {
      fixtures: { 'llm-1': { fails: 9, outputs: [{ is_complete: true }] } },
    });
    expect(state.blockedDecision).toMatchObject({
      nodeId: 'llm-1',
      cell: 'errorBoundary',
      reason: 'error boundary exhausted after 3 retries',
    });
  });

  it('a failing node with no error boundary is a hard stop', () => {
    // Document Review's llm-extract has no errorBoundary decorator.
    const state = simulate(DOCUMENT_REVIEW_AGENT, {
      fixtures: { 'llm-extract': { fails: 1, outputs: [{ is_valid: true }] } },
    });
    expect(state.blockedDecision).toMatchObject({ nodeId: 'llm-extract', cell: 'execution' });
  });
});

describe('simulate — Squad Lane SL-3 honest budget stop (§6)', () => {
  it('BUDGET_EXCEEDED (steps): stops honestly naming node + reason + count', () => {
    const state = simulate(RESEARCH_AGENT, { fixtures: RESEARCH_FIXTURES, budget: { maxSteps: 1 } });
    expect(state.complete).toBe(false);
    expect(state.blockedDecision?.cell).toBe('budget');
    expect(state.blockedDecision?.nodeId).toBe('tool-2'); // the step that pushes past 1
    expect(state.blockedDecision?.reason).toBe('projected steps 2 exceed budget maxSteps 1');
    // never a silent continuation — the stop is the last trail entry
    expect(state.trail.at(-1)?.type).toBe('decision-blocked');
  });

  it('BUDGET_EXCEEDED (tokens): projected tokens come from the node maxOutputTokens (no costModel needed)', () => {
    // llm-1 declares maxOutputTokens 4096 → the token projection is a declared field.
    const state = simulate(RESEARCH_AGENT, { fixtures: RESEARCH_FIXTURES, budget: { maxTokens: 4000 } });
    expect(state.blockedDecision?.nodeId).toBe('llm-1');
    expect(state.blockedDecision?.reason).toBe('projected tokens 4096 exceed budget maxTokens 4000');
  });

  it('cost/time are NOT enforced without an injected costModel (no invented rate, §2.7)', () => {
    // an absurdly tight cost/time budget must NOT stop the run when no rate is injected
    const state = simulate(RESEARCH_AGENT, {
      fixtures: RESEARCH_FIXTURES,
      budget: { maxCostBRL: 0.0001, maxWallTimeMs: 1 },
    });
    expect(state.complete).toBe(true);
    expect(state.blockedDecision).toBeNull();
  });

  it('cost IS enforced once the host injects a costModel (opt-in)', () => {
    const state = simulate(RESEARCH_AGENT, {
      fixtures: RESEARCH_FIXTURES,
      budget: { maxCostBRL: 0.01 },
      costModel: DEFAULT_COST_MODEL, // 4096 tok × 0.05/1k ≈ 0.20 BRL > 0.01
    });
    expect(state.blockedDecision?.cell).toBe('budget');
    expect(state.blockedDecision?.reason).toMatch(/projected cost BRL .* exceeds budget maxCostBRL 0\.01/);
  });

  it('reads wf.budget when no option budget is given (generous template budget → no stop)', () => {
    const state = simulate(RESEARCH_AGENT, { fixtures: RESEARCH_FIXTURES });
    expect(state.complete).toBe(true);
    expect(state.blockedDecision).toBeNull();
  });

  it('the projection is deterministic — a budget-limited run is byte-identical 10×', () => {
    const runs = Array.from({ length: 10 }, () =>
      JSON.stringify(simulate(RESEARCH_AGENT, { fixtures: RESEARCH_FIXTURES, budget: { maxSteps: 1 } })),
    );
    expect(new Set(runs).size).toBe(1);
  });
});

describe('simulate — determinism (§2 / §9.4)', () => {
  it('the same run 10× produces a byte-identical trail', () => {
    const runs = Array.from({ length: 10 }, () =>
      JSON.stringify(simulate(RESEARCH_AGENT, { fixtures: RESEARCH_FIXTURES })),
    );
    expect(new Set(runs).size).toBe(1);
  });
});

describe('simulate — templates', () => {
  it('Approval Gate Agent completes (loop-free)', () => {
    const state = simulate(APPROVAL_GATE_AGENT, {
      fixtures: { 'llm-review': { outputs: [{ approved: true, rationale: 'ok' }] } },
    });
    expect(state.complete).toBe(true);
    expect(state.blockedDecision).toBeNull();
  });

  it('Document Review Agent branches to classify when valid', () => {
    const state = simulate(DOCUMENT_REVIEW_AGENT, {
      fixtures: {
        'llm-extract': { outputs: [{ is_valid: true, extracted: 'x' }] },
        'llm-classify': { outputs: [{ category: 'invoice' }] },
      },
    });
    expect(state.complete).toBe(true);
    expect(state.visitedNodes).toContain('llm-classify');
  });
});
