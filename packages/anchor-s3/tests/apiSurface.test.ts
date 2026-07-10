import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/** Freezes the runtime public API surface of @buildtovalue/anchor-s3. */
const EXPECTED_EXPORTS = ['createS3Anchor'].sort();

describe('@buildtovalue/anchor-s3 public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });

  it('never exports undefined', () => {
    for (const key of Object.keys(api)) {
      expect(api[key as keyof typeof api], `export "${key}" is undefined`).not.toBeUndefined();
    }
  });
});
