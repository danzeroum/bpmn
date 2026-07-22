import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Contract test: freezes the runtime public API surface of
 * @buildtovalue/adapters-bpmn (type-only exports erase at compile time and
 * don't appear here). See core/tests/apiSurface.test.ts for rationale — a
 * failing diff means an export was added, renamed, or removed.
 */
const EXPECTED_EXPORTS = [
  'AdapterError',
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
  // Agent Lane (Handoff 12 A-5) — agent-simulation ledger session (additive).
  'AGENT_SIMULATION_SESSION_TYPE',
  'agentSimulationSessionEntry',
  // Agent Lane (Handoff 12 A-6) — AGENTE adapter + governance glue.
  'agentWorkflowAdapter',
  'groupAgentVersions',
  'agentPromotionGate',
  'agentReferenceCurrencyWarnings',
  // Handoff 9 CP-5 — copilot prompt-template adapter (dogfooding §1.5).
  'activeCopilotPromptVersion',
  'copilotPromptAdapter',
  // Handoff 14 §1d — lint profiles as promotable Biblioteca artifacts.
  'activeLintProfileVersion',
  'lintProfileAdapter',
  // Handoff 22 SL-2 — TOOL contracts as Biblioteca artifacts + shared resolver.
  'resolveToolContract',
  'toolAdapter',
  // Handoff 22 SL-7 — EvalSet as a Biblioteca artifact + promotion gate.
  'evalSetAdapter',
  'evalPromotionGate',
  // Handoff 15 §2c/§2d/§2e — review threads + request-changes → ledger glue.
  'reviewChangesRequestedEntry',
  'reviewCommentEntry',
  'reviewThreadDismissedEntry',
  'reviewThreadResolvedEntry',
  'REVIEW_CHANGES_REQUESTED_TYPE',
  'REVIEW_COMMENT_TYPE',
  'REVIEW_THREAD_DISMISSED_TYPE',
  'REVIEW_THREAD_RESOLVED_TYPE',
  // Handoff 16 E-3 (§3b) — governed event-definition catalog + binding audit.
  'eventDefinitionCatalogAdapter',
  'eventBindingChangedEntry',
  'EVENT_BINDING_CHANGED_TYPE',
  // Handoff 18 §5c — escalation raised → ledger glue (agent→human bridge).
  'escalationRaisedEntry',
  'ESCALATION_RAISED_TYPE',
  'compensationTriggeredEntry',
  'COMPENSATION_TRIGGERED_TYPE',
  // Handoff 22 SL-11 — EvidenceBundle as a canonical audit entry + ExecutionStore.
  'EVIDENCE_BUNDLE_TYPE',
  'buildEvidenceBundle',
  'canonicalEvidenceBundle',
  'hashEvidenceBundle',
  'evidenceBundleEntry',
  'evidenceBundleOf',
  'createInMemoryExecutionStore',
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
