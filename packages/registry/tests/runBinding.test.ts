import { describe, expect, it } from 'vitest';
import { computeDiagramHash, createDiagram, type BpmnDiagram } from '@bpmn-react/core';
import { bindRun, RegistryError, verifyRunBinding, VersionRegistry, type RegistryEntry } from '../src/index.js';

async function versioned(versionId: string, semver: string): Promise<BpmnDiagram> {
  const diagram = createDiagram({ name: 'Flow', id: 'flow' });
  diagram.version = {
    id: versionId,
    semanticVersion: semver,
    status: 'active',
    approvedBy: [],
    changeSummary: `v${semver}`,
    createdBy: 'alice',
    createdAt: '2026-01-01T00:00:00.000Z',
    snapshotHash: '',
  };
  diagram.version.snapshotHash = await computeDiagramHash(diagram);
  return diagram;
}

describe('run-binding (execution pinning)', () => {
  it('pins a run to the exact version with a frozen, immutable record', async () => {
    const registry = new VersionRegistry();
    const entry = await registry.register(await versioned('v1', '1.0.0'));

    const run = bindRun(entry, { channel: 'general', environment: 'prod' });
    expect(run.versionId).toBe('v1');
    expect(run.semanticVersion).toBe('1.0.0');
    expect(run.snapshotHash).toBe(entry.snapshotHash);
    expect(run.channel).toBe('general');
    expect(run.environment).toBe('prod');
    expect(run.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.isFrozen(run)).toBe(true);
  });

  it('accepts a caller-supplied run id', async () => {
    const registry = new VersionRegistry();
    const entry = await registry.register(await versioned('v1', '1.0.0'));
    expect(bindRun(entry, { runId: 'run-42' }).runId).toBe('run-42');
  });

  it('a bound run never changes when a newer version is registered later', async () => {
    const registry = new VersionRegistry();
    const v1 = await registry.register(await versioned('v1', '1.0.0'));
    const run = bindRun(v1);

    // A later version is registered — the in-flight run is unaffected.
    await registry.register(await versioned('v2', '2.0.0'));
    expect(run.versionId).toBe('v1');
    expect(run.semanticVersion).toBe('1.0.0');
    expect(verifyRunBinding(run, registry.get('v1')!)).toBe(true);
  });

  it('refuses to bind a run to an entry without a snapshot hash', () => {
    const entry = { version: { id: 'v1', semanticVersion: '1.0.0' }, snapshotHash: '' } as RegistryEntry;
    expect(() => bindRun(entry)).toThrow(RegistryError);
  });

  it('verifyRunBinding detects a version/hash mismatch', async () => {
    const registry = new VersionRegistry();
    const v1 = await registry.register(await versioned('v1', '1.0.0'));
    const v2 = await registry.register(await versioned('v2', '2.0.0'));
    const run = bindRun(v1);

    expect(verifyRunBinding(run, v1)).toBe(true);
    expect(verifyRunBinding(run, v2)).toBe(false); // wrong version
    const tampered = { ...v1, snapshotHash: 'f'.repeat(64) };
    expect(verifyRunBinding(run, tampered)).toBe(false); // drifted hash
  });
});
