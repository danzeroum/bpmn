import type { AnchorAdapter, AnchorHead, AnchorReceipt } from '@bpmn-react/identity';

/**
 * S3 client the HOST injects — the library never does network. `put` writes the
 * anchor object (ideally to an object-lock/WORM bucket so it is write-once);
 * `get` reads it back, returning `undefined` when the object is unreachable.
 */
export interface S3Transport {
  put(key: string, body: string): Promise<{ versionId?: string }>;
  get(key: string): Promise<string | undefined>;
}

export interface S3AnchorOptions {
  /** Key prefix for anchor objects (default "anchors/"). */
  prefix?: string;
  /** Clock injection for a deterministic `anchoredAt` (defaults to Date). */
  now?: () => string;
}

function encodeHead(head: AnchorHead): string {
  return JSON.stringify({ hash: head.hash, seq: head.seq });
}

/**
 * An S3 object-lock {@link AnchorAdapter} (Handoff 8 §3): anchors the chain head
 * to a write-once object keyed by seq+hash.
 *
 * - unreachable object → `unavailable` (drives the `pending` third state);
 * - stored head === the passed current head → `anchored`;
 * - otherwise → `mismatch` (the chain was regenerated after anchoring).
 */
export function createS3Anchor(transport: S3Transport, options: S3AnchorOptions = {}): AnchorAdapter {
  const prefix = options.prefix ?? 'anchors/';
  const now = options.now ?? (() => new Date().toISOString());
  return {
    id: 's3',
    async anchor(head: AnchorHead): Promise<AnchorReceipt> {
      const key = `${prefix}${head.seq}-${head.hash}`;
      await transport.put(key, encodeHead(head));
      return { adapterId: 's3', head, proof: key, anchoredAt: now() };
    },
    async verify(receipt: AnchorReceipt, head: string): Promise<'anchored' | 'mismatch' | 'unavailable'> {
      let body: string | undefined;
      try {
        body = await transport.get(receipt.proof);
      } catch {
        return 'unavailable';
      }
      if (body === undefined) return 'unavailable';
      let stored: { hash?: string };
      try {
        stored = JSON.parse(body) as { hash?: string };
      } catch {
        return 'mismatch';
      }
      return stored.hash === head ? 'anchored' : 'mismatch';
    },
  };
}
