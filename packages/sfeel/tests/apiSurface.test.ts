import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Freezes the runtime public API surface of @buildtovalue/sfeel (type-only
 * exports are erased and never appear here). Adding an export means updating
 * this list; renaming/removing one is a breaking change.
 */
const EXPECTED_EXPORTS = [
  'SIMULABLE_HIT_POLICIES',
  'checkOutputCell',
  'checkTable',
  'checkUnaryCell',
  'evaluate',
  'isIrrelevant',
  'parseOutputLiteral',
  'parseUnaryTests',
].sort();

describe('@buildtovalue/sfeel public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });

  it('never exports undefined', () => {
    for (const key of Object.keys(api)) {
      expect(api[key as keyof typeof api], `export "${key}" is undefined`).not.toBeUndefined();
    }
  });
});
