import { describe, expect, it } from 'vitest';
import { AuditLedger, LifecycleEngine, createDiagram, type UserContext } from '@buildtovalue/core';
import { buildApprovalPayload, signApproval, type SignedApproval, type Signer } from '@buildtovalue/identity';
import {
  collectSignedApprovals,
  signaturePromotionRule,
  verifyLedgerSignatures,
} from '../src/index.js';

async function makeSigner(subject: string, role: string): Promise<{ signer: Signer; publicKey: Uint8Array }> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const signer: Signer = {
    identity: { subject, role, publicKeyFingerprint: `ed25519:${subject}` },
    sign: async (payload) => new Uint8Array(await crypto.subtle.sign('Ed25519', pair.privateKey, new Uint8Array(payload))),
  };
  return { signer, publicKey };
}

async function recordSigned(ledger: AuditLedger, versionId: string, signer: Signer): Promise<SignedApproval> {
  const payload = buildApprovalPayload({
    diagramId: 'd',
    version: '2.0.0',
    xmlHash: 'h',
    ledgerHead: '',
    decision: 'approve',
    role: signer.identity.role,
  });
  const signed = await signApproval(signer, payload, '2026-07-09T00:00:00.000Z');
  await ledger.append({
    type: 'APPROVAL_RECORDED',
    userId: signer.identity.subject,
    versionId,
    details: { role: signer.identity.role, signedApproval: signed },
  });
  return signed;
}

function candidate(): ReturnType<typeof createDiagram> {
  const diagram = createDiagram({ name: 'Flow', id: 'd' });
  diagram.version.id = 'v2';
  diagram.version.status = 'candidate';
  diagram.version.semanticVersion = '2.0.0';
  diagram.version.changeSummary = 'A change summary long enough to promote.';
  diagram.version.approvedBy = [
    { userId: 'carla@x', role: 'compliance', approvedAt: '2026-07-01T00:00:00Z', reason: 'ok' },
  ];
  return diagram;
}

const actor: UserContext = { id: 'bruna', role: 'process-owner' };

describe('collectSignedApprovals + verifyLedgerSignatures', () => {
  it('collects recorded signatures and re-verifies them', async () => {
    const ledger = new AuditLedger();
    const { signer, publicKey } = await makeSigner('carla@x', 'compliance');
    await recordSigned(ledger, 'v2', signer);
    expect(collectSignedApprovals(ledger, 'v2')).toHaveLength(1);
    const report = await verifyLedgerSignatures(ledger, () => publicKey);
    expect(report).toMatchObject({ total: 1, valid: 1, invalid: 0 });
  });

  it('flags a tampered/unresolvable signature as invalid', async () => {
    const ledger = new AuditLedger();
    const { signer } = await makeSigner('carla@x', 'compliance');
    await recordSigned(ledger, 'v2', signer);
    const { publicKey: wrongKey } = await makeSigner('other', 'compliance');
    const report = await verifyLedgerSignatures(ledger, () => wrongKey);
    expect(report.invalid).toBe(1);
  });

  it('a missing public key cannot be proven → invalid, never trusted', async () => {
    const ledger = new AuditLedger();
    const { signer } = await makeSigner('carla@x', 'compliance');
    await recordSigned(ledger, 'v2', signer);
    const report = await verifyLedgerSignatures(ledger, () => undefined);
    expect(report).toMatchObject({ total: 1, valid: 0, invalid: 1 });
  });

  it('scans the whole ledger and ignores entries without a signature', async () => {
    const ledger = new AuditLedger();
    await ledger.append({ type: 'NODE_ADDED', userId: 'ana', versionId: 'v2', details: { nodeId: 'n1' } });
    const { signer } = await makeSigner('carla@x', 'compliance');
    await recordSigned(ledger, 'v2', signer);
    // No versionId filter → still exactly one signature found.
    expect(collectSignedApprovals(ledger)).toHaveLength(1);
  });
});

describe('signaturePromotionRule (Handoff 8 §4.4)', () => {
  it('blocks activation until the approving role has a valid signature', async () => {
    const ledger = new AuditLedger();
    const { signer, publicKey } = await makeSigner('carla@x', 'compliance');
    const rule = signaturePromotionRule({ ledger, resolvePublicKey: () => publicKey });
    const engine = new LifecycleEngine({ minApprovalRoles: 1, promotionRules: [rule] });
    const diagram = candidate();

    // No signature recorded yet → the gate blocks.
    const before = await engine.evaluateGates({ diagram, target: 'active', actor, reason: diagram.version.changeSummary });
    const gate = before.find((g) => g.id.startsWith('rule:'))!;
    expect(gate.satisfied).toBe(false);
    expect(gate.detail).toContain('assinatura válida');

    // Record a valid signature for the compliance role → the gate passes.
    await recordSigned(ledger, 'v2', signer);
    const after = await engine.evaluateGates({ diagram, target: 'active', actor, reason: diagram.version.changeSummary });
    expect(after.find((g) => g.id.startsWith('rule:'))!.satisfied).toBe(true);
  });

  it('never gates non-active transitions', async () => {
    const ledger = new AuditLedger();
    const { publicKey } = await makeSigner('x', 'compliance');
    const rule = signaturePromotionRule({ ledger, resolvePublicKey: () => publicKey });
    expect(await rule({ diagram: candidate(), target: 'test', actor, reason: 'r' })).toEqual({ allowed: true });
  });

  it('honors explicit requiredRoles and the English locale', async () => {
    const ledger = new AuditLedger();
    const { publicKey } = await makeSigner('x', 'compliance');
    const rule = signaturePromotionRule({
      ledger,
      resolvePublicKey: () => publicKey,
      requiredRoles: ['legal'],
      locale: 'en',
    });
    const verdict = await rule({ diagram: candidate(), target: 'active', actor, reason: 'r' });
    expect(verdict).toEqual({
      allowed: false,
      reason: 'Approvals require a valid signature — missing: legal',
    });
  });
});
