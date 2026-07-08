import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Contract test: freezes the runtime public API surface of
 * @bpmn-react/dmn (type-only exports erase at compile time and don't
 * appear here). See core/tests/apiSurface.test.ts for rationale — a failing
 * diff means an export was added, renamed, or removed.
 */
const EXPECTED_EXPORTS = [
  'DMN_EDGE_TYPES',
  'DMN_NODE_TYPES',
  'DMN_NS',
  'DMNDI_NS',
  'DMN_SPEC_VERSION',
  'DecisionPeek',
  'DecisionTableEditor',
  'DmnBusinessKnowledgeModelShape',
  'DmnDecisionShape',
  'DmnInputDataShape',
  'DmnKnowledgeSourceShape',
  'DmnXmlConverter',
  'HIT_POLICIES',
  'REQUIREMENT_OWNERS',
  'createDecisionCommand',
  'createDecisionTable',
  'decisionInspectorSection',
  'decisionTableOf',
  'dmnPlugin',
  'linkDecisionCommand',
  'setDecisionTableCommand',
  'unlinkDecisionCommand',
  'validateDecisionTable',
].sort();

describe('@bpmn-react/dmn public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });

  it('never exports undefined', () => {
    for (const key of Object.keys(api)) {
      expect(api[key as keyof typeof api], `export "${key}" is undefined`).not.toBeUndefined();
    }
  });
});
