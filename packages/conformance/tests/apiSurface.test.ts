import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Contract test: freezes the runtime public API surface of
 * @buildtovalue/conformance. See core/tests/apiSurface.test.ts for rationale.
 */
const EXPECTED_EXPORTS = [
  'CONFORMANCE_MATRIX',
  'STRUCTURAL_MANIFEST',
  'certifyXml',
  'classCoverage',
  'renderConformanceMarkdown',
  // Handoff 11 N-2 — corpus policy (single source for CONFORMANCE.md + tests).
  'EXTERNAL_CORPUS_MAX',
  'EXTERNAL_CORPUS_MIN',
  'EXTERNAL_CORPUS_SOURCES',
  'GENERATED_CORPUS_FILES',
  // Handoff 14 §1g — third-party columns ("declarado pela doc deles").
  'THIRD_PARTY_DECLARATIONS',
].sort();

describe('@buildtovalue/conformance public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });
});
