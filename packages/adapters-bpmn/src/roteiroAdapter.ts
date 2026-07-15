import { AdapterError } from './errors.js';
import type {
  ArtifactAdapter,
  ArtifactDetail,
  ArtifactSummary,
  LifecycleStatus,
} from '@buildtovalue/library';
import { coveragePercent, type SimulationSession } from '@buildtovalue/simulation';

/**
 * A recorded simulation session offered to the Biblioteca as a versioned
 * "ROTEIRO" artifact (Handoff 7A §3). The host holds the sessions (from
 * `onRecord`) and exposes them through this adapter — the `simulation` package
 * stays headless and library-agnostic; this is pure host injection (§2).
 */
export interface RoteiroRecord {
  session: SimulationSession;
  /** Display name; defaults to a derived label. */
  name?: string;
  /** Lifecycle status for library sorting/filtering; defaults to `active`. */
  status?: LifecycleStatus;
  /** Ledger hash of the registration, when the host has it (provenance). */
  ledgerHash?: string;
}

export interface RoteiroAdapter extends ArtifactAdapter {
  /** Fires subscribers when the underlying session list changes. */
  notifyChanged(): void;
}

const TOKEN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" role="img" aria-hidden="true">' +
  '<path d="M 12 40 H 40 M 56 40 H 84" fill="none" stroke="#44403a" stroke-width="1.5"/>' +
  '<circle cx="48" cy="40" r="11" fill="#9a7b1e" stroke="#ffffff" stroke-width="2.5"/>' +
  '<circle cx="48" cy="40" r="15" fill="none" stroke="#9a7b1e" stroke-opacity="0.35" stroke-width="2.5"/>' +
  '</svg>';

/**
 * Builds a ROTEIRO adapter over a live list of recorded sessions. Pass a getter
 * so the catalog reflects registrations as they happen; call `notifyChanged`
 * after the list grows. Mirrors `recipeAdapter` (self-contained, imports only
 * from `@buildtovalue/library` + the neutral session type).
 */
export function createRoteiroAdapter(source: () => RoteiroRecord[]): RoteiroAdapter {
  const listeners = new Set<() => void>();

  const label = (session: SimulationSession) =>
    `${session.coverage.covered}/${session.coverage.total} caminhos`;

  function toSummary(record: RoteiroRecord): ArtifactSummary {
    const { session } = record;
    return {
      ref: { adapterId: 'roteiro', artifactId: session.scenarioHash },
      name: record.name ?? `Roteiro ${session.semanticVersion} · ${label(session)}`,
      typeLabel: 'ROTEIRO',
      version: session.semanticVersion,
      status: record.status ?? 'active',
      meta: `${label(session)} (${coveragePercent(session.coverage)}%) · ${session.author}`,
      thumbnail: { kind: 'svg', svg: TOKEN_SVG },
      updatedAt: session.timestamp,
    };
  }

  /** Dedupe by roteiro hash (first wins) — the hash identifies the roteiro. */
  function records(): RoteiroRecord[] {
    const seen = new Set<string>();
    const out: RoteiroRecord[] = [];
    for (const record of source()) {
      const id = record.session.scenarioHash;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(record);
    }
    return out;
  }

  return {
    id: 'roteiro',
    typeLabel: 'ROTEIRO',
    async list() {
      return records().map(toSummary);
    },
    async get(artifactId) {
      const record = records().find((r) => r.session.scenarioHash === artifactId);
      if (!record) throw new AdapterError(`adapter "roteiro": unknown roteiro "${artifactId}"`);
      const { session } = record;
      const detail: ArtifactDetail = {
        ...toSummary(record),
        changeSummary: `Roteiro determinístico · ${session.scenario.decisions.length} decisão(ões) · roteiro #${session.scenarioHash}`,
        ...(record.ledgerHash
          ? {
              provenance: {
                ledgerHash: record.ledgerHash,
                author: session.author,
                createdAt: session.timestamp,
              },
            }
          : {}),
        versions: [
          {
            version: session.semanticVersion,
            status: record.status ?? 'active',
            timestamp: session.timestamp,
            note: `${label(session)} · roteiro #${session.scenarioHash}`,
          },
        ],
        actions: [
          {
            id: 'replay-roteiro',
            label: 'Reproduzir no simulador',
            kind: 'navigate',
            payload: {
              diagramId: session.diagramId,
              versionId: session.versionId,
              scenarioHash: session.scenarioHash,
            },
          },
        ],
      };
      return detail;
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    notifyChanged() {
      for (const cb of listeners) cb();
    },
  };
}
