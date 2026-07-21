import { AdapterError } from './errors.js';
import type { AgentRef, ResolveTool, ToolContract } from '@buildtovalue/agentflow';
import type {
  ArtifactAdapter,
  ArtifactDetail,
  ArtifactSummary,
  VersionEntry,
} from '@buildtovalue/library';

/**
 * Squad Lane SL-2 (Handoff 22) — TOOL contracts surfaced in the Biblioteca as
 * "mais um adapter" (Handoff 6 §1), type "FERRAMENTA". A `ToolContract` is a
 * plain JSON artifact (not a BPMN diagram), so this mirrors the non-diagram
 * `copilotPromptAdapter`/`lintProfileAdapter` mold: it reads the SAME injected
 * `ToolContract[]` the react `ToolProvider` resolves against, so the catalog and
 * the binding can never disagree about what a `tool:*@semver` ref means (one
 * registry, never a parallel truth — cerca §2.2).
 */

const WRENCH_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" role="img" aria-hidden="true">' +
  '<path d="M 58 22 a 12 12 0 1 0 12 12 l 8 8 6 -6 -8 -8 a 12 12 0 0 0 -18 -8 l 8 8 -6 6 -8 -8 a 12 12 0 0 0 2 4 Z" ' +
  'fill="none" stroke="#2f6e94" stroke-width="1.6"/></svg>';

/** Numeric major.minor.patch compare (refs are normalized to full versions). */
function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number(n) || 0);
  const pb = b.split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

/**
 * Builds a headless {@link ResolveTool} over a contract list — the seam the
 * react `ToolProvider` and `validateGraph({ resolveTool })` share. Exact
 * `id@version` match; an unknown ref resolves to `undefined` (declared
 * degradation upstream, never silent — cerca §2.4).
 */
export function resolveToolContract(contracts: readonly ToolContract[]): ResolveTool {
  return (ref: AgentRef): ToolContract | undefined =>
    contracts.find((c) => c.id === ref.id && c.version === ref.version);
}

/**
 * A Biblioteca adapter over an injected `ToolContract[]`. One artifact per tool
 * id (versions grouped, newest as the representative); read-only, like the other
 * JSON-artifact adapters. `authorization`/`effect` travel in `meta` so the
 * catalog card shows the governance posture at a glance.
 */
export function toolAdapter(contracts: readonly ToolContract[]): ArtifactAdapter {
  const versionsOf = (id: string): ToolContract[] =>
    contracts.filter((c) => c.id === id).sort((a, b) => compareVersion(b.version, a.version));
  const ids = [...new Set(contracts.map((c) => c.id))];

  function toSummary(c: ToolContract): ArtifactSummary {
    return {
      ref: { adapterId: 'tool', artifactId: c.id },
      name: c.name,
      typeLabel: 'FERRAMENTA',
      version: c.version,
      status: 'active',
      meta: `${c.capability} · efeito ${c.effect} · ${c.authorization}`,
      thumbnail: { kind: 'svg', svg: WRENCH_SVG },
    };
  }

  return {
    id: 'tool',
    typeLabel: 'FERRAMENTA',
    async list() {
      return ids.map((id) => toSummary(versionsOf(id)[0]));
    },
    async get(artifactId) {
      const versions = versionsOf(artifactId);
      if (versions.length === 0) {
        throw new AdapterError(`adapter "tool": unknown tool "${artifactId}"`);
      }
      const latest = versions[0];
      const versionEntries: VersionEntry[] = versions.map((c) => ({
        version: c.version,
        status: 'active',
        note: c.capability,
      }));
      const detail: ArtifactDetail = {
        ...toSummary(latest),
        changeSummary:
          `Contrato de ferramenta versionado: capacidade "${latest.capability}", ` +
          `efeito ${latest.effect}, autorização ${latest.authorization}. A mesma lista ` +
          `alimenta o catálogo e o ToolProvider do inspector (uma fonte, nunca duas).`,
        versions: versionEntries,
        actions: [],
      };
      return detail;
    },
  };
}
