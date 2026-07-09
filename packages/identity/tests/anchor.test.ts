import { describe, expect, it } from 'vitest';
import { deriveAnchorState } from '../src/index.js';

/**
 * The third state (cerca §1.3) and "no anchor" (§1.4) must be first-class,
 * derived deterministically — never simulated.
 */
describe('deriveAnchorState', () => {
  it('no adapter → none (never simulate external proof, §1.4)', () => {
    expect(deriveAnchorState({ hasAdapter: false })).toBe('none');
    expect(deriveAnchorState({ hasAdapter: false, verification: 'anchored' })).toBe('none');
  });

  it('anchored verification → anchored', () => {
    expect(deriveAnchorState({ hasAdapter: true, verification: 'anchored' })).toBe('anchored');
  });

  it('mismatch → broken (cadeia ≠ âncora)', () => {
    expect(deriveAnchorState({ hasAdapter: true, verification: 'mismatch' })).toBe('broken');
  });

  it('unavailable or not-yet-anchored → pending (the third state, §1.3)', () => {
    expect(deriveAnchorState({ hasAdapter: true, verification: 'unavailable' })).toBe('pending');
    expect(deriveAnchorState({ hasAdapter: true })).toBe('pending');
  });
});
