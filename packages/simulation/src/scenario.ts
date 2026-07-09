import { sha256Hex } from '@bpmn-react/core';
import type { Decision } from './types.js';
import type { Scenario } from './engine.js';

/**
 * Canonical JSON for a scenario: keys in a fixed order and decisions in a
 * stable shape, so the same run always serializes byte-for-byte the same. This
 * is what gets stored as a versioned scenario artifact and hashed for the
 * "roteiro #hash" evidence in the SACM report (Handoff 7A §3.5).
 */
export function canonicalizeScenario(scenario: Scenario): string {
  const decisions = scenario.decisions.map(canonicalDecision);
  return JSON.stringify({
    diagramId: scenario.diagramId,
    versionId: scenario.versionId,
    semanticVersion: scenario.semanticVersion,
    scope: scenario.scope,
    decisions,
  });
}

function canonicalDecision(decision: Decision): Record<string, unknown> {
  switch (decision.kind) {
    case 'inclusive':
      return { kind: 'inclusive', gateway: decision.gateway, edges: [...decision.edges].sort() };
    case 'boundary':
      return { kind: 'boundary', host: decision.host, boundary: decision.boundary };
    default:
      return { kind: decision.kind, gateway: decision.gateway, edge: decision.edge };
  }
}

/** Short, stable content hash of a scenario (first 12 hex chars of SHA-256). */
export async function hashScenario(scenario: Scenario): Promise<string> {
  const full = await sha256Hex(canonicalizeScenario(scenario));
  return full.slice(0, 12);
}
