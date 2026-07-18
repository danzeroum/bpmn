import { canonicalJsonExact } from '@buildtovalue/core';
import type { CanonicalApprovalPayload, CanonicalChangeRequestPayload } from './types.js';

/**
 * Build the canonical payload an approval signature covers (Handoff 8 §3). The
 * signature binds `xmlHash + ledgerHead + decision + role` (plus the artifact
 * identity), so any later mutation of those is detectable on verification.
 */
export function buildApprovalPayload(input: CanonicalApprovalPayload): CanonicalApprovalPayload {
  return {
    diagramId: input.diagramId,
    version: input.version,
    xmlHash: input.xmlHash,
    ledgerHead: input.ledgerHead,
    decision: input.decision,
    role: input.role,
  };
}

/**
 * Build the canonical payload a request-changes signature covers (Handoff 15
 * §2e — same discipline as {@link buildApprovalPayload}): the approval fields
 * plus versionRef + attached open threadRefs + the mandatory justification.
 * `threadRefs` is sorted so the bytes never depend on collection order.
 */
export function buildChangeRequestPayload(
  input: CanonicalChangeRequestPayload,
): CanonicalChangeRequestPayload {
  return {
    ...buildApprovalPayload(input),
    versionRef: input.versionRef,
    threadRefs: [...input.threadRefs].sort(),
    justification: input.justification,
  };
}

/**
 * Deterministic bytes for signing/verification. Uses `canonicalJsonExact`
 * (key ordering never changes the bytes; numbers are never rounded), then
 * UTF-8 encodes. Signer.sign and verifySignature both operate on exactly
 * these bytes. All payload fields are strings, so the bytes are identical to
 * the ones the previous `canonicalJson` produced — existing signatures keep
 * verifying.
 */
export function encodePayload(payload: CanonicalApprovalPayload): Uint8Array {
  return new TextEncoder().encode(canonicalJsonExact(payload));
}
