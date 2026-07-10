import type { AnchorReceipt } from '@buildtovalue/identity';

/**
 * N-4 (Handoff 11): `ANCHOR_RECORDED` — the anchoring act as a FIRST-CLASS
 * ledger entry. The host appends this right after an AnchorAdapter produces a
 * receipt, so the trail itself shows when (and by which adapter) the chain
 * head was externally recorded. The Ledger Explorer categorizes it under
 * "Verificações" and its payload is enough to re-verify later.
 */
export const ANCHOR_RECORDED_TYPE = 'ANCHOR_RECORDED';

export function anchorRecordedEntry(
  receipt: AnchorReceipt,
  actor: { id: string },
): {
  type: string;
  userId: string;
  versionId: string;
  details: Record<string, unknown>;
} {
  return {
    type: ANCHOR_RECORDED_TYPE,
    userId: actor.id,
    versionId: `ledger-head-${receipt.head.seq}`,
    details: {
      adapterId: receipt.adapterId,
      headHash: receipt.head.hash,
      headSeq: receipt.head.seq,
      proof: receipt.proof,
      anchoredAt: receipt.anchoredAt,
    },
  };
}
