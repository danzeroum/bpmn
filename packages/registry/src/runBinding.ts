import { generateId, nowIso } from '@bpmn-react/core';
import { RegistryError } from './errors.js';
import type { RegistryEntry, RunBinding } from './types.js';

export interface BindRunOptions {
  /** Caller-supplied run id; a UUID is generated when omitted. */
  runId?: string;
  /** Lane the run executes against (recorded for provenance). */
  channel?: string;
  environment?: string;
}

/**
 * Pins an execution to an exact version — the "commit hash of the deploy"
 * applied to a process. Returns an immutable record the host stores against
 * each run/delivery.
 *
 * A run is born pinned: the returned binding is a plain value derived from
 * the version's snapshot hash, so promoting or superseding the version later
 * never mutates a run already in flight. To move a run to a new version the
 * host must bind a *new* run.
 */
export function bindRun(entry: RegistryEntry, options: BindRunOptions = {}): RunBinding {
  if (!entry.snapshotHash) {
    throw new RegistryError('Cannot bind a run to a version without a snapshot hash');
  }
  return Object.freeze({
    runId: options.runId ?? generateId(),
    versionId: entry.version.id,
    semanticVersion: entry.version.semanticVersion,
    snapshotHash: entry.snapshotHash,
    ...(options.channel !== undefined ? { channel: options.channel } : {}),
    ...(options.environment !== undefined ? { environment: options.environment } : {}),
    boundAt: nowIso(),
  });
}

/**
 * Confirms a run's binding still matches the version it claims — detects a
 * snapshot that was tampered with or a hash that drifted. Pure comparison;
 * does not mutate the run.
 */
export function verifyRunBinding(binding: RunBinding, entry: RegistryEntry): boolean {
  return (
    binding.versionId === entry.version.id && binding.snapshotHash === entry.snapshotHash
  );
}
