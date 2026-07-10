import type { AnchorAdapter, AnchorHead, AnchorReceipt } from '@buildtovalue/identity';

/**
 * RFC 3161 TSA transport the HOST injects — the library never talks to the TSA
 * over the network. `timestamp` requests a token over the head digest; `verify`
 * asks the host (or a local validator) whether a token attests the given digest.
 */
export interface Rfc3161Transport {
  timestamp(digest: string): Promise<{ token: string; genTime: string }>;
  verifyToken(token: string, digest: string): Promise<boolean>;
}

/**
 * An RFC 3161 timestamp {@link AnchorAdapter} (Handoff 8 §3): anchors the chain
 * head to a TSA timestamp token.
 *
 * - request/validation error → `unavailable` (drives the `pending` third state);
 * - token attests the current head digest → `anchored`;
 * - otherwise → `mismatch` (the head changed after timestamping).
 */
export function createRfc3161Anchor(transport: Rfc3161Transport): AnchorAdapter {
  return {
    id: 'rfc3161',
    async anchor(head: AnchorHead): Promise<AnchorReceipt> {
      const { token, genTime } = await transport.timestamp(head.hash);
      return { adapterId: 'rfc3161', head, proof: token, anchoredAt: genTime };
    },
    async verify(receipt: AnchorReceipt, head: string): Promise<'anchored' | 'mismatch' | 'unavailable'> {
      let ok: boolean;
      try {
        ok = await transport.verifyToken(receipt.proof, head);
      } catch {
        return 'unavailable';
      }
      return ok ? 'anchored' : 'mismatch';
    },
  };
}
