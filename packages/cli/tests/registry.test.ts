import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  computeDiagramHash,
  createDiagram,
  createNode,
  JsonSerializer,
  LifecycleEngine,
  type BpmnDiagram,
} from '@buildtovalue/core';
import {
  approveCommand,
  formatEntry,
  formatHistory,
  loadRegistry,
  promoteCommand,
  registryActiveCommand,
  registryAddCommand,
  registryBindRunCommand,
  registryDiffCommand,
  registryHistoryCommand,
  registryPublishCommand,
} from '../src/index.js';

async function versionedDiagram(options: {
  versionId: string;
  semver: string;
  status?: BpmnDiagram['version']['status'];
  effectiveFrom?: string;
  nodes?: number;
}): Promise<BpmnDiagram> {
  const diagram = createDiagram({ name: 'Flow', id: 'flow' });
  diagram.version = {
    id: options.versionId,
    semanticVersion: options.semver,
    status: options.status ?? 'active',
    approvedBy: [],
    changeSummary: `Release ${options.semver} — initial modelling of the flow`,
    createdBy: 'alice',
    createdAt: `2026-0${(Number(options.semver.split('.')[0]) % 9) + 1}-01T00:00:00.000Z`,
    snapshotHash: '',
    ...(options.effectiveFrom ? { effectiveFrom: options.effectiveFrom } : {}),
  };
  for (let i = 0; i < (options.nodes ?? 1); i++) {
    const node = createNode({ type: 'task', id: `n${i}`, label: `Task ${i}` });
    diagram.nodes[node.id] = node;
  }
  diagram.version.snapshotHash = await computeDiagramHash(diagram);
  return diagram;
}

async function tmp() {
  return mkdtemp(join(tmpdir(), 'bpmnr-reg-'));
}

async function writeDiagram(dir: string, name: string, diagram: BpmnDiagram): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, new JsonSerializer().serialize(diagram));
  return path;
}

describe('registry file commands', () => {
  it('add bootstraps a registry file and appends versions', async () => {
    const dir = await tmp();
    const regPath = join(dir, 'registry.json');
    const d1 = await writeDiagram(dir, 'v1.json', await versionedDiagram({ versionId: 'v1', semver: '1.0.0' }));

    const entry = await registryAddCommand(d1, regPath, { technicalNotes: 'first' });
    expect(entry.version.id).toBe('v1');
    expect(entry.technicalNotes).toBe('first');

    const d2 = await writeDiagram(dir, 'v2.json', await versionedDiagram({ versionId: 'v2', semver: '2.0.0' }));
    await registryAddCommand(d2, regPath);

    const history = await registryHistoryCommand(regPath);
    expect(history.map((e) => e.version.id)).toEqual(['v1', 'v2']);
    expect(formatHistory(history)).toContain('1.0.0');
    expect(formatHistory(history)).toContain('Release 2.0.0');
  });

  it('publish records a lane and history shows the live channel', async () => {
    const dir = await tmp();
    const regPath = join(dir, 'registry.json');
    const d1 = await writeDiagram(dir, 'v1.json', await versionedDiagram({ versionId: 'v1', semver: '1.0.0' }));
    await registryAddCommand(d1, regPath);

    const pub = await registryPublishCommand(regPath, {
      versionId: 'v1',
      channel: 'pilot',
      status: 'active',
      effectiveFrom: '2026-06-01T00:00:00.000Z',
    });
    expect(pub.channel).toBe('pilot');

    const reloaded = await loadRegistry(regPath);
    expect(reloaded.channelTimeline('pilot')).toHaveLength(1);
    expect(formatHistory(reloaded.history())).toContain('[live: pilot:active]');
  });

  it('active answers which version was in effect on a channel', async () => {
    const dir = await tmp();
    const regPath = join(dir, 'registry.json');
    await registryAddCommand(
      await writeDiagram(dir, 'v1.json', await versionedDiagram({ versionId: 'v1', semver: '1.0.0' })),
      regPath,
    );
    await registryAddCommand(
      await writeDiagram(dir, 'v2.json', await versionedDiagram({ versionId: 'v2', semver: '2.0.0' })),
      regPath,
    );
    await registryPublishCommand(regPath, { versionId: 'v1', channel: 'general', effectiveFrom: '2026-01-01T00:00:00.000Z' });
    await registryPublishCommand(regPath, { versionId: 'v2', channel: 'general', effectiveFrom: '2026-06-01T00:00:00.000Z' });

    expect((await registryActiveCommand(regPath, { at: '2026-03-01T00:00:00.000Z', channel: 'general' }))?.version.id).toBe('v1');
    expect((await registryActiveCommand(regPath, { at: '2026-09-01T00:00:00.000Z', channel: 'general' }))?.version.id).toBe('v2');
    expect(await registryActiveCommand(regPath, { at: '2020-01-01T00:00:00.000Z', channel: 'general' })).toBeUndefined();
  });

  it('formatEntry renders id, version, status and a snapshot prefix', async () => {
    const dir = await tmp();
    const regPath = join(dir, 'registry.json');
    const entry = await registryAddCommand(
      await writeDiagram(dir, 'v1.json', await versionedDiagram({ versionId: 'v1', semver: '1.0.0' })),
      regPath,
    );
    const line = formatEntry(entry);
    expect(line).toContain('v1');
    expect(line).toContain('v1.0.0');
    expect(line).toMatch(/snapshot [0-9a-f]{12}…/);
  });

  it('active without a channel uses the version-level validity window; empty history reads clearly', async () => {
    const dir = await tmp();
    const regPath = join(dir, 'registry.json');
    await registryAddCommand(
      await writeDiagram(
        dir,
        'v1.json',
        await versionedDiagram({ versionId: 'v1', semver: '1.0.0', effectiveFrom: '2026-01-01T00:00:00.000Z' }),
      ),
      regPath,
    );
    expect((await registryActiveCommand(regPath, { at: '2026-02-01T00:00:00.000Z' }))?.version.id).toBe('v1');
    expect(await registryActiveCommand(regPath, { at: '2025-01-01T00:00:00.000Z' })).toBeUndefined();
    expect(formatHistory([])).toBe('No versions registered.');
  });

  it('diff between two registered versions and bind-run pin', async () => {
    const dir = await tmp();
    const regPath = join(dir, 'registry.json');
    await registryAddCommand(
      await writeDiagram(dir, 'v1.json', await versionedDiagram({ versionId: 'v1', semver: '1.0.0', nodes: 1 })),
      regPath,
    );
    await registryAddCommand(
      await writeDiagram(dir, 'v2.json', await versionedDiagram({ versionId: 'v2', semver: '2.0.0', nodes: 3 })),
      regPath,
    );

    expect(await registryDiffCommand(regPath, 'v1', 'v2')).toContain('+ node');

    const run = await registryBindRunCommand(regPath, { versionId: 'v2', channel: 'prod', runId: 'run-1' });
    expect(run).toMatchObject({ runId: 'run-1', versionId: 'v2', semanticVersion: '2.0.0', channel: 'prod' });
    await expect(registryBindRunCommand(regPath, { versionId: 'ghost' })).rejects.toThrow(/Unknown version/);
  });
});

describe('promote & approve commands', () => {
  it('promotes draft → test and writes the promoted diagram, optionally registering it', async () => {
    const dir = await tmp();
    const path = await writeDiagram(dir, 'd.json', await versionedDiagram({ versionId: 'v0', semver: '0.1.0', status: 'draft' }));
    const regPath = join(dir, 'registry.json');

    const promoted = await promoteCommand(path, {
      to: 'test',
      actorId: 'u1',
      actorRole: 'owner',
      reason: 'Ready for sandbox testing by the team.',
      registryPath: regPath,
    });
    expect(promoted.version.status).toBe('test');

    // The file on disk was updated to the promoted version.
    const onDisk = new JsonSerializer().deserialize(await readFile(path, 'utf8'));
    expect(onDisk.version.status).toBe('test');

    // And it was registered.
    const registry = await loadRegistry(regPath);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0].version.status).toBe('test');
  });

  it('records approvals so a two-role active promotion passes the gate', async () => {
    const dir = await tmp();
    const path = await writeDiagram(
      dir,
      'd.json',
      await versionedDiagram({ versionId: 'vc', semver: '1.0.0', status: 'candidate' }),
    );

    await approveCommand(path, { actorId: 'o1', actorRole: 'owner', reason: 'looks good' });
    await approveCommand(path, { actorId: 'c1', actorRole: 'compliance', reason: 'compliant' });

    const promoted = await promoteCommand(path, {
      to: 'active',
      actorId: 'ops1',
      actorRole: 'operations',
      reason: 'Approved by owner and compliance for production rollout.',
    });
    expect(promoted.version.status).toBe('active');
    expect(promoted.version.effectiveFrom).toBeDefined();
  });

  it('surfaces the governance gate when active promotion lacks approvals', async () => {
    const dir = await tmp();
    const path = await writeDiagram(
      dir,
      'd.json',
      await versionedDiagram({ versionId: 'vc', semver: '1.0.0', status: 'candidate' }),
    );
    // No approvals recorded → LifecycleEngine rejects. The engine is the gate;
    // the CLI maps this to exit 1 (tested in bin.test.ts).
    const engine = new LifecycleEngine();
    await expect(
      promoteCommand(path, { to: 'active', actorId: 'ops', actorRole: 'operations', reason: 'no approvals here yet' }),
    ).rejects.toThrow(/distinct roles/);
    void engine;
  });
});
