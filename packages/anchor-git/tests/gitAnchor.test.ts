import { describe, expect, it } from 'vitest';
import { createGitAnchor, type GitAnchorTransport } from '../src/index.js';

/** In-memory fake git store — stands in for the host's injected transport. */
function fakeTransport(): GitAnchorTransport & { store: Map<string, string>; fail: boolean } {
  const store = new Map<string, string>();
  let counter = 0;
  const t = {
    store,
    fail: false,
    async commit(payload: string) {
      const ref = `commit-${counter++}`;
      store.set(ref, payload);
      return { ref };
    },
    async read(ref: string) {
      if (t.fail) throw new Error('git unavailable');
      return store.get(ref);
    },
  };
  return t;
}

const HEAD = { hash: 'aaaa1111', seq: 3 };

describe('createGitAnchor', () => {
  it('anchors a head and produces a receipt with the injected timestamp', async () => {
    const transport = fakeTransport();
    const anchor = createGitAnchor(transport, { now: () => '2026-07-09T00:00:00.000Z' });
    const receipt = await anchor.anchor(HEAD);
    expect(receipt).toMatchObject({ adapterId: 'git', head: HEAD, anchoredAt: '2026-07-09T00:00:00.000Z' });
    expect(receipt.proof).toBe('commit-0');
    expect(transport.store.get('commit-0')).toContain('aaaa1111');
  });

  it('verifies as anchored when the current head still matches', async () => {
    const transport = fakeTransport();
    const anchor = createGitAnchor(transport);
    const receipt = await anchor.anchor(HEAD);
    expect(await anchor.verify(receipt, 'aaaa1111')).toBe('anchored');
  });

  it('reports mismatch when the chain was regenerated (head at seq changed)', async () => {
    const transport = fakeTransport();
    const anchor = createGitAnchor(transport);
    const receipt = await anchor.anchor(HEAD);
    expect(await anchor.verify(receipt, 'bbbb2222')).toBe('mismatch');
  });

  it('reports unavailable when the store is unreachable (drives the pending state)', async () => {
    const transport = fakeTransport();
    const anchor = createGitAnchor(transport);
    const receipt = await anchor.anchor(HEAD);
    transport.fail = true;
    expect(await anchor.verify(receipt, 'aaaa1111')).toBe('unavailable');
  });

  it('reports unavailable when the ref is missing', async () => {
    const transport = fakeTransport();
    const anchor = createGitAnchor(transport);
    const receipt = await anchor.anchor(HEAD);
    transport.store.clear();
    expect(await anchor.verify(receipt, 'aaaa1111')).toBe('unavailable');
  });

  it('reports mismatch when the stored payload is corrupt', async () => {
    const transport = fakeTransport();
    const anchor = createGitAnchor(transport);
    const receipt = await anchor.anchor(HEAD);
    transport.store.set(receipt.proof, 'not json');
    expect(await anchor.verify(receipt, 'aaaa1111')).toBe('mismatch');
  });
});
