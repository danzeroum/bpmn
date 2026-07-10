import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AnchorAdapter } from '@buildtovalue/identity';
import { useAnchorCycle } from '../src/index.js';

const HEAD = { hash: 'aaaa1111', seq: 3 };

function okAdapter(verify: 'anchored' | 'mismatch' | 'unavailable' = 'anchored'): AnchorAdapter {
  return {
    id: 'git',
    anchor: async (head) => ({ adapterId: 'git', head, proof: 'p', anchoredAt: 't' }),
    verify: async () => verify,
  };
}

describe('useAnchorCycle (the third-state machine)', () => {
  it('no adapter → none', async () => {
    const { result } = renderHook(() => useAnchorCycle(undefined, HEAD));
    await waitFor(() => expect(result.current.state).toBe('none'));
  });

  it('success → anchored, with a receipt', async () => {
    const { result } = renderHook(() => useAnchorCycle(okAdapter(), HEAD));
    await waitFor(() => expect(result.current.state).toBe('anchored'));
    expect(result.current.receipt?.head).toEqual(HEAD);
  });

  it('mismatch → broken', async () => {
    const { result } = renderHook(() => useAnchorCycle(okAdapter('mismatch'), HEAD));
    await waitFor(() => expect(result.current.state).toBe('broken'));
  });

  it('transport failure → pending, then anchored on retry (§1.3, never regresses)', async () => {
    let failNext = true;
    const adapter: AnchorAdapter = {
      id: 'git',
      anchor: async (head) => {
        if (failNext) {
          failNext = false;
          throw new Error('git down');
        }
        return { adapterId: 'git', head, proof: 'p', anchoredAt: 't' };
      },
      verify: async () => 'anchored',
    };
    const { result } = renderHook(() => useAnchorCycle(adapter, HEAD));
    await waitFor(() => expect(result.current.state).toBe('pending'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state).toBe('anchored'));
  });
});
