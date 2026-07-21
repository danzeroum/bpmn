/**
 * Squad Lane SL-10 — `simulateSquad`, the deterministic squad run.
 *
 * It traverses the squad's delegation graph (the manifest `delegar` edges),
 * running EACH member's workflow through the injected {@link AgentRunner} (the
 * default is agentflow's own {@link simulate} — never the BPMN engine, cerca
 * §2). It is deterministic: order comes from the manifest, outputs from declared
 * fixtures, never a clock or random source (same manifest + fixtures 10× →
 * byte-identical facts). Stops are honest CROSS-agent: when a member blocks, the
 * squad stop names the agent, the node, and the reason — the run never guesses.
 *
 * The product is a FACT TRAIL (D1): an ordered `intencao → acao → io → decisao →
 * evidencia` record per agent, each labeled `fixture` vs `evidencia-declarada`
 * (E6, honest provenance), with sensitive I/O MASKED per the injected masking
 * policy (never leaking PII), and a per-step context snapshot for the step mode
 * (D8). The trail is filterable by agent / kind / error (the fields are flat).
 */

import { defaultAgentRunner, type AgentRunner } from './agentRunner.js';
import { finalOutput } from './simulate.js';
import { parseRef } from './ref.js';
import type { AgentWorkflow } from './types.js';
import type { AgentRef } from './ref.js';
import type { ContextContract, SquadEdge, SquadManifest } from './squad.js';
import type { Fixtures, SimulationState } from './simTypes.js';

/** Provenance of a fact (E6): a mock fixture, or host-declared real evidence. */
export type FactSource = 'fixture' | 'evidencia-declarada';

/** The kind of a fact — the filterable "type" (D1 fact chain). */
export type FactKind = 'intencao' | 'acao' | 'io' | 'decisao' | 'evidencia' | 'parada';

/** The redaction token a conservative mask writes when no policy is injected. */
export const MASKED_VALUE = '···';

/** A host-injected masking policy (resolved from a `maskingPolicyRef`). Given a
 * field name + value, it returns the masked replacement. Absent → a conservative
 * default redacts every sensitive key (never leaks). */
export interface MaskingPolicy {
  mask(fieldName: string, value: unknown): unknown;
}

/** One fact in the squad trail. Flat by design so a UI filters by
 * `agent` / `kind` / `error` without walking a tree. */
export interface SquadFact {
  /** Monotonic step across the WHOLE squad run. */
  step: number;
  /** The member role this fact belongs to (`orch` for the orchestrator). */
  agent: string;
  /** The member's versioned agent ref. */
  agentRef: string;
  kind: FactKind;
  source: FactSource;
  /** English headless description (the react layer localizes its own chrome). */
  message: string;
  nodeId?: string;
  /** Masked call input/output (sensitive keys redacted). */
  io?: { input?: Record<string, unknown>; output?: Record<string, unknown> };
  /** True for a blocked/failed fact — lets the UI filter to errors. */
  error?: boolean;
  /** Masked shared-context snapshot AFTER this fact (step mode, D8). */
  contextAfter?: Record<string, unknown>;
}

/** A single honest cross-agent stop. */
export interface SquadBlock {
  agent: string;
  agentRef: string;
  nodeId: string;
  reason: string;
}

/** Injected, degradable integrations for {@link simulateSquad}. */
export interface SquadSimOptions {
  /** Resolves a member's `agentRef` to its workflow (injected — agentflow never
   * imports a registry). A member that does not resolve is a declared stop, not
   * a silent skip. */
  resolveWorkflow: (ref: AgentRef) => AgentWorkflow | undefined;
  /** Per-member mock fixtures keyed by ROLE. */
  fixturesByRole?: Record<string, Fixtures>;
  /** The runner (default {@link defaultAgentRunner} — deterministic mock). */
  runner?: AgentRunner;
  /** The resolved context contract — drives masking (sensitive/forbidden keys)
   * and the shared-context key ownership. */
  contract?: ContextContract;
  /** The masking policy (from `maskingPolicyRef`); absent → conservative redaction. */
  maskingPolicy?: MaskingPolicy;
  /** Roles whose fixtures the host DECLARES as captured real evidence (E6). Their
   * facts are labeled `evidencia-declarada`; every other role is `fixture`. */
  declaredEvidenceRoles?: readonly string[];
  /** Safety cap on delegation hops (default 64) — a malformed graph stops
   * honestly rather than looping. */
  maxHops?: number;
}

/** The whole squad run — the shared render contract for the react trail. */
export interface SquadSimResult {
  /** The ordered fact trail (D1). */
  facts: SquadFact[];
  /** Each member's own {@link SimulationState}, keyed by role. */
  perAgent: Record<string, SimulationState>;
  /** The roles in execution order. */
  order: string[];
  /** True when the whole squad reached its end with no honest stop. */
  complete: boolean;
  /** The first honest cross-agent stop, or null. */
  blocked: SquadBlock | null;
}

const DEFAULT_MAX_HOPS = 64;

/** The set of context field names the trail must mask (sensitive or forbidden). */
function sensitiveKeys(contract: ContextContract | undefined): Set<string> {
  const set = new Set<string>();
  for (const key of contract?.keys ?? []) {
    if (key.forbidden === true || (key.sensitivity !== undefined && key.sensitivity !== '')) {
      set.add(key.key);
    }
  }
  return set;
}

/** Masks a record: sensitive keys go through the injected policy, or are redacted
 * conservatively when none is injected. Non-sensitive values pass through. */
function maskRecord(
  record: Record<string, unknown> | undefined,
  sensitive: Set<string>,
  policy: MaskingPolicy | undefined,
): Record<string, unknown> | undefined {
  if (record === undefined) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = sensitive.has(key) ? (policy ? policy.mask(key, value) : MASKED_VALUE) : value;
  }
  return out;
}

/** The roles a member writes into the shared context (owner or explicit writer). */
function writtenKeysFor(role: string, contract: ContextContract | undefined): string[] {
  return (contract?.keys ?? [])
    .filter((k) => k.forbidden !== true && (k.owner === role || (k.writers ?? []).includes(role)))
    .map((k) => k.key);
}

/**
 * Runs a squad deterministically and returns its fact trail. Traverses `delegar`
 * edges from the orchestrator in manifest order; each member runs through the
 * injected runner's `simulate`. Honest cross-agent stop on the first block.
 */
export function simulateSquad(manifest: SquadManifest, options: SquadSimOptions): SquadSimResult {
  const runner = options.runner ?? defaultAgentRunner;
  const sensitive = sensitiveKeys(options.contract);
  const evidenceRoles = new Set(options.declaredEvidenceRoles ?? []);
  const maxHops = options.maxHops ?? DEFAULT_MAX_HOPS;

  const facts: SquadFact[] = [];
  const perAgent: Record<string, SimulationState> = {};
  const order: string[] = [];
  const context: Record<string, unknown> = {};
  let step = 0;
  let blocked: SquadBlock | null = null;

  // The orchestrator + members, addressable by role.
  const refByRole = new Map<string, string>([['orch', manifest.orchestratorRef]]);
  for (const m of manifest.members) refByRole.set(m.role, m.agentRef);

  const sourceFor = (role: string): FactSource =>
    evidenceRoles.has(role) ? 'evidencia-declarada' : 'fixture';

  const emit = (fact: Omit<SquadFact, 'step'>): void => {
    facts.push({ step: step++, ...fact });
  };

  // `delegar` edges grouped by source role, kept in manifest order (determinism).
  const delegations = (from: string): SquadEdge[] =>
    manifest.edges.filter((e) => e.kind === 'delegar' && e.from === from);

  const visited = new Set<string>();
  let hops = 0;

  /** Runs one member and folds its trail into facts; returns false on an honest stop. */
  const runMember = (role: string): boolean => {
    const agentRef = refByRole.get(role);
    if (agentRef === undefined) return true; // unknown role — the projection/validation flags it
    let ref: AgentRef;
    try {
      ref = parseRef(agentRef).ref;
    } catch {
      blocked = { agent: role, agentRef, nodeId: '—', reason: 'member ref is not a valid id@semver' };
      emit({ agent: role, agentRef, kind: 'parada', source: sourceFor(role), message: `⛔ ${role}: unresolved ref "${agentRef}"`, error: true, contextAfter: maskRecord({ ...context }, sensitive, options.maskingPolicy) });
      return false;
    }
    const wf = options.resolveWorkflow(ref);
    if (wf === undefined) {
      blocked = { agent: role, agentRef, nodeId: '—', reason: 'member workflow could not be resolved (no resolver hit)' };
      emit({ agent: role, agentRef, kind: 'parada', source: sourceFor(role), message: `⛔ ${role}: workflow ${agentRef} did not resolve`, error: true, contextAfter: maskRecord({ ...context }, sensitive, options.maskingPolicy) });
      return false;
    }

    const state = runner.simulate(wf, { fixtures: options.fixturesByRole?.[role] });
    perAgent[role] = state;
    order.push(role);

    // Fold the member's own trail into squad facts (acao / decisao).
    for (const entry of state.trail) {
      if (entry.type === 'move' && entry.nodeId) {
        emit({ agent: role, agentRef, kind: 'acao', source: sourceFor(role), message: entry.message, nodeId: entry.nodeId });
      } else if (entry.type === 'decision') {
        emit({ agent: role, agentRef, kind: 'decisao', source: sourceFor(role), message: entry.message, nodeId: entry.nodeId });
      }
    }

    // An honest per-member stop becomes an honest cross-agent stop.
    if (state.blockedDecision) {
      const { nodeId, reason } = state.blockedDecision;
      blocked = { agent: role, agentRef, nodeId, reason };
      emit({ agent: role, agentRef, kind: 'parada', source: sourceFor(role), message: `⛔ ${role} · ${nodeId}: ${reason}`, nodeId, error: true, contextAfter: maskRecord({ ...context }, sensitive, options.maskingPolicy) });
      return false;
    }

    // Evidence: the member's masked final output folded into shared context.
    const output = finalOutput(state);
    const maskedOut = maskRecord(output, sensitive, options.maskingPolicy);
    for (const key of writtenKeysFor(role, options.contract)) {
      if (output && key in output) context[key] = maskedOut?.[key];
    }
    emit({
      agent: role,
      agentRef,
      kind: 'evidencia',
      source: sourceFor(role),
      message: state.complete ? `✓ ${role} produced output` : `${role} ended without output`,
      io: maskedOut ? { output: maskedOut } : undefined,
      contextAfter: maskRecord({ ...context }, sensitive, options.maskingPolicy),
    });
    return true;
  };

  // Traverse from the orchestrator down the delegation chain (manifest order).
  const orchRef = manifest.orchestratorRef;
  emit({ agent: 'orch', agentRef: orchRef, kind: 'intencao', source: sourceFor('orch'), message: 'orchestrator activates the squad' });
  if (!runMember('orch')) return { facts, perAgent, order, complete: false, blocked };

  const queue: string[] = ['orch'];
  while (queue.length > 0) {
    const from = queue.shift()!;
    for (const edge of delegations(from)) {
      if (++hops > maxHops) {
        blocked = { agent: from, agentRef: refByRole.get(from) ?? '—', nodeId: '—', reason: `delegation exceeded ${maxHops} hops` };
        return { facts, perAgent, order, complete: false, blocked };
      }
      if (visited.has(edge.to)) continue; // a role runs once (cycle guard)
      visited.add(edge.to);
      emit({ agent: from, agentRef: refByRole.get(from) ?? '—', kind: 'intencao', source: sourceFor(from), message: `${from} delegates to ${edge.to}` });
      if (!runMember(edge.to)) return { facts, perAgent, order, complete: false, blocked };
      queue.push(edge.to);
    }
  }

  return { facts, perAgent, order, complete: blocked === null, blocked };
}
