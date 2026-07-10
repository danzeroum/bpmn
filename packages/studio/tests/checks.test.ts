import { describe, expect, it } from 'vitest';
import { AuditLedger } from '@buildtovalue/core';
import { VersionRegistry } from '@buildtovalue/registry';
import { computeDiagramHash } from '@buildtovalue/core';
import { runReviewChecks } from '../src/index.js';
import { candidateDiagram, extraNode } from './fixtures.js';

async function seededLedger(): Promise<AuditLedger> {
  const ledger = new AuditLedger();
  await ledger.append({ type: 'NODE_ADDED', userId: 'ana', versionId: 'v1', details: {} });
  await ledger.append({ type: 'NODE_UPDATED', userId: 'ana', versionId: 'v1', details: {} });
  return ledger;
}

describe('runReviewChecks — 4 cards de chamadas reais (§5, §10.4)', () => {
  it('all four cards go green on a sound, certifiable flow with intact ledger', async () => {
    const checks = await runReviewChecks({
      diagram: candidateDiagram(),
      ledger: await seededLedger(),
    });
    expect(checks.map((c) => `${c.id}:${c.ok}`)).toEqual([
      'soundness:true',
      'conformance:true',
      'ledger:true',
      'dependencies:true',
    ]);
    expect(checks.find((c) => c.id === 'ledger')!.detail).toBe('cadeia íntegra (2/2)');
    expect(checks.find((c) => c.id === 'dependencies')!.detail).toBe('sem referências externas');
    expect(checks.find((c) => c.id === 'conformance')!.detail).toMatch(/classe/);
  });

  it('a tampered ledger turns the Ledger card red with the exact break index', async () => {
    const ledger = await seededLedger();
    const tampered = ledger.export();
    tampered.entries[0].details = { forged: true };
    const checks = await runReviewChecks({ diagram: candidateDiagram(), ledger: tampered });
    const card = checks.find((c) => c.id === 'ledger')!;
    expect(card.ok).toBe(false);
    expect(card.detail).toBe('quebra na entrada 0');
  });

  it('a structural error turns the Soundness card red with the SND code', async () => {
    // a task with no outgoing path — dead end off the main flow
    const diagram = candidateDiagram({ extraNodes: [extraNode('orphan-task', 'task')] });
    diagram.edges['e3'] = {
      id: 'e3',
      type: 'sequenceFlow',
      sourceId: 'start',
      targetId: 'orphan-task',
      properties: {},
      createdInVersion: 'v0',
      audit: { createdBy: 'ana', createdAt: '2026-06-01T00:00:00.000Z', history: [] },
    };
    const checks = await runReviewChecks({ diagram, ledger: await seededLedger() });
    const card = checks.find((c) => c.id === 'soundness')!;
    expect(card.ok).toBe(false);
    expect(card.detail).toMatch(/SND_/);
  });

  it('an unresolved call-activity reference turns the Dependências card red', async () => {
    const registry = new VersionRegistry();
    const diagram = candidateDiagram({
      extraNodes: [extraNode('call', 'callActivity', { calledElement: 'billing' })],
    });
    diagram.edges['e3'] = {
      id: 'e3',
      type: 'sequenceFlow',
      sourceId: 'work',
      targetId: 'call',
      properties: {},
      createdInVersion: 'v0',
      audit: { createdBy: 'ana', createdAt: '2026-06-01T00:00:00.000Z', history: [] },
    };
    diagram.edges['e4'] = {
      id: 'e4',
      type: 'sequenceFlow',
      sourceId: 'call',
      targetId: 'end',
      properties: {},
      createdInVersion: 'v0',
      audit: { createdBy: 'ana', createdAt: '2026-06-01T00:00:00.000Z', history: [] },
    };
    const broken = await runReviewChecks({ diagram, ledger: await seededLedger(), registry });
    const card = broken.find((c) => c.id === 'dependencies')!;
    expect(card.ok).toBe(false);
    expect(card.detail).toBe('1 referência(s) quebrada(s)');

    // registering the referenced flow resolves it
    const billing = candidateDiagram({ id: 'billing', versionId: 'bill-v1', semver: '1.0.0', status: 'active' });
    billing.version.effectiveFrom = '2026-01-01T00:00:00.000Z';
    billing.version.snapshotHash = await computeDiagramHash(billing);
    await registry.register(billing);
    const resolved = await runReviewChecks({
      diagram,
      ledger: await seededLedger(),
      registry,
      now: () => '2026-07-08T00:00:00.000Z',
    });
    expect(resolved.find((c) => c.id === 'dependencies')!.ok).toBe(true);
  });

  it('a failing exporter turns the Conformidade card red instead of crashing', async () => {
    const checks = await runReviewChecks({
      diagram: candidateDiagram(),
      ledger: await seededLedger(),
      converter: {
        toXml: () => {
          throw new Error('tipo desconhecido');
        },
      },
    });
    const card = checks.find((c) => c.id === 'conformance')!;
    expect(card.ok).toBe(false);
    expect(card.detail).toBe('tipo desconhecido');
  });
});
