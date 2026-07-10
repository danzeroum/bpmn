import { COPILOT_PROMPTS, type CopilotPromptTemplate } from '@buildtovalue/copilot';
import type { ArtifactAdapter, ArtifactDetail, ArtifactSummary } from '@buildtovalue/library';

/**
 * CP-5 (Handoff 9, cerca §1.5 — dogfooding): the copilot's own prompt
 * templates surfaced in the Biblioteca as "mais um adapter" — type
 * "PROMPT DO COPILOTO", one artifact per capability, the SHIPPED version of
 * each template being by definition the ACTIVE one. Changing a prompt is a
 * new promotable version, governed like any other artifact. Read-only: the
 * adapter only reads the canonical `COPILOT_PROMPTS` registry (the same
 * source the panel header shows), so the Biblioteca and the panel can never
 * disagree about what is active.
 */

/** pt-BR capability names, keyed by template id (§4 C1..C6). */
const CAPABILITY_NAMES: Record<string, string> = {
  'copilot-draft': 'Rascunho do processo (C1)',
  'copilot-adjust': 'Ajuste conversacional (C2)',
  'copilot-explain': 'Explicar processo (C3)',
  'copilot-summary': 'Resumo de mudança (C4)',
  'copilot-fix': 'Fix de soundness (C5)',
  'copilot-query': 'Consulta ao ledger (C6)',
};

const SPARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" role="img" aria-hidden="true">' +
  '<path d="M 48 14 L 53 31 L 70 36 L 53 41 L 48 58 L 43 41 L 26 36 L 43 31 Z" fill="none" stroke="#33567E" stroke-width="1.5"/>' +
  '<path d="M 70 16 L 72 22 L 78 24 L 72 26 L 70 32 L 68 26 L 62 24 L 68 22 Z" fill="#33567E"/>' +
  '</svg>';

/**
 * The active (= shipped) version of a copilot template, or undefined for an
 * unknown id. The panel header uses this through host injection to append
 * "ativa" — the SAME registry the Biblioteca lists, never a parallel truth.
 */
export function activeCopilotPromptVersion(templateId: string): string | undefined {
  return COPILOT_PROMPTS.find((template) => template.id === templateId)?.version;
}

export function copilotPromptAdapter(): ArtifactAdapter {
  function toSummary(template: CopilotPromptTemplate): ArtifactSummary {
    return {
      ref: { adapterId: 'copilot-prompt', artifactId: template.id },
      name: CAPABILITY_NAMES[template.id] ?? template.id,
      typeLabel: 'PROMPT DO COPILOTO',
      version: template.version,
      status: 'active',
      meta: `template ${template.id} · autoria de IA gravada como ia.copilot@<modelo> + este template`,
      thumbnail: { kind: 'svg', svg: SPARK_SVG },
    };
  }

  return {
    id: 'copilot-prompt',
    typeLabel: 'PROMPT DO COPILOTO',
    async list() {
      return COPILOT_PROMPTS.map(toSummary);
    },
    async get(artifactId) {
      const template = COPILOT_PROMPTS.find((t) => t.id === artifactId);
      if (!template) {
        throw new Error(`adapter "copilot-prompt": unknown template "${artifactId}"`);
      }
      const detail: ArtifactDetail = {
        ...toSummary(template),
        changeSummary:
          'Template versionado do copiloto (cerca §1.5): mudar o prompt = nova versão ' +
          'promovível. A versão embarcada é a ativa — o header do painel e esta ficha ' +
          'leem o MESMO registro.',
        versions: [
          {
            version: template.version,
            status: 'active',
            note: 'Versão embarcada no @buildtovalue/copilot.',
          },
        ],
        actions: [],
      };
      return detail;
    },
  };
}
