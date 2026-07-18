import { AdapterError } from './errors.js';
import type {
  ArtifactAdapter,
  ArtifactDetail,
  ArtifactSummary,
  LifecycleStatus,
} from '@buildtovalue/library';

/**
 * Handoff 16 E-3 (§3b) — governed event definitions as Biblioteca artifacts,
 * mirroring the lintProfileAdapter pattern: each named definition is a
 * versioned artifact whose ACTIVE version is the "vigente" one the editor's
 * seal reports. Read-only by design: changing a definition is promoting a new
 * version — the editor's pinned `nome@semver` bindings never move on their
 * own (pin semantics), only an explicit, audited re-bind does.
 */

/** One governed definition version as the host's catalog records it. */
export interface GovernedEventDefinitionRecord {
  kind: 'message' | 'signal' | 'error';
  /** Artifact name — the `nome` half of the pinned `nome@semver` binding. */
  name: string;
  semanticVersion: string;
  status: LifecycleStatus;
  /** The payload mirrored into diagrams on bind. */
  definition: { name: string; errorCode?: string };
}

const KIND_LABELS: Record<GovernedEventDefinitionRecord['kind'], string> = {
  message: 'mensagem',
  signal: 'sinal',
  error: 'erro',
};

const ENVELOPE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" role="img" aria-hidden="true">' +
  '<rect x="24" y="20" width="48" height="32" rx="4" fill="none" stroke="#33567E" stroke-width="1.5"/>' +
  '<path d="M 24 24 L 48 40 L 72 24" fill="none" stroke="#33567E" stroke-width="1.5"/>' +
  '</svg>';

/** Sort helper: newest semver first by plain numeric segments. */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Read-only catalog adapter: one card per definition NAME, its version
 * timeline in the drawer. `artifactId` is the name; the editor's picker lists
 * the same records through the injected `EventDefinitionResolver` — one
 * catalog, never a parallel truth.
 */
export function eventDefinitionCatalogAdapter(
  records: readonly GovernedEventDefinitionRecord[],
): ArtifactAdapter {
  const byName = new Map<string, GovernedEventDefinitionRecord[]>();
  for (const record of records) {
    const group = byName.get(record.name) ?? [];
    group.push(record);
    byName.set(record.name, group);
  }
  for (const group of byName.values()) {
    group.sort((a, b) => compareSemver(a.semanticVersion, b.semanticVersion));
  }

  function toSummary(name: string, group: GovernedEventDefinitionRecord[]): ArtifactSummary {
    const relevant = group.find((record) => record.status === 'active') ?? group[0];
    return {
      ref: { adapterId: 'event-definition', artifactId: name },
      name,
      typeLabel: 'DEFINIÇÃO DE EVENTO',
      version: relevant.semanticVersion,
      status: relevant.status,
      meta: `${KIND_LABELS[relevant.kind]} · ${group.length} versão(ões)`,
      thumbnail: { kind: 'svg', svg: ENVELOPE_SVG },
    };
  }

  return {
    id: 'event-definition',
    typeLabel: 'DEFINIÇÃO DE EVENTO',
    async list() {
      return [...byName.entries()].map(([name, group]) => toSummary(name, group));
    },
    async get(artifactId) {
      const group = byName.get(artifactId);
      if (!group) {
        throw new AdapterError(`adapter "event-definition": unknown definition "${artifactId}"`);
      }
      const detail: ArtifactDetail = {
        ...toSummary(artifactId, group),
        changeSummary:
          'Definição governada de evento (Handoff 16 §3b): editores vinculam por ' +
          'nome@semver FIXO. Promover uma versão nova NUNCA move os vínculos ' +
          'existentes — só a troca explícita de ref (auditada no ledger).',
        versions: group.map((record) => ({
          version: record.semanticVersion,
          status: record.status,
          note: record.definition.errorCode
            ? `${record.definition.name} (código ${record.definition.errorCode})`
            : record.definition.name,
        })),
        actions: [],
      };
      return detail;
    },
  };
}
