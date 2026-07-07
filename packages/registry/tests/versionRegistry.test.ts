import { describe, expect, it } from 'vitest';
import {
  computeDiagramHash,
  createDiagram,
  createNode,
  type BpmnDiagram,
} from '@bpmn-react/core';
import { RegistryError, VersionRegistry, type RegistryEntry } from '../src/index.js';

/**
 * Builds a diagram carrying a specific version identity and validity window,
 * so temporal/lineage queries have real data to work against.
 */
async function diagramAt(options: {
  id?: string;
  versionId: string;
  semver: string;
  parentVersionId?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  createdAt?: string;
  nodes?: number;
}): Promise<BpmnDiagram> {
  const diagram = createDiagram({ name: 'Flow', id: options.id ?? 'flow-1' });
  diagram.version = {
    id: options.versionId,
    semanticVersion: options.semver,
    status: 'active',
    approvedBy: [],
    changeSummary: `Version ${options.semver}`,
    createdBy: 'alice',
    createdAt: options.createdAt ?? '2026-01-01T00:00:00.000Z',
    snapshotHash: '',
    ...(options.parentVersionId ? { parentVersionId: options.parentVersionId } : {}),
    ...(options.effectiveFrom ? { effectiveFrom: options.effectiveFrom } : {}),
    ...(options.effectiveUntil ? { effectiveUntil: options.effectiveUntil } : {}),
  };
  for (let i = 0; i < (options.nodes ?? 1); i++) {
    const node = createNode({ type: 'task', id: `n${i}`, label: `Task ${i}` });
    diagram.nodes[node.id] = node;
  }
  diagram.version.snapshotHash = await computeDiagramHash(diagram);
  return diagram;
}

describe('VersionRegistry — registration & integrity', () => {
  it('registers a version, backfilling the snapshot hash', async () => {
    const registry = new VersionRegistry();
    const diagram = await diagramAt({ versionId: 'v1', semver: '1.0.0' });
    const entry = await registry.register(diagram);

    expect(entry.version.id).toBe('v1');
    expect(entry.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    expect(registry.get('v1')).toBe(entry);
    // Stored snapshot is a deep copy — mutating the source doesn't leak in.
    diagram.nodes.n0.label = 'mutated';
    expect(registry.get('v1')!.snapshot.nodes.n0.label).toBe('Task 0');
  });

  it('rejects re-registering the same version id (versions are immutable)', async () => {
    const registry = new VersionRegistry();
    await registry.register(await diagramAt({ versionId: 'v1', semver: '1.0.0' }));
    await expect(
      registry.register(await diagramAt({ versionId: 'v1', semver: '1.0.1' })),
    ).rejects.toThrow(RegistryError);
  });

  it('rejects a declared snapshotHash that does not match the content', async () => {
    const registry = new VersionRegistry();
    const diagram = await diagramAt({ versionId: 'v1', semver: '1.0.0' });
    diagram.version.snapshotHash = 'f'.repeat(64);
    await expect(registry.register(diagram)).rejects.toThrow(/does not match/);
  });

  it('applies changeSummary and technicalNotes overrides', async () => {
    const registry = new VersionRegistry();
    const entry = await registry.register(await diagramAt({ versionId: 'v1', semver: '1.0.0' }), {
      changeSummary: 'Business summary',
      technicalNotes: 'Refactored the approval gate',
    });
    expect(entry.version.changeSummary).toBe('Business summary');
    expect(entry.technicalNotes).toBe('Refactored the approval gate');
    expect(entry.snapshot.version.changeSummary).toBe('Business summary');
  });

  it('serializes concurrent registrations into a consistent list', async () => {
    const registry = new VersionRegistry();
    const diagrams = await Promise.all(
      ['v1', 'v2', 'v3', 'v4'].map((id, i) => diagramAt({ versionId: id, semver: `1.0.${i}` })),
    );
    await Promise.all(diagrams.map((d) => registry.register(d)));
    expect(registry.list()).toHaveLength(4);
    expect(new Set(registry.list().map((e) => e.version.id)).size).toBe(4);
  });
});

describe('VersionRegistry — history & lineage', () => {
  it('orders history chronologically and walks the lineage chain', async () => {
    const registry = new VersionRegistry();
    // Register out of chronological order to prove history() sorts.
    await registry.register(
      await diagramAt({ versionId: 'v2', semver: '1.1.0', parentVersionId: 'v1', createdAt: '2026-02-01T00:00:00.000Z' }),
    );
    await registry.register(
      await diagramAt({ versionId: 'v1', semver: '1.0.0', createdAt: '2026-01-01T00:00:00.000Z' }),
    );
    await registry.register(
      await diagramAt({ versionId: 'v3', semver: '2.0.0', parentVersionId: 'v2', createdAt: '2026-03-01T00:00:00.000Z' }),
    );

    expect(registry.history().map((e) => e.version.id)).toEqual(['v1', 'v2', 'v3']);
    expect(registry.lineageOf('v3').map((e) => e.version.id)).toEqual(['v1', 'v2', 'v3']);
    expect(registry.lineageOf('v1').map((e) => e.version.id)).toEqual(['v1']);
  });

  it('stops lineage at the first ancestor not in the registry', async () => {
    const registry = new VersionRegistry();
    await registry.register(
      await diagramAt({ versionId: 'v2', semver: '1.1.0', parentVersionId: 'missing' }),
    );
    expect(registry.lineageOf('v2').map((e) => e.version.id)).toEqual(['v2']);
  });
});

describe('VersionRegistry — temporal validity (activeAt without channel)', () => {
  it('returns the version whose lifecycle window covers the date', async () => {
    const registry = new VersionRegistry();
    await registry.register(
      await diagramAt({
        versionId: 'v1',
        semver: '1.0.0',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveUntil: '2026-06-01T00:00:00.000Z',
      }),
    );
    await registry.register(
      await diagramAt({ versionId: 'v2', semver: '2.0.0', effectiveFrom: '2026-06-01T00:00:00.000Z' }),
    );

    expect(registry.activeAt('2026-03-15T00:00:00.000Z')?.version.id).toBe('v1');
    expect(registry.activeAt('2026-09-01T00:00:00.000Z')?.version.id).toBe('v2');
    // Boundary: effectiveUntil is exclusive, effectiveFrom inclusive.
    expect(registry.activeAt('2026-06-01T00:00:00.000Z')?.version.id).toBe('v2');
    // Before anything was effective.
    expect(registry.activeAt('2025-12-01T00:00:00.000Z')).toBeUndefined();
    // Accepts Date objects too.
    expect(registry.activeAt(new Date('2026-02-01T00:00:00.000Z'))?.version.id).toBe('v1');
  });

  it('throws on an invalid date input', async () => {
    const registry = new VersionRegistry();
    await registry.register(await diagramAt({ versionId: 'v1', semver: '1.0.0' }));
    expect(() => registry.activeAt('not-a-date')).toThrow(RegistryError);
  });
});

describe('VersionRegistry — diffBetween', () => {
  it('diffs two registered snapshots and rejects unknown ids', async () => {
    const registry = new VersionRegistry();
    await registry.register(await diagramAt({ versionId: 'v1', semver: '1.0.0', nodes: 1 }));
    await registry.register(await diagramAt({ versionId: 'v2', semver: '2.0.0', nodes: 3 }));

    const diff = registry.diffBetween('v1', 'v2');
    // v2 has n0,n1,n2; v1 has only n0 → two nodes added.
    expect(diff.nodes.filter((op) => op.op === 'add')).toHaveLength(2);

    expect(() => registry.diffBetween('v1', 'ghost')).toThrow(/Unknown version/);
  });
});

describe('VersionRegistry — export/import integrity', () => {
  it('round-trips and rejects a tampered snapshot', async () => {
    const registry = new VersionRegistry();
    await registry.register(await diagramAt({ versionId: 'v1', semver: '1.0.0' }));
    await registry.register(await diagramAt({ versionId: 'v2', semver: '2.0.0' }));
    await registry.publish('v1', { channel: 'general', publishedBy: 'ops' });

    const data = registry.export();
    const restored = await VersionRegistry.import(data);
    expect(restored.list()).toHaveLength(2);
    expect(restored.channelTimeline('general')).toHaveLength(1);

    const tampered = structuredClone(data);
    (tampered.entries[0].snapshot.nodes.n0 as { label: string }).label = 'hacked';
    await expect(VersionRegistry.import(tampered)).rejects.toThrow(/failed snapshot verification/);
  });
});

describe('VersionRegistry — accessors', () => {
  it('snapshotOf returns a mutable deep copy; versionOf returns the stored version', async () => {
    const registry = new VersionRegistry();
    await registry.register(await diagramAt({ versionId: 'v1', semver: '1.0.0' }));

    const snap = registry.snapshotOf('v1');
    snap.nodes.n0.label = 'local edit';
    expect(registry.snapshotOf('v1').nodes.n0.label).toBe('Task 0'); // original intact

    expect(registry.versionOf('v1').semanticVersion).toBe('1.0.0');
    expect(() => registry.snapshotOf('ghost')).toThrow(RegistryError);
    expect(() => registry.versionOf('ghost')).toThrow(RegistryError);
  });
});

describe('VersionRegistry — sink', () => {
  it('writes each registered and published entry to the sink', async () => {
    const writes: RegistryEntry[] = [];
    const registry = new VersionRegistry({ sink: { write: (e) => void writes.push(e) } });
    await registry.register(await diagramAt({ versionId: 'v1', semver: '1.0.0' }));
    await registry.publish('v1', { channel: 'pilot' });
    await registry.flush();
    expect(writes).toHaveLength(2); // one on register, one on publish
    expect(writes[1].publications).toHaveLength(1);
  });
});
