import { describe, expect, it } from 'vitest';
import {
  AGENT_SIMULATION_SESSION_TYPE,
  agentSimulationSessionEntry,
  type AgentSimulationSession,
} from '../src/index.js';

/**
 * Handoff 12 A-5 §7 — the agent-simulation ledger session is an ADDITIVE entry
 * type (same injection pattern as SIMULATION_SESSION), carrying the sub-workflow
 * ref@version and the honest stop when the run blocked.
 */
const base: AgentSimulationSession = {
  workflowRef: 'agnt-rsch@2.1.0',
  steps: 7,
  complete: true,
  author: 'ia.copilot',
  timestamp: '2026-07-10T00:00:00.000Z',
};

describe('agentSimulationSessionEntry', () => {
  it('maps a completed session to an audit entry with the versioned ref', () => {
    const entry = agentSimulationSessionEntry(base);
    expect(entry.type).toBe(AGENT_SIMULATION_SESSION_TYPE);
    expect(entry.versionId).toBe('agnt-rsch@2.1.0');
    expect(entry.details).toMatchObject({
      artifactId: 'agnt-rsch', // bare id → "filter by this artifact"
      workflowRef: 'agnt-rsch@2.1.0',
      steps: 7,
      complete: true,
    });
    expect(entry.details).not.toHaveProperty('blockedNode');
  });

  it('records the honest stop (node + reason) when the run blocked', () => {
    const entry = agentSimulationSessionEntry({
      ...base,
      complete: false,
      blocked: { nodeId: 'dec-3', reason: 'retry exhausted after 3 attempts (4 tries)' },
    });
    expect(entry.details).toMatchObject({
      complete: false,
      blockedNode: 'dec-3',
      blockedReason: 'retry exhausted after 3 attempts (4 tries)',
    });
  });

  it('prefers an explicit actor over the session author', () => {
    expect(agentSimulationSessionEntry(base, { id: 'u-42' }).userId).toBe('u-42');
    expect(agentSimulationSessionEntry(base).userId).toBe('ia.copilot');
  });
});
