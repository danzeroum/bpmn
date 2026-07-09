import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Freezes the runtime public API surface of @bpmn-react/replay (type-only
 * exports are erased and never appear here). Adding an export means updating
 * this list; renaming/removing one is a breaking change.
 */
const EXPECTED_EXPORTS = [
  'aggregate',
  'normalizeName',
  'parseCsv',
  'parseTimestamp',
  'parseXes',
  'summarizeReplay',
].sort();

describe('@bpmn-react/replay public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });

  it('never exports undefined', () => {
    for (const key of Object.keys(api)) {
      expect(api[key as keyof typeof api], `export "${key}" is undefined`).not.toBeUndefined();
    }
  });
});
