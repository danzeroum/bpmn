import {
  simulateSquad,
  type AgentRef,
  type AgentWorkflow,
  type ContextContract,
  type Fixtures,
  type SquadManifest,
  type SquadSimResult,
} from '@buildtovalue/agentflow';
import type { ComputeJob } from '../workers/executor.js';

/**
 * Squad Lane SL-10 — the squad run as an F7 compute job, so it executes with the
 * SAME agentflow engine off the main thread (or in-thread via the SyncExecutor —
 * byte-identical, cerca N-8). A `resolveWorkflow` FUNCTION cannot cross a worker
 * boundary (like the router in `routeJob`), so the host passes a SERIALIZABLE map
 * of member workflows keyed by `id@version`; the job rebuilds the resolver inside
 * the worker. Masking uses the conservative redaction (a policy function cannot
 * cross the boundary either) — sensitive keys are never leaked.
 */
export interface SquadSimJobInput {
  manifest: SquadManifest;
  /** Member workflows keyed by `id@version` (e.g. `"agnt-rsch@2.1.0"`). */
  workflows: Record<string, AgentWorkflow>;
  fixturesByRole?: Record<string, Fixtures>;
  contract?: ContextContract;
  declaredEvidenceRoles?: readonly string[];
}

const keyOf = (ref: AgentRef): string => `${ref.id}@${ref.version}`;

/** Runs `simulateSquad` from serializable inputs (the resolver is rebuilt here). */
export const squadSimJob: ComputeJob<SquadSimJobInput, SquadSimResult> = ({
  manifest,
  workflows,
  fixturesByRole,
  contract,
  declaredEvidenceRoles,
}) =>
  simulateSquad(manifest, {
    resolveWorkflow: (ref) => workflows[keyOf(ref)],
    fixturesByRole,
    contract,
    declaredEvidenceRoles,
  });
