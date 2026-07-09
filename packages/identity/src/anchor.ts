import type { AnchorState } from './types.js';

/**
 * Derive the UI anchor state (Handoff 8 §3, cercas §1.3/§1.4) from whether an
 * adapter is configured and the raw `verify` outcome. Pure and deterministic.
 *
 * - no adapter → `none` (never simulate external proof — §1.4).
 * - `anchored` → `anchored`.
 * - `mismatch` → `broken` (local head ≠ anchored head — the case hash-chain
 *   alone never detects).
 * - `unavailable` / not yet anchored → `pending`, the third state: the promotion
 *   does NOT regress; the seal declares the guarantee in force (§1.3).
 */
export function deriveAnchorState(input: {
  hasAdapter: boolean;
  verification?: 'anchored' | 'mismatch' | 'unavailable';
}): AnchorState {
  if (!input.hasAdapter) return 'none';
  if (input.verification === 'anchored') return 'anchored';
  if (input.verification === 'mismatch') return 'broken';
  return 'pending';
}
