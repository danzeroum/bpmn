import type { CoverageSummary } from './coverage.js';
import type { Scenario } from './engine.js';
import { canonicalizeScenario, hashScenario } from './scenario.js';

/** The path-coverage a session recorded, in compact serializable form. */
export interface SessionCoverage {
  covered: number;
  total: number;
  /** Stable signatures of the exercised structural paths. */
  exercised: string[];
}

/**
 * A recorded simulation session — the serializable artifact the host registers
 * in the ledger and turns into SACM evidence (Handoff 7A §3.5): the roteiro
 * (scenario), the coverage it closed, the diagram version it ran on, and the
 * author/timestamp. Neutral JSON data — it never imports `audit`/`library`;
 * the host adapters map it into those systems by injection.
 */
export interface SimulationSession {
  diagramId: string;
  versionId: string;
  semanticVersion: string;
  scenario: Scenario;
  /** Short content hash of the scenario ("roteiro #hash"). */
  scenarioHash: string;
  coverage: SessionCoverage;
  author: string;
  /** ISO-8601 timestamp, supplied by the host — the package never reads a clock. */
  timestamp: string;
}

/**
 * Builds a {@link SimulationSession} from a scenario and the coverage summary
 * at the moment of registration. `author`/`timestamp` come from the host so the
 * package stays deterministic and clock-free.
 */
export async function buildSession(
  scenario: Scenario,
  coverage: CoverageSummary,
  meta: { author: string; timestamp: string },
): Promise<SimulationSession> {
  return {
    diagramId: scenario.diagramId,
    versionId: scenario.versionId,
    semanticVersion: scenario.semanticVersion,
    scenario,
    scenarioHash: await hashScenario(scenario),
    coverage: {
      covered: coverage.covered,
      total: coverage.total,
      exercised: coverage.paths.filter((p) => p.covered).map((p) => p.id),
    },
    author: meta.author,
    timestamp: meta.timestamp,
  };
}

/** Canonical JSON for a session (stable key order) — for hashing / storage. */
export function canonicalizeSession(session: SimulationSession): string {
  return JSON.stringify({
    diagramId: session.diagramId,
    versionId: session.versionId,
    semanticVersion: session.semanticVersion,
    scenario: JSON.parse(canonicalizeScenario(session.scenario)),
    scenarioHash: session.scenarioHash,
    coverage: {
      covered: session.coverage.covered,
      total: session.coverage.total,
      exercised: [...session.coverage.exercised].sort(),
    },
    author: session.author,
    timestamp: session.timestamp,
  });
}

/** Coverage as a percentage 0–100 (0 when there are no structural paths). */
export function coveragePercent(coverage: SessionCoverage): number {
  return coverage.total > 0 ? Math.round((coverage.covered / coverage.total) * 100) : 0;
}
