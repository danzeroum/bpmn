/**
 * autonomyLevel — the normative scale (Handoff 12 §4).
 *
 * `autonomyLevel` is a RULE, not a convention (cerca §1.5). Two halves of the
 * rule live in two places, deliberately:
 *   - The graph-agnostic half is HERE: the scale, the minimum level the graph
 *     itself justifies ({@link minCoherentLevel}), the coherence check
 *     (declared < graph-justified = error), and the pure gate-requirement
 *     predicate ({@link gateRequirement}).
 *   - The half that needs the surrounding BPMN process — "level ≤ 3 without a
 *     reachable btv:gate downstream = error that blocks promotion" — belongs to
 *     `@buildtovalue/core` (A-3), which knows about btv:gate and reachability.
 *     This package never imports core; core consumes {@link gateRequirement}.
 *
 * "O grafo é quem manda" (§4): the Studio only ever SUGGESTS the minimum
 * coherent level; understating autonomy relative to the graph is dishonest and
 * is reported as an error by {@link autonomyCoherence}.
 */

import type { AgentWorkflow, AutonomyLevel } from './types.js';
import type { ValidationIssue } from './validate.js';
import { hasRetryLoop, isBranchingDecision, hasDelegateEdge } from './graph.js';

/** Whether a downstream btv:gate is required at this level. */
export type GateRequirement = 'required' | 'optional' | 'none';

/** One row of the normative scale (§4). */
export interface AutonomyDefinition {
  level: AutonomyLevel;
  /** Canonical English name (localized by the host at the edge). */
  name: string;
  /** Objective definition — what the graph must look like at this level. */
  definition: string;
  /** Downstream-gate obligation. */
  gate: GateRequirement;
}

/** The full scale, index === level. */
export const AUTONOMY_SCALE: readonly AutonomyDefinition[] = [
  { level: 0, name: 'Manual', definition: 'agent only suggests; a human runs every action', gate: 'required' },
  { level: 1, name: 'Loop-free', definition: 'no retry, no delegation', gate: 'required' },
  { level: 2, name: 'Bounded Loop', definition: 'bounded retry; no delegation', gate: 'required' },
  { level: 3, name: 'Decision Tree', definition: 'multiple paths; no delegation', gate: 'required' },
  { level: 4, name: 'Multi-Agent', definition: 'has a delegate edge', gate: 'optional' },
  { level: 5, name: 'Self-Modifying', definition: 'rewrites its own plan', gate: 'none' },
];

/** The gate obligation for a level (§4): ≤3 required, 4 optional (warning),
 * 5 none (permanent inspector warning). Pure — the reachability check is
 * core's (A-3). */
export function gateRequirement(level: AutonomyLevel): GateRequirement {
  return AUTONOMY_SCALE[level].gate;
}

/** True when a level demands a reachable downstream gate (levels 0–3). */
export function requiresDownstreamGate(level: AutonomyLevel): boolean {
  return gateRequirement(level) === 'required';
}

/**
 * The minimum autonomy level the GRAPH itself justifies — "o grafo é quem
 * manda". Level 5 (self-modifying) cannot be inferred from structure and is a
 * declared-only ceiling; level 0 (manual) is likewise a declared floor a graph
 * with nodes cannot force below 1.
 */
export function minCoherentLevel(wf: AgentWorkflow): AutonomyLevel {
  if (hasDelegateEdge(wf)) return 4; // Multi-Agent
  if (isBranchingDecision(wf)) return 3; // Decision Tree
  if (hasRetryLoop(wf)) return 2; // Bounded Loop
  return 1; // Loop-free
}

/**
 * Coherence check (§4): the declared `autonomyLevel` must not be LOWER than
 * the level the graph justifies (e.g. level 1 with a retry loop is incoherent).
 * Declaring a higher level is allowed — it is a more conservative claim.
 */
export function autonomyCoherence(wf: AgentWorkflow): ValidationIssue[] {
  const min = minCoherentLevel(wf);
  if (wf.autonomyLevel >= min) return [];
  return [
    {
      code: 'AUTONOMY_INCOHERENT',
      severity: 'error',
      message: `Declared autonomyLevel ${wf.autonomyLevel} (${AUTONOMY_SCALE[wf.autonomyLevel].name}) is lower than the graph justifies: ${min} (${AUTONOMY_SCALE[min].name}).`,
      remediation: `Raise autonomyLevel to at least ${min}, or remove the graph feature (retry loop / branching / delegate) that requires it.`,
    },
  ];
}
