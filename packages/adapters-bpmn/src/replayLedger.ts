import type { AuditEntry, AuditEntryInput, UserContext } from '@buildtovalue/core';
import type { ReplayAnalysis } from '@buildtovalue/replay';

/**
 * Host adapters connecting a headless replay {@link ReplayAnalysis} to
 * governance (Handoff 7B-3): mapping the comparative analysis into an audit
 * entry when it is attached to a promotion request, and reading it back for the
 * Approver Review block. INJECTION glue — the `replay` package never imports
 * `audit`/`core` ledger types. Degradable: a version with no attached analysis
 * reads back as `undefined`.
 */

/** Ledger entry type for a replay analysis attached to a promotion request. */
export const REPLAY_ANALYSIS_TYPE = 'REPLAY_ANALYSIS_ATTACHED';

/**
 * Maps a replay analysis to an audit-ledger append input. `versionId` defaults
 * to the analyzed version but is usually overridden with the *candidate*
 * version id (`attachTo`), so the Approver Review of that candidate finds it.
 * `details.artifactId` keeps the Ledger Explorer's "filter by artifact" working.
 */
export function replayAnalysisEntry(
  analysis: ReplayAnalysis,
  actor?: Pick<UserContext, 'id'>,
  attachTo?: string,
): AuditEntryInput {
  return {
    type: REPLAY_ANALYSIS_TYPE,
    userId: actor?.id ?? analysis.author,
    versionId: attachTo ?? analysis.versionId,
    details: {
      artifactId: analysis.diagramId,
      analyzedVersion: analysis.semanticVersion,
      headline: analysis.headline,
      fitness: analysis.fitness,
      totalCases: analysis.totalCases,
      ...(analysis.bottleneck
        ? { bottleneck: analysis.bottleneck.label, bottleneckMs: analysis.bottleneck.avgMs }
        : {}),
      ...(analysis.topDeviation
        ? { deviation: analysis.topDeviation.label, deviationCases: analysis.topDeviation.cases }
        : {}),
      ...(analysis.candidateSemanticVersion
        ? { candidateVersion: analysis.candidateSemanticVersion }
        : {}),
    },
  };
}

/** A replay analysis read back from the chain for the Approver Review block. */
export interface AttachedReplayAnalysis {
  headline: string;
  fitness: number;
  totalCases: number;
  analyzedVersion: string;
  bottleneck?: string;
  deviation?: string;
  deviationCases?: number;
  author: string;
  timestamp: string;
}

/**
 * Reads the most recent replay analysis attached to a version from the ledger
 * — the block the Approver Review renders. Returns `undefined` when none is
 * attached (so the review degrades gracefully). Entries are chronological, so
 * the last match wins.
 */
export function latestReplayAnalysis(
  entries: readonly AuditEntry[],
  versionId: string,
): AttachedReplayAnalysis | undefined {
  let latest: AuditEntry | undefined;
  for (const entry of entries) {
    if (entry.type === REPLAY_ANALYSIS_TYPE && entry.versionId === versionId) latest = entry;
  }
  if (!latest) return undefined;
  const d = latest.details;
  return {
    headline: String(d.headline ?? ''),
    fitness: Number(d.fitness) || 0,
    totalCases: Number(d.totalCases) || 0,
    analyzedVersion: String(d.analyzedVersion ?? ''),
    ...(d.bottleneck !== undefined ? { bottleneck: String(d.bottleneck) } : {}),
    ...(d.deviation !== undefined
      ? { deviation: String(d.deviation), deviationCases: Number(d.deviationCases) || 0 }
      : {}),
    author: latest.userId,
    timestamp: latest.timestamp,
  };
}
