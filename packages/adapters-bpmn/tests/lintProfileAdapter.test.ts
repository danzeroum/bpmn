import { describe, expect, it } from 'vitest';
import { LINT_PROFILES } from '@buildtovalue/lint';
import { AdapterError } from '../src/errors.js';
import { activeLintProfileVersion, lintProfileAdapter } from '../src/index.js';

/**
 * Handoff 14 §1d: lint profiles ("políticas de modelagem") in the Biblioteca
 * as versioned, promotable artifacts with the selo VIGENTE — same pattern as
 * the copilot prompt templates (CP-5). The adapter and the lint panel header
 * read the SAME canonical LINT_PROFILES registry, so they can never disagree.
 */
describe('lintProfileAdapter (§1d)', () => {
  const adapter = lintProfileAdapter();

  it('lists one ACTIVE artifact per shipped profile (anti-drift vs LINT_PROFILES)', async () => {
    const summaries = await adapter.list({});
    expect(summaries).toHaveLength(LINT_PROFILES.length);
    for (const [index, profile] of LINT_PROFILES.entries()) {
      expect(summaries[index].ref).toEqual({ adapterId: 'lint-profile', artifactId: profile.id });
      expect(summaries[index].typeLabel).toBe('POLÍTICA DE LINT');
      expect(summaries[index].version).toBe(profile.version);
      expect(summaries[index].status).toBe('active');
    }
  });

  it('the engine profile is listed on the SAME adapter as etiquette (one surface)', async () => {
    const summaries = await adapter.list({});
    expect(summaries.map((s) => s.ref.artifactId)).toEqual(['lint-etiquette', 'lint-engine']);
    expect(summaries[0].meta).toContain('etiqueta');
    expect(summaries[1].meta).toContain('engine');
  });

  it('detail carries the version timeline and the promotable explanation', async () => {
    const detail = await adapter.get('lint-etiquette');
    expect(detail.versions).toEqual([
      { version: '1.0.0', status: 'active', note: 'Versão embarcada no @buildtovalue/lint.' },
    ]);
    expect(detail.changeSummary).toContain('nova versão promovível');
    expect(detail.actions).toEqual([]); // read-only: nothing mutating
  });

  it('unknown profile id → AdapterError with a readable message', async () => {
    await expect(adapter.get('lint-ghost')).rejects.toThrow(AdapterError);
    await expect(adapter.get('lint-ghost')).rejects.toThrow(/unknown profile "lint-ghost"/);
  });

  it('activeLintProfileVersion resolves from the SAME registry (header seam)', () => {
    for (const profile of LINT_PROFILES) {
      expect(activeLintProfileVersion(profile.id)).toBe(profile.version);
    }
    expect(activeLintProfileVersion('lint-ghost')).toBeUndefined();
  });
});
