import { describe, expect, it } from 'vitest';
import { AuditLedger, createDiagram } from '@bpmn-react/core';
import { buildApprovalPayload, signApproval, type Signer } from '@bpmn-react/identity';
import { buildAssuranceCase, renderAssuranceCaseHtml } from '../src/index.js';

async function makeSigner(subject: string, role: string) {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const signer: Signer = {
    identity: { subject, role, publicKeyFingerprint: `ed25519:${subject}` },
    sign: async (payload) => new Uint8Array(await crypto.subtle.sign('Ed25519', pair.privateKey, new Uint8Array(payload))),
  };
  return { signer, publicKey };
}

function diagramWith(role: string, userId: string) {
  const diagram = createDiagram({ name: 'Onboarding', id: 'onb' });
  diagram.version.id = 'v2';
  diagram.version.semanticVersion = '2.0.0';
  diagram.version.approvedBy = [{ userId, role, approvedAt: '2026-07-01T00:00:00Z', reason: 'ok' }];
  return diagram;
}

async function ledgerWithSignature(signer: Signer) {
  const ledger = new AuditLedger();
  const payload = buildApprovalPayload({
    diagramId: 'onb',
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
    versionId: 'v2',
    details: { role: signer.identity.role, signedApproval: signed },
  });
  return ledger;
}

const OPTS = { generatedAt: '2026-07-08T12:00:00Z' };

describe('SACM assinado (Handoff 8 §4.1/§4.2)', () => {
  it('shows a verified approver badge + fingerprint and an anchored footer line', async () => {
    const { signer, publicKey } = await makeSigner('carla@x', 'compliance');
    const ledger = await ledgerWithSignature(signer);
    const assurance = await buildAssuranceCase(diagramWith('compliance', 'carla@x'), ledger, {
      ...OPTS,
      resolvePublicKey: () => publicKey,
      anchor: { state: 'anchored', adapterId: 'git', head: 'abcdef0123456789' },
    });
    expect(assurance.signedApprovers[0]).toMatchObject({ role: 'compliance', state: 'valid' });
    expect(assurance.claims.find((c) => c.id === 'C1')?.supported).toBe(true);

    const html = renderAssuranceCaseHtml(assurance);
    expect(html).toMatch(/✓ carla@x \(compliance\) ed25519:#/);
    expect(html).toContain('data-audit-anchor');
    expect(html).toContain('ancorado: git · head #abcdef0');
  });

  it('an invalid signature un-sustains the formal-approval claim (§4.1)', async () => {
    const { signer } = await makeSigner('carla@x', 'compliance');
    const ledger = await ledgerWithSignature(signer);
    const { publicKey: wrongKey } = await makeSigner('mallory', 'compliance');
    const assurance = await buildAssuranceCase(diagramWith('compliance', 'carla@x'), ledger, {
      ...OPTS,
      resolvePublicKey: () => wrongKey,
    });
    expect(assurance.signedApprovers[0].state).toBe('invalid');
    expect(assurance.claims.find((c) => c.id === 'C1')?.supported).toBe(false);
    expect(renderAssuranceCaseHtml(assurance)).toContain('✕ carla@x (compliance)');
  });

  it('with a resolver, an approver whose role has no recorded signature stays legacy', async () => {
    const { signer, publicKey } = await makeSigner('carla@x', 'compliance');
    const ledger = await ledgerWithSignature(signer);
    const diagram = diagramWith('compliance', 'carla@x');
    diagram.version.approvedBy.push({
      userId: 'ana@x',
      role: 'architecture',
      approvedAt: '2026-07-02T00:00:00Z',
      reason: 'ok',
    });
    const assurance = await buildAssuranceCase(diagram, ledger, { ...OPTS, resolvePublicKey: () => publicKey });
    const byRole = Object.fromEntries(assurance.signedApprovers.map((a) => [a.role, a.state]));
    expect(byRole).toEqual({ compliance: 'valid', architecture: 'legacy' });
  });

  it('without a resolver, approvers read as legacy and no anchor line prints', async () => {
    const { signer } = await makeSigner('carla@x', 'compliance');
    const ledger = await ledgerWithSignature(signer);
    const assurance = await buildAssuranceCase(diagramWith('compliance', 'carla@x'), ledger, OPTS);
    expect(assurance.signedApprovers[0].state).toBe('legacy');
    expect(assurance.anchor).toBeUndefined();
    expect(renderAssuranceCaseHtml(assurance)).not.toContain('data-audit-anchor');
  });
});
