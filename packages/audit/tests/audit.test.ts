import { beforeEach, describe, expect, it } from 'vitest';
import {
  AuditLedger,
  computeDiagramHash,
  createDiagram,
  createNode,
  type AuditEntry,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { VersionRegistry } from '@buildtovalue/registry';
import {
  attestationHash,
  attestVersion,
  canonicalAttestation,
  verifyLedger,
} from '../src/index.js';

async function populatedLedger(): Promise<AuditLedger> {
  const ledger = new AuditLedger();
  await ledger.append({ type: 'NODE_ADDED', userId: 'ana', versionId: 'v1', details: { nodeId: 'a' } });
  await ledger.append({ type: 'EDGE_ADDED', userId: 'bia', versionId: 'v1', details: { edgeId: 'e1' } });
  await ledger.append({ type: 'VERSION_ACTIVATED', userId: 'ana', versionId: 'v1', details: {} });
  return ledger;
}

describe('verifyLedger (aceite B1)', () => {
  it('reports an intact chain with the entry count', async () => {
    const report = await verifyLedger(await populatedLedger());
    expect(report.intact).toBe(true);
    expect(report.entries).toBe(3);
    expect(report.firstBreak).toBeUndefined();
    expect(Date.parse(report.verifiedAt)).not.toBeNaN();
  });

  it('detects a single tampered byte and points at the exact index', async () => {
    const ledger = await populatedLedger();
    // Export → tamper 1 byte inside entry #1's details → re-verify.
    const exported = ledger.export();
    const tampered: AuditEntry[] = structuredClone(exported.entries);
    tampered[1] = { ...tampered[1], details: { edgeId: 'e2' } }; // '1' → '2'
    const report = await verifyLedger({ entries: tampered });
    expect(report.intact).toBe(false);
    expect(report.firstBreak?.index).toBe(1);
    // The recomputed (expected) hash no longer matches the recorded one.
    expect(report.firstBreak?.actual).toBe(tampered[1].hash);
    expect(report.firstBreak?.expected).not.toBe(tampered[1].hash);
  });

  it('detects a broken previous-hash link', async () => {
    const ledger = await populatedLedger();
    const entries: AuditEntry[] = structuredClone([...ledger.getEntries()]);
    entries[2] = { ...entries[2], previousHash: 'f'.repeat(64) };
    const report = await verifyLedger({ entries });
    expect(report.intact).toBe(false);
    expect(report.firstBreak?.index).toBe(2);
    expect(report.firstBreak?.actual).toBe('f'.repeat(64));
  });

  it('accepts an empty exported ledger', async () => {
    const report = await verifyLedger({ entries: [] });
    expect(report).toMatchObject({ intact: true, entries: 0 });
  });
});

describe('attestVersion (aceite B2 — determinismo)', () => {
  let registry: VersionRegistry;
  let diagram: BpmnDiagram;

  beforeEach(async () => {
    registry = new VersionRegistry();
    diagram = createDiagram({ name: 'Billing', id: 'billing' });
    diagram.nodes = {
      start: createNode({ type: 'startEvent', id: 'start', x: 0, y: 0 }),
    };
    diagram.version = {
      id: 'v42',
      semanticVersion: '4.2.0',
      status: 'active',
      approvedBy: [
        { userId: 'ana', role: 'Owner', approvedAt: '2026-05-01T10:00:00.000Z', reason: 'ok' },
        { userId: 'bia', role: 'Compliance', approvedAt: '2026-05-01T11:00:00.000Z', reason: 'ok' },
      ],
      changeSummary: 'Initial billing process modelling.',
      createdBy: 'ana',
      createdAt: '2026-05-01T09:00:00.000Z',
      snapshotHash: '',
      effectiveFrom: '2026-05-02T00:00:00.000Z',
    };
    diagram.version.snapshotHash = await computeDiagramHash(diagram);
    await registry.register(diagram);
  });

  it('captures xmlHash, ledger head, window and approvers', async () => {
    const ledger = await populatedLedger();
    const attestation = await attestVersion(registry, 'billing', 'v42', { ledger });
    expect(attestation.diagramId).toBe('billing');
    expect(attestation.semanticVersion).toBe('4.2.0');
    expect(attestation.status).toBe('active');
    expect(attestation.effectiveFrom).toBe('2026-05-02T00:00:00.000Z');
    expect(attestation.xmlHash).toMatch(/^[0-9a-f]{64}$/);
    const head = ledger.getEntries()[2].hash;
    expect(attestation.ledgerHeadHash).toBe(head);
    expect(attestation.approvers.map((a) => a.role).sort()).toEqual(['Compliance', 'Owner']);
  });

  it('is deterministic: same input → same canonical JSON → same hash', async () => {
    const at = '2026-05-02T12:00:00.000Z';
    const first = await attestVersion(registry, 'billing', 'v42', { attestedAt: at });
    const second = await attestVersion(registry, 'billing', 'v42', { attestedAt: at });
    expect(canonicalAttestation(first)).toBe(canonicalAttestation(second));
    expect(await attestationHash(first)).toBe(await attestationHash(second));
  });

  it('rejects unknown versions and diagram mismatches', async () => {
    await expect(attestVersion(registry, 'billing', 'ghost')).rejects.toThrow('not registered');
    await expect(attestVersion(registry, 'other-diagram', 'v42')).rejects.toThrow(
      'belongs to diagram billing',
    );
  });

  it('anchors to an empty ledger with an empty head hash', async () => {
    const attestation = await attestVersion(registry, 'billing', 'v42');
    expect(attestation.ledgerHeadHash).toBe('');
  });
});
