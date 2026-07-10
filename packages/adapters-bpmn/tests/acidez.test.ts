import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createLibraryCatalog } from '@buildtovalue/library';
import { createRecipeAdapter } from '../src/index.js';

/**
 * Handoff 6 acceptance criterion §10.1 — THE acid test of the generic
 * architecture: the whole library must work with an adapter that has no
 * relation to BPMN whatsoever ("recipe"), without a single line changed in
 * library. This suite runs the catalog ONLY with the fake adapter and
 * exercises the entire headless surface (S-3 extends it to the React UI).
 * A failure here is an architecture bug, never an acceptable exception.
 */

describe('acid test §10.1 — the library works with the recipe adapter alone', () => {
  it('the fixture itself knows nothing about BPMN (imports only the library)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, '..', 'src', 'recipeAdapter.ts'), 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      expect(match[1], `recipeAdapter imports "${match[1]}"`).toBe('@buildtovalue/library');
    }
    // apart from comments and the library import specifier, no BPMN
    // vocabulary leaks into the fixture's code
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replaceAll('@buildtovalue/library', '');
    expect(code).not.toMatch(/bpmn|diagram|registry/i);
  });

  it('lists, counts and dynamic type chip work end-to-end', async () => {
    const catalog = createLibraryCatalog([createRecipeAdapter()]);
    const { items, counts } = await catalog.list();
    expect(items).toHaveLength(6);
    expect(counts.byAdapter).toEqual({ recipe: 6 });
    // every lifecycle state is represented — the status chips all have data
    expect(counts.byStatus).toEqual({
      draft: 1,
      test: 1,
      candidate: 1,
      active: 1,
      deprecated: 1,
      retired: 1,
    });
    expect(items.every((i) => i.typeLabel === 'RECEITA')).toBe(true);
    expect(items.every((i) => i.thumbnail?.kind === 'svg')).toBe(true);
  });

  it('search, status filter and sort behave like any other artifact', async () => {
    const catalog = createLibraryCatalog([createRecipeAdapter()]);
    const searched = await catalog.list({ text: 'queijo' });
    expect(searched.items.map((i) => i.ref.artifactId)).toEqual(['pao-queijo']);
    const byMeta = await catalog.list({ text: 'porções' });
    expect(byMeta.items).toHaveLength(6);
    const filtered = await catalog.list({ statuses: ['candidate', 'active'] });
    expect(filtered.items.map((i) => i.ref.artifactId).sort()).toEqual(['bolo-fuba', 'pao-queijo']);
    const updated = await catalog.list({ sort: 'updated' });
    expect(updated.items[0].ref.artifactId).toBe('moqueca'); // newest first
  });

  it('drawer data: detail with version timeline and action descriptors', async () => {
    const catalog = createLibraryCatalog([createRecipeAdapter()]);
    const detail = await catalog.get({ adapterId: 'recipe', artifactId: 'bolo-fuba' });
    expect(detail.changeSummary).toMatch(/açúcar/);
    expect(detail.versions.map((v) => v.version)).toEqual(['2.1.0', '2.0.0', '1.0.0']);
    expect(detail.versions[0].status).toBe('active');
    expect(detail.actions.map((a) => a.kind)).toEqual(['navigate', 'download']);
    // optional registry-ish sections simply don't exist — no "N/A"
    expect(detail.provenance).toBeUndefined();
    expect(detail.approvers).toBeUndefined();
    expect(detail.effectiveFrom).toBeUndefined();
  });

  it('invalidation flows through the catalog subscription', async () => {
    const adapter = createRecipeAdapter();
    const catalog = createLibraryCatalog([adapter]);
    const listener = vi.fn();
    const unsubscribe = catalog.subscribe(listener);
    adapter.notifyChanged();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    adapter.notifyChanged();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unknown recipes fail cleanly through the catalog routing', async () => {
    const catalog = createLibraryCatalog([createRecipeAdapter()]);
    await expect(catalog.get({ adapterId: 'recipe', artifactId: 'feijoada' })).rejects.toThrow(
      /unknown recipe "feijoada"/,
    );
  });
});
