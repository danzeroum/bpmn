import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Contract test: freezes the runtime public API surface of
 * @bpmn-react/adapters-bpmn (type-only exports erase at compile time and
 * don't appear here). See core/tests/apiSurface.test.ts for rationale — a
 * failing diff means an export was added, renamed, or removed.
 */
const EXPECTED_EXPORTS = [
  'BTV_ARTIFACT_KINDS',
  'bpmnDiagramAdapter',
  'classifyDiagram',
  'connectorAdapter',
  'createRecipeAdapter',
  'createRegistryAdapter',
  'decisionThumbnail',
  'diagramThumbnail',
  'dmnDecisionAdapter',
  'logicalArtifacts',
  'personaAdapter',
  'policyAdapter',
  'promptAdapter',
  'relevantEntry',
].sort();

describe('@bpmn-react/adapters-bpmn public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });

  it('never exports undefined', () => {
    for (const key of Object.keys(api)) {
      expect(api[key as keyof typeof api], `export "${key}" is undefined`).not.toBeUndefined();
    }
  });
});
