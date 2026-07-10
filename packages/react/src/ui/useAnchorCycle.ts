import { useCallback, useEffect, useState } from 'react';
import {
  deriveAnchorState,
  type AnchorAdapter,
  type AnchorHead,
  type AnchorReceipt,
  type AnchorState,
} from '@buildtovalue/identity';

export interface AnchorCycle {
  state: AnchorState;
  receipt?: AnchorReceipt;
  retrying: boolean;
  /** Re-attempt anchoring (the ↻ Retentar action). */
  retry: () => void;
}

/**
 * Drives the anchor third-state cycle (Handoff 8 §4.3, cerca §1.3): given an
 * injected {@link AnchorAdapter} and the head to anchor, it attempts to anchor
 * and verify. On a transport failure it lands in `pending` (does NOT throw, does
 * NOT regress) and exposes `retry`; on success `anchored`; on mismatch `broken`.
 * With no adapter or no head it stays `none`.
 */
export function useAnchorCycle(
  adapter: AnchorAdapter | undefined,
  head: AnchorHead | undefined,
): AnchorCycle {
  const [state, setState] = useState<AnchorState>(adapter ? 'pending' : 'none');
  const [receipt, setReceipt] = useState<AnchorReceipt>();
  const [retrying, setRetrying] = useState(false);

  const attempt = useCallback(async () => {
    if (!adapter || !head) {
      setState(deriveAnchorState({ hasAdapter: Boolean(adapter) }));
      return;
    }
    setRetrying(true);
    try {
      const produced = await adapter.anchor(head);
      const verification = await adapter.verify(produced, head.hash);
      setReceipt(produced);
      setState(deriveAnchorState({ hasAdapter: true, verification }));
    } catch {
      // Transport down: the third state — retry, never regress (§1.3).
      setState('pending');
    } finally {
      setRetrying(false);
    }
  }, [adapter, head]);

  useEffect(() => {
    void attempt();
  }, [attempt]);

  return { state, receipt, retrying, retry: () => void attempt() };
}
