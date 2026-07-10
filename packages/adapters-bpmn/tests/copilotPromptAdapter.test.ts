import { describe, expect, it } from 'vitest';
import { COPILOT_PROMPTS } from '@buildtovalue/copilot';
import { activeCopilotPromptVersion, copilotPromptAdapter } from '../src/index.js';

/**
 * CP-5 (Handoff 9, cerca §1.5 — dogfooding): the copilot templates in the
 * Biblioteca as "PROMPT DO COPILOTO", one artifact per capability, shipped
 * version = active. The adapter and the panel header read the SAME canonical
 * registry, so they can never disagree.
 */
describe('copilotPromptAdapter (CP-5)', () => {
  const adapter = copilotPromptAdapter();

  it('lists one ACTIVE artifact per registered template (anti-drift vs COPILOT_PROMPTS)', async () => {
    const summaries = await adapter.list({});
    expect(summaries).toHaveLength(COPILOT_PROMPTS.length);
    for (const [index, template] of COPILOT_PROMPTS.entries()) {
      expect(summaries[index].ref).toEqual({ adapterId: 'copilot-prompt', artifactId: template.id });
      expect(summaries[index].typeLabel).toBe('PROMPT DO COPILOTO');
      expect(summaries[index].version).toBe(template.version);
      expect(summaries[index].status).toBe('active');
    }
  });

  it('capabilities are named in pt-BR (C1..C6)', async () => {
    const summaries = await adapter.list({});
    expect(summaries.map((s) => s.name)).toEqual([
      'Rascunho do processo (C1)',
      'Ajuste conversacional (C2)',
      'Explicar processo (C3)',
      'Resumo de mudança (C4)',
      'Fix de soundness (C5)',
      'Consulta ao ledger (C6)',
    ]);
  });

  it('detail carries the version timeline and the §1.5 explanation', async () => {
    const detail = await adapter.get('copilot-draft');
    expect(detail.versions).toEqual([
      { version: '1.0.0', status: 'active', note: 'Versão embarcada no @buildtovalue/copilot.' },
    ]);
    expect(detail.changeSummary).toContain('nova versão promovível');
    expect(detail.actions).toEqual([]); // read-only: nothing mutating
  });

  it('unknown template id → readable error', async () => {
    await expect(adapter.get('copilot-ghost')).rejects.toThrow(/unknown template "copilot-ghost"/);
  });

  it('activeCopilotPromptVersion resolves from the SAME registry (header seam)', () => {
    for (const template of COPILOT_PROMPTS) {
      expect(activeCopilotPromptVersion(template.id)).toBe(template.version);
    }
    expect(activeCopilotPromptVersion('copilot-ghost')).toBeUndefined();
  });
});
