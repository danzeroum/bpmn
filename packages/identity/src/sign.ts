import { toBase64 } from './base64.js';
import { encodePayload } from './payload.js';
import type { CanonicalApprovalPayload, SignedApproval, Signer } from './types.js';

/**
 * Sign an approval payload using a host-injected {@link Signer} (cerca §1.1 —
 * the private key never enters this library; only the payload bytes cross the
 * `sign` boundary). `signedAt` is passed in rather than read from the clock so
 * signing is deterministic and testable.
 */
export async function signApproval(
  signer: Signer,
  payload: CanonicalApprovalPayload,
  signedAt: string,
): Promise<SignedApproval> {
  const signature = await signer.sign(encodePayload(payload));
  return {
    payload,
    signature: toBase64(signature),
    signer: signer.identity,
    signedAt,
  };
}
