import { describe, expect, it } from 'vitest';
import { createS3Anchor, type S3Transport } from '../src/index.js';

const HEAD = { hash: 'abcd1234', seq: 5 };

function fakeS3(): S3Transport & { store: Map<string, string>; fail: boolean } {
  const store = new Map<string, string>();
  const t = {
    store,
    fail: false,
    async put(key: string, body: string) {
      store.set(key, body);
      return { versionId: `v-${store.size}` };
    },
    async get(key: string) {
      if (t.fail) throw new Error('s3 unreachable');
      return store.get(key);
    },
  };
  return t;
}

describe('createS3Anchor', () => {
  it('anchors under the prefixed seq-hash key with the injected clock', async () => {
    const s3 = fakeS3();
    const anchor = createS3Anchor(s3, { now: () => '2026-07-09T00:00:00.000Z' });
    const receipt = await anchor.anchor(HEAD);
    expect(receipt).toMatchObject({ adapterId: 's3', head: HEAD, proof: 'anchors/5-abcd1234' });
    expect(receipt.anchoredAt).toBe('2026-07-09T00:00:00.000Z');
    expect(s3.store.get('anchors/5-abcd1234')).toContain('abcd1234');
  });

  it('honors a custom prefix', async () => {
    const s3 = fakeS3();
    const receipt = await createS3Anchor(s3, { prefix: 'worm/' }).anchor(HEAD);
    expect(receipt.proof).toBe('worm/5-abcd1234');
  });

  it('verifies anchored, mismatch and unavailable', async () => {
    const s3 = fakeS3();
    const anchor = createS3Anchor(s3);
    const receipt = await anchor.anchor(HEAD);
    expect(await anchor.verify(receipt, 'abcd1234')).toBe('anchored');
    expect(await anchor.verify(receipt, 'ffff0000')).toBe('mismatch');
    s3.fail = true;
    expect(await anchor.verify(receipt, 'abcd1234')).toBe('unavailable');
  });

  it('unavailable when the object is missing; mismatch when corrupt', async () => {
    const s3 = fakeS3();
    const anchor = createS3Anchor(s3);
    const receipt = await anchor.anchor(HEAD);
    s3.store.delete(receipt.proof);
    expect(await anchor.verify(receipt, 'abcd1234')).toBe('unavailable');
    s3.store.set(receipt.proof, 'not json');
    expect(await anchor.verify(receipt, 'abcd1234')).toBe('mismatch');
  });
});
