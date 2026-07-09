import { describe, expect, it } from 'vitest';
import { createRfc3161Anchor, type Rfc3161Transport } from '../src/index.js';

const HEAD = { hash: 'deadbeef', seq: 7 };

/** Fake TSA: mints a token bound to the digest; verifies by that binding. */
function fakeTsa(overrides: Partial<Rfc3161Transport> = {}): Rfc3161Transport {
  return {
    timestamp: async (digest) => ({ token: `tsa(${digest})`, genTime: '2026-07-09T12:00:00Z' }),
    verifyToken: async (token, digest) => token === `tsa(${digest})`,
    ...overrides,
  };
}

describe('createRfc3161Anchor', () => {
  it('anchors with the TSA genTime and a token proof', async () => {
    const receipt = await createRfc3161Anchor(fakeTsa()).anchor(HEAD);
    expect(receipt).toMatchObject({
      adapterId: 'rfc3161',
      head: HEAD,
      proof: 'tsa(deadbeef)',
      anchoredAt: '2026-07-09T12:00:00Z',
    });
  });

  it('verifies anchored when the token attests the current head', async () => {
    const anchor = createRfc3161Anchor(fakeTsa());
    const receipt = await anchor.anchor(HEAD);
    expect(await anchor.verify(receipt, 'deadbeef')).toBe('anchored');
  });

  it('mismatch when the head changed after timestamping', async () => {
    const anchor = createRfc3161Anchor(fakeTsa());
    const receipt = await anchor.anchor(HEAD);
    expect(await anchor.verify(receipt, 'cafe0000')).toBe('mismatch');
  });

  it('unavailable when the validator throws (TSA down)', async () => {
    const anchor = createRfc3161Anchor(
      fakeTsa({
        verifyToken: async () => {
          throw new Error('TSA unreachable');
        },
      }),
    );
    const receipt = await anchor.anchor(HEAD);
    expect(await anchor.verify(receipt, 'deadbeef')).toBe('unavailable');
  });
});
