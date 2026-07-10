import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Contract test: freezes the runtime public API surface of
 * @buildtovalue/adapters-bpmn (type-only exports erase at compile time and
 * don't appear here). See core/tests/apiSurface.test.ts for rationale — a
 * failing diff means an export was added, renamed, or removed.
 */
const EXPECTED_EXPORTS = [
  'BTV_ARTIFACT_KINDS',
  'bpmnDiagramAdapter',
  'classifyDiagram',
  'connectorAdapter',
  'coveragePromotionRule',
  'createRecipeAdapter',
  'createRegistryAdapter',
  'createRoteiroAdapter',
  'decisionThumbnail',
  'diagramThumbnail',
  'dmnDecisionAdapter',
  'latestSessionCoverage',
  'logicalArtifacts',
  'personaAdapter',
  'policyAdapter',
  'promptAdapter',
  'relevantEntry',
  'latestReplayAnalysis',
  'replayAnalysisEntry',
  'REPLAY_ANALYSIS_TYPE',
  'SIMULATION_SESSION_TYPE',
  'simulationSessionEntry',
].sort();

describe('@buildtovalue/adapters-bpmn public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });

  it('never exports undefined', () => {
    for (const key of Object.keys(api)) {
      expect(api[key as keyof typeof api], `export "${key}" is undefined`).not.toBeUndefined();
    }
  });
});
