import type { AuditEntry, PromotionRule } from '@bpmn-react/core';
import { verificationState, type SignedApproval, type VerificationState } from '@bpmn-react/identity';
import type { LedgerLike } from './verify.js';

/**
 * Signature layer over the ledger (Handoff 8 I-5). Approvals are signed in the
 * UI (I-2) and the `SignedApproval` is persisted in the recording entry's
 * `details.signedApproval` — so it joins the hash-chain. This module reads those
 * back, re-verifies them, and exposes the optional promotion gate. Verification
 * is OFFLINE via `@bpmn-react/identity`; the public key is resolved by the host.
 */

/** Resolves a public key for a signer fingerprint (host-provided). */
export type PublicKeyResolver = (
  fingerprint: string,
) => Uint8Array | Promise<Uint8Array | undefined> | undefined;

export interface SignedApprovalVerification {
  approval: SignedApproval;
  state: VerificationState;
}

export interface LedgerSignatureReport {
  total: number;
  valid: number;
  invalid: number;
  results: SignedApprovalVerification[];
}

function entriesOf(ledger: LedgerLike): readonly AuditEntry[] {
  return 'getEntries' in ledger ? ledger.getEntries() : ledger.entries;
}

/**
 * Collect every `SignedApproval` recorded in the ledger (optionally scoped to a
 * version). Reads `details.signedApproval` — the same slot `approvePromotion`
 * writes (I-2), so it never depends on a specific entry-type constant.
 */
export function collectSignedApprovals(ledger: LedgerLike, versionId?: string): SignedApproval[] {
  const out: SignedApproval[] = [];
  for (const entry of entriesOf(ledger)) {
    if (versionId && entry.versionId !== versionId) continue;
    const signed = (entry.details as { signedApproval?: SignedApproval }).signedApproval;
    if (signed && typeof signed === 'object' && typeof signed.signature === 'string') {
      out.push(signed);
    }
  }
  return out;
}

/** Re-verify every recorded signature against host-resolved public keys. */
export async function verifyLedgerSignatures(
  ledger: LedgerLike,
  resolvePublicKey: PublicKeyResolver,
): Promise<LedgerSignatureReport> {
  const signed = collectSignedApprovals(ledger);
  const results = await Promise.all(
    signed.map(async (approval): Promise<SignedApprovalVerification> => {
      const publicKey = await resolvePublicKey(approval.signer.publicKeyFingerprint);
      return { approval, state: await verificationState(approval, publicKey ?? undefined) };
    }),
  );
  return {
    total: results.length,
    valid: results.filter((r) => r.state === 'valid').length,
    invalid: results.filter((r) => r.state === 'invalid').length,
    results,
  };
}

export interface SignatureGateOptions {
  ledger: LedgerLike;
  resolvePublicKey: PublicKeyResolver;
  /**
   * Roles that must carry a valid signature. Defaults to the version's distinct
   * approver roles — so the gate says "the roles that approved must have signed".
   */
  requiredRoles?: string[];
  locale?: 'pt' | 'en';
}

/**
 * Optional promotion gate (Handoff 8 §4.4): "aprovações exigem assinatura
 * válida". Drop it into `lifecycleConfig.promotionRules` — ON by default when
 * the host wires identity (i.e. when it injects this rule). Only gates
 * promotion to `active`; a role with no VALID signature blocks activation.
 */
export function signaturePromotionRule(options: SignatureGateOptions): PromotionRule {
  return async ({ diagram, target }) => {
    if (target !== 'active') return { allowed: true };
    const signed = collectSignedApprovals(options.ledger, diagram.version.id);
    const validRoles = new Set<string>();
    for (const approval of signed) {
      const publicKey = await options.resolvePublicKey(approval.signer.publicKeyFingerprint);
      if ((await verificationState(approval, publicKey ?? undefined)) === 'valid') {
        validRoles.add(approval.payload.role);
      }
    }
    const required =
      options.requiredRoles ?? [...new Set(diagram.version.approvedBy.map((a) => a.role))];
    const missing = required.filter((role) => !validRoles.has(role));
    if (missing.length === 0) return { allowed: true };
    return {
      allowed: false,
      reason:
        options.locale === 'en'
          ? `Approvals require a valid signature — missing: ${missing.join(', ')}`
          : `Aprovações exigem assinatura válida — faltam: ${missing.join(', ')}`,
    };
  };
}
