import { beforeEach, describe, expect, it } from 'vitest';
import { computeDiagramHash, createDiagram, type BpmnDiagram } from '@buildtovalue/core';
import { RegistryError, VersionRegistry } from '../src/index.js';

async function versioned(versionId: string, semver: string): Promise<BpmnDiagram> {
  const diagram = createDiagram({ name: 'Flow', id: 'flow' });
  diagram.version = {
    id: versionId,
    semanticVersion: semver,
    status: 'candidate',
    approvedBy: [],
    changeSummary: `v${semver}`,
    createdBy: 'alice',
    createdAt: '2026-01-01T00:00:00.000Z',
    snapshotHash: '',
  };
  diagram.version.snapshotHash = await computeDiagramHash(diagram);
  return diagram;
}

describe('publication channels & environments', () => {
  let registry: VersionRegistry;

  beforeEach(async () => {
    registry = new VersionRegistry();
    await registry.register(await versioned('v1', '1.0.0'));
    await registry.register(await versioned('v2', '2.0.0'));
    await registry.register(await versioned('v3', '3.0.0'));
  });

  it('closes the previous open publication when a new one supersedes it on the same lane', async () => {
    await registry.publish('v1', { channel: 'general', effectiveFrom: '2026-01-01T00:00:00.000Z' });
    await registry.publish('v2', { channel: 'general', effectiveFrom: '2026-06-01T00:00:00.000Z' });

    const timeline = registry.channelTimeline('general');
    expect(timeline.map((p) => p.versionId)).toEqual(['v1', 'v2']);
    // v1's window was closed at v2's effectiveFrom; v2 remains open.
    expect(timeline[0].effectiveUntil).toBe('2026-06-01T00:00:00.000Z');
    expect(timeline[1].effectiveUntil).toBeUndefined();
  });

  it('answers activeAt per channel across the timeline', async () => {
    await registry.publish('v1', { channel: 'general', effectiveFrom: '2026-01-01T00:00:00.000Z' });
    await registry.publish('v2', { channel: 'general', effectiveFrom: '2026-06-01T00:00:00.000Z' });

    expect(registry.activeAt('2026-03-01T00:00:00.000Z', { channel: 'general' })?.version.id).toBe('v1');
    expect(registry.activeAt('2026-09-01T00:00:00.000Z', { channel: 'general' })?.version.id).toBe('v2');
    expect(registry.activeAt('2025-01-01T00:00:00.000Z', { channel: 'general' })).toBeUndefined();
  });

  it('keeps channels independent — a version can be active on pilot while another is on general', async () => {
    const t = '2026-05-01T00:00:00.000Z';
    await registry.publish('v3', { channel: 'pilot', status: 'active', effectiveFrom: t });
    await registry.publish('v2', { channel: 'general', status: 'active', effectiveFrom: t });

    const at = '2026-07-01T00:00:00.000Z';
    expect(registry.activeAt(at, { channel: 'pilot' })?.version.id).toBe('v3');
    expect(registry.activeAt(at, { channel: 'general' })?.version.id).toBe('v2');

    // The same version can carry different statuses on different lanes.
    await registry.publish('v3', { channel: 'general', status: 'candidate', effectiveFrom: '2026-08-01T00:00:00.000Z' });
    expect(registry.publicationAt('2026-09-01T00:00:00.000Z', { channel: 'general' })?.status).toBe('candidate');
    expect(registry.publicationAt('2026-09-01T00:00:00.000Z', { channel: 'pilot' })?.status).toBe('active');
  });

  it('treats environment as part of the lane', async () => {
    await registry.publish('v1', { channel: 'general', environment: 'prod', effectiveFrom: '2026-01-01T00:00:00.000Z' });
    await registry.publish('v2', { channel: 'general', environment: 'test', effectiveFrom: '2026-01-01T00:00:00.000Z' });

    const at = '2026-02-01T00:00:00.000Z';
    expect(registry.activeAt(at, { channel: 'general', environment: 'prod' })?.version.id).toBe('v1');
    expect(registry.activeAt(at, { channel: 'general', environment: 'test' })?.version.id).toBe('v2');
    // Different environment ⇒ different lane ⇒ no supersession between them.
    expect(registry.channelTimeline('general', 'prod')).toHaveLength(1);
  });

  it('rejects publishing with an effectiveFrom before the current open publication', async () => {
    await registry.publish('v2', { channel: 'general', effectiveFrom: '2026-06-01T00:00:00.000Z' });
    await expect(
      registry.publish('v1', { channel: 'general', effectiveFrom: '2026-01-01T00:00:00.000Z' }),
    ).rejects.toThrow(RegistryError);
  });

  it('rejects publishing an unknown version', async () => {
    await expect(registry.publish('ghost', { channel: 'general' })).rejects.toThrow(/Unknown version/);
  });
});
