import { describe, expect, it } from 'vitest';
import { canonicalJson } from '@buildtovalue/core';
import {
  buildApprovalPayload,
  encodePayload,
  signApproval,
  verificationState,
  verifySignature,
  type CanonicalApprovalPayload,
  type Signer,
} from '../src/index.js';

/**
 * End-to-end sign → verify → invalidate (aceite #1, #7). The key pair is
 * generated HERE, in the test only — never in the library (cerca §1.1). The
 * library sees only the host-shaped {@link Signer} handle and a raw public key.
 */
async function makeSigner(role: string): Promise<{ signer: Signer; publicKey: Uint8Array }> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const signer: Signer = {
    identity: { subject: 'marta.costa@empresa.com.br', role, publicKeyFingerprint: 'ed25519:test' },
    sign: async (payload) =>
      new Uint8Array(await crypto.subtle.sign('Ed25519', pair.privateKey, new Uint8Array(payload))),
  };
  return { signer, publicKey };
}

const BASE: CanonicalApprovalPayload = {
  diagramId: 'onboarding',
  version: '2.1.0',
  xmlHash: 'sha256-abc',
  ledgerHead: 'head-123',
  decision: 'approve',
  role: 'compliance',
};

describe('sign → verify round-trip', () => {
  it('a freshly signed approval verifies as valid', async () => {
    const { signer, publicKey } = await makeSigner('compliance');
    const approval = await signApproval(signer, buildApprovalPayload(BASE), '2026-07-09T10:00:00.000Z');

    expect(approval.signer.subject).toBe('marta.costa@empresa.com.br');
    expect(approval.payload).toEqual(BASE);
    expect(await verifySignature(approval, publicKey)).toBe('valid');
    expect(await verificationState(approval, publicKey)).toBe('valid');
  });

  it.each(['xmlHash', 'ledgerHead', 'decision', 'role', 'version', 'diagramId'] as const)(
    'tampering %s after signing yields invalid',
    async (field) => {
      const { signer, publicKey } = await makeSigner('compliance');
      const approval = await signApproval(signer, buildApprovalPayload(BASE), '2026-07-09T10:00:00.000Z');

      const tampered = {
        ...approval,
        payload: { ...approval.payload, [field]: approval.payload[field] + '-x' },
      };
      expect(await verifySignature(tampered, publicKey)).toBe('invalid');
      expect(await verificationState(tampered, publicKey)).toBe('invalid');
    },
  );

  it('a different public key yields invalid', async () => {
    const { signer } = await makeSigner('compliance');
    const { publicKey: otherKey } = await makeSigner('compliance');
    const approval = await signApproval(signer, buildApprovalPayload(BASE), '2026-07-09T10:00:00.000Z');
    expect(await verifySignature(approval, otherKey)).toBe('invalid');
  });

  it('encodePayload is deterministic regardless of key order', () => {
    const reordered: CanonicalApprovalPayload = {
      role: BASE.role,
      decision: BASE.decision,
      ledgerHead: BASE.ledgerHead,
      xmlHash: BASE.xmlHash,
      version: BASE.version,
      diagramId: BASE.diagramId,
    };
    expect(encodePayload(reordered)).toEqual(encodePayload(BASE));
  });

  it('encodePayload bytes match the legacy canonicalJson encoding (string-only payloads)', () => {
    // The switch to canonicalJsonExact must not change the signed bytes for
    // existing approvals — every payload field is a string, so rounding never
    // applied. This pins that byte-for-byte compatibility.
    const legacyBytes = new TextEncoder().encode(canonicalJson(BASE));
    expect(encodePayload(BASE)).toEqual(legacyBytes);
  });
});
