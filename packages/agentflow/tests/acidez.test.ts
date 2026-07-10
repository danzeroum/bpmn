import { describe, expect, it } from 'vitest';
import {
  type AgentRef,
  type AgentWorkflow,
  hasRetryLoop,
  isBranchingDecision,
  minCoherentLevel,
  validateGraph,
} from '../src/index.js';

/**
 * Acid test (Handoff 12 §9.1, same spirit as replay's coffee-recipe adapter):
 * the validator reasons over an ABSTRACT, fabricated agent graph and an
 * INJECTED delegate resolver — no registry, no library, no core, no real
 * artifact in sight. If validation, autonomy inference and delegate
 * resolution all work on this hand-built graph, the package is genuinely
 * decoupled (it operates on injected data, cerca §1.7).
 */

// A whimsical, entirely fabricated multi-agent graph — nothing registered.
const sandwichAgent: AgentWorkflow = {
  kind: 'AgentWorkflow',
  id: 'agnt-sandwich',
  version: '3.0.0',
  name: 'Sandwich Concierge',
  autonomyLevel: 4, // has a delegate edge → Multi-Agent
  inputSchema: { order: 'string' },
  outputSchema: { plate: 'string', is_complete: 'boolean' },
  nodes: [
    { id: 'plan', type: 'llm', config: { model: 'sous-chef-1', promptRef: 'prm:plate@1.0.0', structuredOutput: true } },
    { id: 'grill', type: 'tool', config: { usesTool: 'panini_press', timeoutMs: 90_000 } },
    {
      id: 'taste',
      type: 'decision',
      config: {
        condition: 'output.is_complete === true',
        onTrue: { next: 'end' },
        onFalse: { next: 'plan', maxRetries: 2 },
      },
    },
  ],
  edges: [
    { from: 'plan', to: 'grill', edgeType: 'toolCall' },
    { from: 'grill', to: 'taste', edgeType: 'data' },
    { from: 'taste', to: 'plan', edgeType: 'data', when: 'retry' },
    { from: 'plan', to: 'agnt-garnish@2.0.0', edgeType: 'delegate' },
  ],
};

describe('agentflow over a fabricated graph with injected resolution', () => {
  it('infers autonomy from graph structure alone', () => {
    expect(hasRetryLoop(sandwichAgent)).toBe(true);
    expect(isBranchingDecision(sandwichAgent)).toBe(false); // the branch loops back
    expect(minCoherentLevel(sandwichAgent)).toBe(4); // delegate edge wins
  });

  it('validates clean when the injected resolver knows the delegate ref', () => {
    const known = new Set(['agnt-garnish']);
    const resolveDelegate = (ref: AgentRef): boolean => known.has(ref.id);
    const issues = validateGraph(sandwichAgent, { resolveDelegate });
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(issues.find((i) => i.code === 'DELEGATE_UNRESOLVED')).toBeUndefined();
  });

  it('degrades a delegate to a warning (never an error) with no resolver', () => {
    const issues = validateGraph(sandwichAgent);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    const unresolved = issues.find((i) => i.code === 'DELEGATE_UNRESOLVED');
    expect(unresolved?.severity).toBe('warning');
  });
});
