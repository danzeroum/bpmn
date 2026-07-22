import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Freezes the runtime public API surface of @buildtovalue/agentflow (type-only
 * exports are erased and never appear here). Adding an export means updating
 * this list; renaming/removing one is a breaking change (Handoff 12 §9.9,
 * "apiSurface para toda API nova").
 */
const EXPECTED_EXPORTS = [
  'APPROVAL_GATE_AGENT',
  'AUTONOMY_SCALE',
  'AgentRefError',
  'DEFAULT_COST_MODEL',
  'DEFAULT_TEMPLATE_ID',
  'DOCUMENT_REVIEW_AGENT',
  'END_ROUTE',
  'MASKED_VALUE',
  'RESEARCH_AGENT',
  'SQUAD_DYNAMICS',
  'SQUAD_EDGE_KINDS',
  'SUPPORTED_SCHEMA_KEYWORDS',
  'TEMPLATES',
  'autonomyCoherence',
  'canReach',
  'decisionRoutes',
  'defaultAgentRunner',
  'effectRequiresGate',
  'exportLangGraph',
  'finalOutput',
  'formatRef',
  'importLangGraph',
  'LangGraphImportError',
  'gateRequirement',
  'hasDelegateEdge',
  'hasRetryLoop',
  'internalSuccessors',
  'isBranchingDecision',
  'isSchemaNode',
  'isToolRef',
  'isValid',
  'isValidRef',
  'loopComponents',
  'matchToolParams',
  'minCoherentLevel',
  'nodeIndex',
  'normalizeSchema',
  'normalizeSchemaField',
  'parseRef',
  'promptCoverage',
  'promptVariables',
  'readinessState',
  'requiredKeys',
  'requiresDownstreamGate',
  'runEvalSet',
  'simulate',
  'simulateSquad',
  'squadAutonomy',
  'toRef',
  'unsupportedKeywords',
  'validateContextContract',
  'validateGraph',
  'validateSquad',
  'validateSquadFlow',
].sort();

describe('@buildtovalue/agentflow public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });

  it('never exports undefined', () => {
    for (const key of Object.keys(api)) {
      expect(api[key as keyof typeof api], `export "${key}" is undefined`).not.toBeUndefined();
    }
  });
});
