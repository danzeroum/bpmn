import type {
  AuditEntry,
  AuditEntryInput,
  BpmnDiagram,
  PromotionRule,
  UserContext,
} from '@bpmn-react/core';
import type { SimulationSession } from '@bpmn-react/simulation';

/**
 * Host adapters connecting a headless simulation {@link SimulationSession} to
 * governance (Handoff 7A-3). Everything here is INJECTION glue: the
 * `simulation` package never imports `audit`/`core` ledger types, and this
 * module maps a session into an audit entry, reads coverage back out of the
 * ledger, and offers an OPTIONAL coverage promotion gate. All degradable.
 */

/**
 * Ledger entry type for a registered simulation session. Recognized by the
 * SACM generator (`@bpmn-react/audit` `buildAssuranceCase`, which matches
 * `/SIMULATION/`) and given its own kind in the Studio Ledger Explorer.
 */
export const SIMULATION_SESSION_TYPE = 'SIMULATION_SESSION';

/**
 * Maps a recorded session to an audit-ledger append input. `details.artifactId`
 * is included so the Ledger Explorer's "filter by this artifact" works, and the
 * coverage counts + roteiro hash are stored so the SACM evidence and the
 * coverage gate can read them straight from the chain — no side store.
 */
export function simulationSessionEntry(
  session: SimulationSession,
  actor?: Pick<UserContext, 'id'>,
): AuditEntryInput {
  return {
    type: SIMULATION_SESSION_TYPE,
    userId: actor?.id ?? session.author,
    versionId: session.versionId,
    details: {
      artifactId: session.diagramId,
      semanticVersion: session.semanticVersion,
      roteiroHash: session.scenarioHash,
      covered: session.coverage.covered,
      total: session.coverage.total,
      exercised: [...session.coverage.exercised],
    },
  };
}

/** Coverage counts a session recorded for a version. */
export interface RecordedCoverage {
  covered: number;
  total: number;
}

/**
 * Reads the best coverage a version has registered from the ledger — the
 * `SIMULATION_SESSION` entry for `versionId` with the highest exercised ratio.
 * Returns `undefined` when the version has no recorded session (so the gate can
 * degrade gracefully).
 */
export function latestSessionCoverage(
  entries: readonly AuditEntry[],
  versionId: string,
): RecordedCoverage | undefined {
  let best: RecordedCoverage | undefined;
  let bestRatio = -1;
  for (const entry of entries) {
    if (entry.type !== SIMULATION_SESSION_TYPE || entry.versionId !== versionId) continue;
    const covered = Number(entry.details.covered) || 0;
    const total = Number(entry.details.total) || 0;
    const ratio = total > 0 ? covered / total : 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = { covered, total };
    }
  }
  return best;
}

export interface CoveragePromotionOptions {
  /** Minimum exercised fraction 0–1 required to activate (e.g. 0.8). */
  minCoverage: number;
  /** Injected coverage lookup for a diagram — usually {@link latestSessionCoverage}. */
  coverageFor: (diagram: BpmnDiagram) => RecordedCoverage | undefined;
  locale?: 'pt' | 'en';
}

/**
 * OPTIONAL promotion gate (Handoff 7A §3, cerca §9): require a minimum
 * registered path coverage before a version may become `active`. **OFF by
 * default** — the engine's `promotionRules` is empty unless the host adds this.
 * Degrades gracefully: a version with no recorded coverage is never blocked
 * (the gate only bites once coverage exists and falls short).
 */
export function coveragePromotionRule(options: CoveragePromotionOptions): PromotionRule {
  const { minCoverage, coverageFor, locale = 'pt' } = options;
  return ({ diagram, target }) => {
    if (target !== 'active') return { allowed: true };
    const coverage = coverageFor(diagram);
    if (!coverage || coverage.total === 0) return { allowed: true };
    const ratio = coverage.covered / coverage.total;
    if (ratio >= minCoverage) return { allowed: true };
    const pct = Math.round(minCoverage * 100);
    return {
      allowed: false,
      reason:
        locale === 'en'
          ? `Coverage ${coverage.covered}/${coverage.total} is below the required ${pct}% for this version`
          : `Cobertura ${coverage.covered}/${coverage.total} abaixo do mínimo de ${pct}% exigido para esta versão`,
    };
  };
}
