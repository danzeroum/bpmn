import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Contract test: freezes the runtime public API surface of
 * @bpmn-react/conformance. See core/tests/apiSurface.test.ts for rationale.
 */
const EXPECTED_EXPORTS = [
  'CONFORMANCE_MATRIX',
  'STRUCTURAL_MANIFEST',
  'certifyXml',
  'classCoverage',
  'renderConformanceMarkdown',
].sort();

describe('@bpmn-react/conformance public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });
});
