import { fromBase64 } from './base64.js';
import { encodePayload } from './payload.js';
import type { SignedApproval, VerificationState } from './types.js';

const ED25519 = 'Ed25519';

/**
 * Verify an approval's Ed25519 signature against a raw 32-byte public key, via
 * WebCrypto (`crypto.subtle`). Runs entirely OFFLINE — no network — so a third
 * party can verify with only the public key (Handoff 8 §6.1).
 *
 * Returns `invalid` (never throws) when the payload was altered, the wrong key
 * was supplied, or the key/signature is malformed — the negative path is a
 * first-class result, not an exception.
 */
export async function verifySignature(
  approval: SignedApproval,
  publicKey: Uint8Array,
): Promise<Extract<VerificationState, 'valid' | 'invalid'>> {
  try {
    // Copy into fresh ArrayBuffer-backed views so the args satisfy `BufferSource`
    // regardless of the caller's backing buffer (e.g. SharedArrayBuffer).
    const key = await crypto.subtle.importKey('raw', new Uint8Array(publicKey), { name: ED25519 }, false, [
      'verify',
    ]);
    const ok = await crypto.subtle.verify(
      ED25519,
      key,
      new Uint8Array(fromBase64(approval.signature)),
      new Uint8Array(encodePayload(approval.payload)),
    );
    return ok ? 'valid' : 'invalid';
  } catch {
    return 'invalid';
  }
}

/**
 * True when an approval carries no signature — pre-Handoff-8 history. Cerca
 * §1.5: legacy entries declare the lesser guarantee ("não assinada · legado");
 * they are never signed retroactively.
 */
export function isLegacyApproval(approval: SignedApproval | null | undefined): boolean {
  return !approval || !approval.signature;
}

/**
 * Resolve the three-state verification outcome (Handoff 8 §4.1). Returns
 * `legacy` for unsigned/absent approvals (cerca §1.5); otherwise delegates to
 * {@link verifySignature}. A signed approval with no public key available
 * cannot be proven and reads as `invalid`, never silently trusted.
 */
export async function verificationState(
  approval: SignedApproval | null | undefined,
  publicKey: Uint8Array | null | undefined,
): Promise<VerificationState> {
  if (isLegacyApproval(approval)) return 'legacy';
  if (!publicKey) return 'invalid';
  return verifySignature(approval as SignedApproval, publicKey);
}
