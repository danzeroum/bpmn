import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/** Freezes the runtime public API surface of @bpmn-react/anchor-git. */
const EXPECTED_EXPORTS = ['createGitAnchor'].sort();

describe('@bpmn-react/anchor-git public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });

  it('never exports undefined', () => {
    for (const key of Object.keys(api)) {
      expect(api[key as keyof typeof api], `export "${key}" is undefined`).not.toBeUndefined();
    }
  });
});
