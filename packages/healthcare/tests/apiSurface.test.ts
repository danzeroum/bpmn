import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Contract test: freezes the runtime public API surface of
 * @buildtovalue/healthcare (type-only exports erase at compile time). See
 * core/tests/apiSurface.test.ts for rationale.
 */
const EXPECTED_EXPORTS = [
  'ClinicalDecisionShape',
  'ClinicalTaskShape',
  'GuidelineShape',
  'HC_DECISION_UNLINKED',
  'HC_NODE_TYPES',
  'PathwayGateShape',
  'clinicalDecisionLinkedRule',
  'healthcarePlugin',
].sort();

describe('@buildtovalue/healthcare public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });

  it('never exports undefined', () => {
    for (const key of Object.keys(api)) {
      expect(api[key as keyof typeof api], `export "${key}" is undefined`).not.toBeUndefined();
    }
  });
});
