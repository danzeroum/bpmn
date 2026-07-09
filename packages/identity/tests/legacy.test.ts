import { describe, expect, it } from 'vitest';
import { isLegacyApproval, verificationState, type SignedApproval } from '../src/index.js';

/**
 * Cerca §1.5 / aceite #4, #7 — legacy history is never rewritten. An approval
 * with no signature (pre-Handoff-8) resolves to `legacy`, declaring the lesser
 * guarantee; there is no code path that signs it retroactively.
 */
const UNSIGNED = {
  payload: {
    diagramId: 'd1',
    version: '1.0.0',
    xmlHash: 'x',
    ledgerHead: 'h',
    decision: 'approve',
    role: 'compliance',
  },
  signature: '',
  signer: { subject: 'legacy', role: 'compliance', publicKeyFingerprint: '' },
  signedAt: '2025-01-01T00:00:00.000Z',
} satisfies SignedApproval;

describe('legacy (unsigned) approvals', () => {
  it('isLegacyApproval is true for absent or empty-signature approvals', () => {
    expect(isLegacyApproval(undefined)).toBe(true);
    expect(isLegacyApproval(null)).toBe(true);
    expect(isLegacyApproval(UNSIGNED)).toBe(true);
  });

  it('verificationState resolves legacy without needing a public key', async () => {
    expect(await verificationState(UNSIGNED, undefined)).toBe('legacy');
    expect(await verificationState(null, undefined)).toBe('legacy');
  });

  it('a signed approval with no public key available reads as invalid, never trusted', async () => {
    const signed: SignedApproval = { ...UNSIGNED, signature: 'AAAA' };
    expect(await verificationState(signed, undefined)).toBe('invalid');
  });
});
