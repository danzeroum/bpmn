import { sha256Hex } from '@buildtovalue/core';
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
    // E-6 (§3e): thrown events — same stable shapes, replayed by matching.
    case 'error':
      return {
        kind: 'error',
        host: decision.host,
        ...(decision.errorRef !== undefined ? { errorRef: decision.errorRef } : {}),
      };
    // §5e: escalation throw — same stable shape, replayed by matching.
    case 'escalation':
      return {
        kind: 'escalation',
        host: decision.host,
        ...(decision.escalationRef !== undefined ? { escalationRef: decision.escalationRef } : {}),
      };
    case 'signal':
    case 'message':
      return { kind: decision.kind, ref: decision.ref };
    // ES-5 (§4e): manual timer/conditional event-subprocess fire — `atStep`
    // anchors WHEN it fired (part of the scenario: interruption depends on it).
    case 'eventSubprocess':
      return { kind: 'eventSubprocess', sub: decision.sub, atStep: decision.atStep };
    // §6d: compensation — `atStep` anchors WHEN it fired (the reversed set is the
    // activities completed by then); stable shape, replayed through the SAME trail.
    case 'compensate':
      return {
        kind: 'compensate',
        ...(decision.scope !== undefined ? { scope: decision.scope } : {}),
        ...(decision.activityRef !== undefined ? { activityRef: decision.activityRef } : {}),
        waitForCompletion: decision.waitForCompletion,
        atStep: decision.atStep,
      };
    case 'decision':
      return {
        kind: 'decision',
        node: decision.node,
        context: Object.fromEntries(
          Object.entries(decision.context).sort(([a], [b]) => (a < b ? -1 : 1)),
        ),
      };
    default:
      return { kind: decision.kind, gateway: decision.gateway, edge: decision.edge };
  }
}

/** Short, stable content hash of a scenario (first 12 hex chars of SHA-256). */
export async function hashScenario(scenario: Scenario): Promise<string> {
  const full = await sha256Hex(canonicalizeScenario(scenario));
  return full.slice(0, 12);
}
