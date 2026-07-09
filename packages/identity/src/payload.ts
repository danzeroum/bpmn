import { canonicalJson } from '@bpmn-react/core';
import type { CanonicalApprovalPayload } from './types.js';

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
 * Deterministic bytes for signing/verification. Uses the same `canonicalJson`
 * as the attestation (Handoff 8 §3) so key ordering never changes the bytes,
 * then UTF-8 encodes. Signer.sign and verifySignature both operate on exactly
 * these bytes.
 */
export function encodePayload(payload: CanonicalApprovalPayload): Uint8Array {
  return new TextEncoder().encode(canonicalJson(payload));
}
