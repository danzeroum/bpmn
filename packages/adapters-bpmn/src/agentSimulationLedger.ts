import type { AuditEntryInput, UserContext } from '@buildtovalue/core';

/**
 * Agent Lane (Handoff 12 §7) — a mock agent-simulation session recorded in the
 * ledger as an ADDITIVE entry type, the same injection pattern as the H7
 * `SIMULATION_SESSION` (`simulationLedger.ts`): the `agentflow` engine never
 * imports the ledger; the host maps a finished run into an audit entry here.
 * Recognized by the SACM generator (which matches `/SIMULATION/`) and given its
 * own kind in the Ledger Explorer. Clock-free — `author`/`timestamp` come from
 * the host.
 */
export const AGENT_SIMULATION_SESSION_TYPE = 'AGENT_SIMULATION_SESSION';

/** A finished mock agent-simulation run, ready to record. */
export interface AgentSimulationSession {
  /** The sub-workflow's versioned ref, e.g. `agnt-rsch@2.1.0`. */
  workflowRef: string;
  /** Number of trail steps the run produced. */
  steps: number;
  /** True when the run finished cleanly; false when it stopped on a block. */
  complete: boolean;
  /** The honest stop (node + reason), when the run blocked. */
  blocked?: { nodeId: string; reason: string };
  author: string;
  /** ISO-8601 timestamp, supplied by the host. */
  timestamp: string;
}

/**
 * Maps an {@link AgentSimulationSession} to an audit-ledger append input. The
 * sub-workflow ref (with version) is the `versionId`, and the bare id is the
 * `artifactId` so the Ledger Explorer's "filter by this artifact" works.
 */
export function agentSimulationSessionEntry(
  session: AgentSimulationSession,
  actor?: Pick<UserContext, 'id'>,
): AuditEntryInput {
  return {
    type: AGENT_SIMULATION_SESSION_TYPE,
    userId: actor?.id ?? session.author,
    versionId: session.workflowRef,
    details: {
      artifactId: session.workflowRef.split('@')[0],
      workflowRef: session.workflowRef,
      steps: session.steps,
      complete: session.complete,
      ...(session.blocked
        ? { blockedNode: session.blocked.nodeId, blockedReason: session.blocked.reason }
        : {}),
    },
  };
}
