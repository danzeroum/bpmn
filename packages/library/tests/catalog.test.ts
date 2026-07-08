import { describe, expect, it, vi } from 'vitest';
import {
  createLibraryCatalog,
  type ArtifactAdapter,
  type ArtifactDetail,
  type ArtifactSummary,
  type LifecycleStatus,
} from '../src/index.js';

interface FakeItem {
  id: string;
  name: string;
  status: LifecycleStatus;
  meta?: string;
  updatedAt?: string;
}

/**
 * In-memory adapters with no relation to any concrete artifact type — the
 * library must work against these alone (generic by construction).
 */
function memoryAdapter(
  id: string,
  typeLabel: string,
  items: FakeItem[],
  overrides: Partial<ArtifactAdapter> = {},
): ArtifactAdapter {
  const summaries = (): ArtifactSummary[] =>
    items.map((item) => ({
      ref: { adapterId: id, artifactId: item.id },
      name: item.name,
      typeLabel,
      version: '1.0.0',
      status: item.status,
      ...(item.meta !== undefined ? { meta: item.meta } : {}),
      ...(item.updatedAt !== undefined ? { updatedAt: item.updatedAt } : {}),
    }));
  return {
    id,
    typeLabel,
    list: async () => summaries(),
    get: async (artifactId) => {
      const summary = summaries().find((s) => s.ref.artifactId === artifactId);
      if (!summary) throw new Error(`no artifact "${artifactId}"`);
      const detail: ArtifactDetail = {
        ...summary,
        versions: [{ version: summary.version, status: summary.status }],
        actions: [{ id: 'open', label: 'Abrir', kind: 'navigate' }],
      };
      return detail;
    },
    ...overrides,
  };
}

const recipes = memoryAdapter('recipe', 'RECEITA', [
  { id: 'r1', name: 'Bolo de fubá', status: 'active', meta: 'forno médio', updatedAt: '2026-07-01T10:00:00Z' },
  { id: 'r2', name: 'Pão de queijo', status: 'candidate', updatedAt: '2026-07-03T10:00:00Z' },
  { id: 'r3', name: 'Canja', status: 'draft' },
]);

const songs = memoryAdapter('song', 'MÚSICA', [
  { id: 's1', name: 'Aquarela', status: 'active', updatedAt: '2026-07-02T10:00:00Z' },
  { id: 's2', name: 'Trenzinho caipira', status: 'retired', meta: 'domínio público' },
]);

describe('createLibraryCatalog — aggregation and querying (headless, no DOM)', () => {
  it('aggregates items from all adapters, sorted by name by default', async () => {
    const catalog = createLibraryCatalog([recipes, songs]);
    const { items } = await catalog.list();
    expect(items.map((i) => i.name)).toEqual([
      'Aquarela',
      'Bolo de fubá',
      'Canja',
      'Pão de queijo',
      'Trenzinho caipira',
    ]);
  });

  it('searches case-insensitively across name, typeLabel and meta', async () => {
    const catalog = createLibraryCatalog([recipes, songs]);
    const byName = await catalog.list({ text: 'CANJA' });
    expect(byName.items.map((i) => i.ref.artifactId)).toEqual(['r3']);
    const byType = await catalog.list({ text: 'música' });
    expect(byType.items.map((i) => i.ref.adapterId)).toEqual(['song', 'song']);
    const byMeta = await catalog.list({ text: 'forno' });
    expect(byMeta.items.map((i) => i.ref.artifactId)).toEqual(['r1']);
    const blank = await catalog.list({ text: '   ' });
    expect(blank.items).toHaveLength(5);
  });

  it('filters by status (fixed vocabulary) and by adapter (dynamic vocabulary)', async () => {
    const catalog = createLibraryCatalog([recipes, songs]);
    const active = await catalog.list({ statuses: ['active'] });
    expect(active.items.map((i) => i.name)).toEqual(['Aquarela', 'Bolo de fubá']);
    const oneAdapter = await catalog.list({ adapterIds: ['recipe'] });
    expect(oneAdapter.items).toHaveLength(3);
    const combined = await catalog.list({ statuses: ['active'], adapterIds: ['recipe'] });
    expect(combined.items.map((i) => i.ref.artifactId)).toEqual(['r1']);
  });

  it('sorts by update (newest first, undated last) and by canonical status order', async () => {
    const catalog = createLibraryCatalog([recipes, songs]);
    const updated = await catalog.list({ sort: 'updated' });
    expect(updated.items.map((i) => i.ref.artifactId)).toEqual(['r2', 's1', 'r1', 'r3', 's2']);
    const status = await catalog.list({ sort: 'status' });
    expect(status.items.map((i) => i.status)).toEqual([
      'draft',
      'candidate',
      'active',
      'active',
      'retired',
    ]);
  });

  it('counts over the text-filtered set, before status/adapter narrowing', async () => {
    const catalog = createLibraryCatalog([recipes, songs]);
    const { counts } = await catalog.list({ statuses: ['retired'], adapterIds: ['song'] });
    // narrowing does not change chip counts…
    expect(counts.total).toBe(5);
    expect(counts.byStatus).toEqual({
      draft: 1,
      test: 0,
      candidate: 1,
      active: 2,
      deprecated: 0,
      retired: 1,
    });
    expect(counts.byAdapter).toEqual({ recipe: 3, song: 2 });
    // …but text search does.
    const searched = await catalog.list({ text: 'de' });
    expect(searched.counts.total).toBe(2);
    expect(searched.counts.byAdapter).toEqual({ recipe: 2, song: 0 });
  });

  it('passes the query through to adapters (pre-filtering allowed)', async () => {
    const listSpy = vi.fn(async () => []);
    const adapter = memoryAdapter('spy', 'SPY', [], { list: listSpy });
    const catalog = createLibraryCatalog([adapter]);
    const query = { text: 'x', statuses: ['draft' as const], sort: 'updated' as const };
    await catalog.list(query);
    expect(listSpy).toHaveBeenCalledWith(query);
  });

  it('routes get() to the owning adapter', async () => {
    const catalog = createLibraryCatalog([recipes, songs]);
    const detail = await catalog.get({ adapterId: 'song', artifactId: 's1' });
    expect(detail.name).toBe('Aquarela');
    expect(detail.versions).toHaveLength(1);
    expect(detail.actions[0].kind).toBe('navigate');
  });

  it('rejects get() for an unknown adapter with a helpful error', async () => {
    const catalog = createLibraryCatalog([recipes]);
    await expect(catalog.get({ adapterId: 'nope', artifactId: 'x' })).rejects.toThrow(
      /unknown adapter "nope" — registered: recipe/,
    );
  });

  it('survives a failing adapter: warns and returns the others', async () => {
    const onWarning = vi.fn();
    const broken = memoryAdapter('broken', 'BROKEN', [], {
      list: async () => {
        throw new Error('backend offline');
      },
    });
    const catalog = createLibraryCatalog([broken, songs], { onWarning });
    const { items } = await catalog.list();
    expect(items).toHaveLength(2);
    expect(onWarning).toHaveBeenCalledWith({
      adapterId: 'broken',
      message: 'adapter list() failed: backend offline',
    });
  });

  it('defaults to a silent warning handler (no options, no crash)', async () => {
    const broken = memoryAdapter('broken', 'BROKEN', [], {
      list: async () => {
        throw new Error('backend offline');
      },
    });
    const catalog = createLibraryCatalog([broken]);
    const { items, counts } = await catalog.list();
    expect(items).toEqual([]);
    expect(counts.total).toBe(0);
  });

  it('stringifies non-Error rejections in the warning', async () => {
    const onWarning = vi.fn();
    const broken = memoryAdapter('broken', 'BROKEN', [], {
      list: async () => Promise.reject('plain string'),
    });
    const catalog = createLibraryCatalog([broken], { onWarning });
    await catalog.list();
    expect(onWarning.mock.calls[0][0].message).toBe('adapter list() failed: plain string');
  });

  it('drops invalid adapters at construction (warning, never crash)', async () => {
    const onWarning = vi.fn();
    const catalog = createLibraryCatalog([memoryAdapter('', 'X', []), recipes], { onWarning });
    expect(catalog.adapters.map((a) => a.id)).toEqual(['recipe']);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it('counts unregistered adapterIds in items defensively (no crash, not counted)', async () => {
    // an adapter that (incorrectly) emits items pointing at another adapter
    const confused = memoryAdapter('confused', 'CONFUSED', [
      { id: 'c1', name: 'Alien', status: 'draft' },
    ]);
    const original = confused.list;
    confused.list = async (q) => {
      const items = await original(q);
      return items.map((i) => ({ ...i, ref: { ...i.ref, adapterId: 'ghost' } }));
    };
    const catalog = createLibraryCatalog([confused]);
    const { counts, items } = await catalog.list();
    expect(items).toHaveLength(1);
    expect(counts.byAdapter).toEqual({ confused: 0 });
  });

  it('aggregates subscribe across adapters and unsubscribes all', () => {
    const unsubA = vi.fn();
    const unsubB = vi.fn();
    const callbacks: Array<() => void> = [];
    const withSub = memoryAdapter('a', 'A', [], {
      subscribe: (cb) => {
        callbacks.push(cb);
        return unsubA;
      },
    });
    const withSub2 = memoryAdapter('b', 'B', [], {
      subscribe: (cb) => {
        callbacks.push(cb);
        return unsubB;
      },
    });
    const noSub = memoryAdapter('c', 'C', []);
    const catalog = createLibraryCatalog([withSub, withSub2, noSub]);
    const listener = vi.fn();
    const unsubscribe = catalog.subscribe(listener);
    expect(callbacks).toHaveLength(2);
    callbacks[0]();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(unsubA).toHaveBeenCalledTimes(1);
    expect(unsubB).toHaveBeenCalledTimes(1);
  });

  it('sorting ties break deterministically by name then artifactId', async () => {
    const twins = memoryAdapter('twin', 'TWIN', [
      { id: 't2', name: 'Same', status: 'draft', updatedAt: '2026-07-01T00:00:00Z' },
      { id: 't1', name: 'Same', status: 'draft', updatedAt: '2026-07-01T00:00:00Z' },
    ]);
    const catalog = createLibraryCatalog([twins]);
    const byUpdated = await catalog.list({ sort: 'updated' });
    expect(byUpdated.items.map((i) => i.ref.artifactId)).toEqual(['t1', 't2']);
  });
});
