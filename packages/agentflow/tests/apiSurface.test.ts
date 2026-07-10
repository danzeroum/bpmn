import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Freezes the runtime public API surface of @buildtovalue/agentflow (type-only
 * exports are erased and never appear here). Adding an export means updating
 * this list; renaming/removing one is a breaking change (Handoff 12 §9.9,
 * "apiSurface para toda API nova").
 */
const EXPECTED_EXPORTS = [
  'APPROVAL_GATE_AGENT',
  'AUTONOMY_SCALE',
  'AgentRefError',
  'DEFAULT_TEMPLATE_ID',
  'DOCUMENT_REVIEW_AGENT',
  'END_ROUTE',
  'RESEARCH_AGENT',
  'TEMPLATES',
  'autonomyCoherence',
  'canReach',
  'decisionRoutes',
  'formatRef',
  'gateRequirement',
  'hasDelegateEdge',
  'hasRetryLoop',
  'internalSuccessors',
  'isBranchingDecision',
  'isValid',
  'isValidRef',
  'loopComponents',
  'minCoherentLevel',
  'nodeIndex',
  'parseRef',
  'requiresDownstreamGate',
  'toRef',
  'validateGraph',
].sort();

describe('@buildtovalue/agentflow public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });

  it('never exports undefined', () => {
    for (const key of Object.keys(api)) {
      expect(api[key as keyof typeof api], `export "${key}" is undefined`).not.toBeUndefined();
    }
  });
});
