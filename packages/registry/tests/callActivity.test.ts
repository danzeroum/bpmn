import { beforeEach, describe, expect, it } from 'vitest';
import {
  computeDiagramHash,
  createDiagram,
  createNode,
  type BpmnDiagram,
} from '@bpmn-react/core';
import { resolveCallActivities, VersionRegistry } from '../src/index.js';

async function versionedProcess(
  processId: string,
  versionId: string,
  window: { from?: string; until?: string } = {},
): Promise<BpmnDiagram> {
  const diagram = createDiagram({ name: processId, id: processId });
  diagram.version = {
    id: versionId,
    semanticVersion: '1.0.0',
    status: 'active',
    approvedBy: [],
    changeSummary: `version ${versionId}`,
    createdBy: 'alice',
    createdAt: '2026-01-01T00:00:00.000Z',
    snapshotHash: '',
    ...(window.from ? { effectiveFrom: window.from } : {}),
    ...(window.until ? { effectiveUntil: window.until } : {}),
  };
  diagram.version.snapshotHash = await computeDiagramHash(diagram);
  return diagram;
}

function callerDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Caller', id: 'caller' });
  diagram.nodes = {
    charge: createNode({
      type: 'callActivity',
      id: 'charge',
      label: 'Charge',
      x: 0,
      y: 0,
      properties: { calledElement: 'billing' },
    }),
    orphan: createNode({ type: 'callActivity', id: 'orphan', label: 'No target', x: 0, y: 100 }),
    task: createNode({ type: 'task', id: 'task', label: 'Plain', x: 0, y: 200 }),
  };
  return diagram;
}

describe('resolveCallActivities (F7 registry synergy)', () => {
  let registry: VersionRegistry;

  beforeEach(async () => {
    registry = new VersionRegistry();
    await registry.register(
      await versionedProcess('billing', 'b1', {
        from: '2026-01-01T00:00:00.000Z',
        until: '2026-06-01T00:00:00.000Z',
      }),
    );
    await registry.register(
      await versionedProcess('billing', 'b2', { from: '2026-06-01T00:00:00.000Z' }),
    );
    await registry.register(
      await versionedProcess('crm', 'c1', { from: '2026-01-01T00:00:00.000Z' }),
    );
  });

  it('binds each call activity to the called process version in effect at the date', () => {
    const at = (iso: string) =>
      resolveCallActivities(callerDiagram(), registry, iso).find((r) => r.nodeId === 'charge');
    expect(at('2026-03-01T00:00:00.000Z')?.entry?.version.id).toBe('b1');
    expect(at('2026-09-01T00:00:00.000Z')?.entry?.version.id).toBe('b2');
    // Before any version was in effect: unresolved, but the target is known.
    const early = at('2025-01-01T00:00:00.000Z');
    expect(early?.calledElement).toBe('billing');
    expect(early?.entry).toBeUndefined();
  });

  it('never binds to a different process, even when one is active', () => {
    const diagram = callerDiagram();
    diagram.nodes.charge.properties.calledElement = 'unknown-process';
    const [charge] = resolveCallActivities(diagram, registry, '2026-03-01T00:00:00.000Z');
    expect(charge.calledElement).toBe('unknown-process');
    expect(charge.entry).toBeUndefined();
  });

  it('reports call activities without calledElement and skips non-call nodes', () => {
    const resolutions = resolveCallActivities(callerDiagram(), registry, '2026-03-01T00:00:00.000Z');
    expect(resolutions.map((r) => r.nodeId).sort()).toEqual(['charge', 'orphan']);
    const orphan = resolutions.find((r) => r.nodeId === 'orphan');
    expect(orphan?.calledElement).toBeUndefined();
    expect(orphan?.entry).toBeUndefined();
  });

  it('resolves through a publication lane when a target is given', async () => {
    await registry.publish('b1', {
      channel: 'general',
      effectiveFrom: '2026-02-01T00:00:00.000Z',
    });
    await registry.publish('b2', {
      channel: 'general',
      effectiveFrom: '2026-08-01T00:00:00.000Z',
    });
    const resolve = (iso: string) =>
      resolveCallActivities(callerDiagram(), registry, iso, { channel: 'general' }).find(
        (r) => r.nodeId === 'charge',
      );
    expect(resolve('2026-03-01T00:00:00.000Z')?.entry?.version.id).toBe('b1');
    expect(resolve('2026-09-01T00:00:00.000Z')?.entry?.version.id).toBe('b2');
    expect(resolve('2026-01-15T00:00:00.000Z')?.entry).toBeUndefined();
  });
});
