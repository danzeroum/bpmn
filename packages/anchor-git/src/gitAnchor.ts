import type { AnchorAdapter, AnchorHead, AnchorReceipt } from '@buildtovalue/identity';

/**
 * Git transport the HOST injects (cerca §1.1 analogue for anchors — the library
 * never shells out to git nor does network). `commit` writes the anchor payload
 * (e.g. to a signed commit on an `anchors` ref) and returns a stable ref; `read`
 * reads it back, returning `undefined` when the store is unreachable.
 */
export interface GitAnchorTransport {
  commit(payload: string): Promise<{ ref: string }>;
  read(ref: string): Promise<string | undefined>;
}

export interface GitAnchorOptions {
  /** Clock injection for a deterministic `anchoredAt` (defaults to Date). */
  now?: () => string;
}

/** Serialize the head deterministically for the external store. */
function encodeHead(head: AnchorHead): string {
  return JSON.stringify({ hash: head.hash, seq: head.seq });
}

/**
 * A git {@link AnchorAdapter} (Handoff 8 §3): anchors the chain head to a commit
 * via the injected transport and verifies a receipt against a current head hash.
 *
 * `verify` reads the externally-stored head back through the transport:
 * - unreachable store → `unavailable` (drives the `pending` third state, §1.3);
 * - stored head === the passed current head → `anchored`;
 * - otherwise → `mismatch` (the chain was regenerated after anchoring — §4.2,
 *   the case a local hash-chain alone never detects).
 *
 * The caller passes the CURRENT hash of the entry at `receipt.head.seq`, so a
 * chain that merely grew still verifies, while a rewritten one mismatches.
 */
export function createGitAnchor(
  transport: GitAnchorTransport,
  options: GitAnchorOptions = {},
): AnchorAdapter {
  const now = options.now ?? (() => new Date().toISOString());
  return {
    id: 'git',
    async anchor(head: AnchorHead): Promise<AnchorReceipt> {
      const { ref } = await transport.commit(encodeHead(head));
      return { adapterId: 'git', head, proof: ref, anchoredAt: now() };
    },
    async verify(receipt: AnchorReceipt, head: string): Promise<'anchored' | 'mismatch' | 'unavailable'> {
      let payload: string | undefined;
      try {
        payload = await transport.read(receipt.proof);
      } catch {
        return 'unavailable';
      }
      if (payload === undefined) return 'unavailable';
      let stored: { hash?: string };
      try {
        stored = JSON.parse(payload) as { hash?: string };
      } catch {
        return 'mismatch';
      }
      return stored.hash === head ? 'anchored' : 'mismatch';
    },
  };
}
