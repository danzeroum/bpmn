import { AdapterError } from './errors.js';
import type { EvalSet } from '@buildtovalue/agentflow';
import type {
  ArtifactAdapter,
  ArtifactDetail,
  ArtifactSummary,
  VersionEntry,
} from '@buildtovalue/library';

/**
 * Squad Lane SL-7 — EVAL sets surfaced in the Biblioteca as "mais um adapter"
 * (type "AVALIAÇÃO"), mirroring the SL-2 `toolContractAdapter` mold: a plain
 * JSON artifact (not a diagram), one artifact per id (versions grouped), the
 * target + threshold + case count in `meta`, read-only. Same injected list the
 * eval runner and the promotion gate consume — one registry, never two.
 */

const CHECK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" role="img" aria-hidden="true">' +
  '<path d="M 30 38 L 44 52 L 68 22" fill="none" stroke="#1a6a54" stroke-width="2.4" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number(n) || 0);
  const pb = b.split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

/** A Biblioteca adapter over an injected `EvalSet[]`. */
export function evalSetAdapter(evalSets: readonly EvalSet[]): ArtifactAdapter {
  const versionsOf = (id: string): EvalSet[] =>
    evalSets.filter((e) => e.id === id).sort((a, b) => compareVersion(b.version, a.version));
  const ids = [...new Set(evalSets.map((e) => e.id))];

  function toSummary(evalSet: EvalSet): ArtifactSummary {
    const threshold = Math.round(evalSet.promotionThreshold * 100);
    return {
      ref: { adapterId: 'eval', artifactId: evalSet.id },
      name: evalSet.id,
      typeLabel: 'AVALIAÇÃO',
      version: evalSet.version,
      status: 'active',
      meta: `alvo ${evalSet.targetRef} · ${evalSet.cases.length} caso(s) · limiar ${threshold}%`,
      thumbnail: { kind: 'svg', svg: CHECK_SVG },
    };
  }

  return {
    id: 'eval',
    typeLabel: 'AVALIAÇÃO',
    async list() {
      return ids.map((id) => toSummary(versionsOf(id)[0]));
    },
    async get(artifactId) {
      const versions = versionsOf(artifactId);
      if (versions.length === 0) {
        throw new AdapterError(`adapter "eval": unknown eval set "${artifactId}"`);
      }
      const latest = versions[0];
      const versionEntries: VersionEntry[] = versions.map((e) => ({
        version: e.version,
        status: 'active',
        note: `${e.cases.length} caso(s)`,
      }));
      const detail: ArtifactDetail = {
        ...toSummary(latest),
        changeSummary:
          `Conjunto de avaliação versionado do alvo ${latest.targetRef}: ` +
          `${latest.cases.length} caso(s), limiar de promoção ${Math.round(latest.promotionThreshold * 100)}%. ` +
          `Asserções só regex/contains/schema — nunca código.`,
        versions: versionEntries,
        actions: [],
      };
      return detail;
    },
  };
}
