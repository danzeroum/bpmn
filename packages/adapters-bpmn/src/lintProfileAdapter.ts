import { AdapterError } from './errors.js';
import { LINT_PROFILES, type LintProfile } from '@buildtovalue/lint';
import type { ArtifactAdapter, ArtifactDetail, ArtifactSummary } from '@buildtovalue/library';

/**
 * Handoff 14 §1d — lint profiles as Biblioteca artifacts, mirroring the
 * copilotPromptAdapter pattern (Handoff 9 CP-5): each profile ("política de
 * modelagem") is a versioned, promotable artifact whose SHIPPED version is by
 * definition the ACTIVE one. The lint panel header shows the very same
 * `id@version` this adapter lists — one registry, never a parallel truth.
 * Read-only: changing a rule set is a new promotable version.
 */

const CHECK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" role="img" aria-hidden="true">' +
  '<rect x="22" y="14" width="52" height="44" rx="6" fill="none" stroke="#33567E" stroke-width="1.5"/>' +
  '<path d="M 32 36 L 43 47 L 64 26" fill="none" stroke="#33567E" stroke-width="2.5" stroke-linecap="round"/>' +
  '</svg>';

/**
 * The active (= shipped) version of a lint profile, or undefined for an
 * unknown id. The panel header appends "VIGENTE" through this — the SAME
 * registry the Biblioteca lists.
 */
export function activeLintProfileVersion(profileId: string): string | undefined {
  return LINT_PROFILES.find((profile) => profile.id === profileId)?.version;
}

export function lintProfileAdapter(): ArtifactAdapter {
  function toSummary(profile: LintProfile): ArtifactSummary {
    const fixable = profile.rules.filter((rule) => rule.fix !== undefined).length;
    return {
      ref: { adapterId: 'lint-profile', artifactId: profile.id },
      name: profile.name,
      typeLabel: 'POLÍTICA DE LINT',
      version: profile.version,
      status: 'active',
      meta:
        `${profile.rules.length} regras (${profile.source === 'etiquette' ? 'etiqueta' : 'engine'})` +
        ` · ${fixable} com quick-fix mecânico`,
      thumbnail: { kind: 'svg', svg: CHECK_SVG },
    };
  }

  return {
    id: 'lint-profile',
    typeLabel: 'POLÍTICA DE LINT',
    async list() {
      return LINT_PROFILES.map(toSummary);
    },
    async get(artifactId) {
      const profile = LINT_PROFILES.find((p) => p.id === artifactId);
      if (!profile) {
        throw new AdapterError(`adapter "lint-profile": unknown profile "${artifactId}"`);
      }
      const detail: ArtifactDetail = {
        ...toSummary(profile),
        changeSummary:
          'Perfil de lint versionado (Handoff 14 §1d): mudar o conjunto de regras = nova ' +
          'versão promovível. A versão embarcada é a vigente — o painel de problemas e ' +
          'esta ficha leem o MESMO registro.',
        versions: [
          {
            version: profile.version,
            status: 'active',
            note: 'Versão embarcada no @buildtovalue/lint.',
          },
        ],
        actions: [],
      };
      return detail;
    },
  };
}
