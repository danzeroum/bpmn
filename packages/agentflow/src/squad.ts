/**
 * Squads (Squad Lane SL-8) — a `SquadManifest` (`sqd-*@semver`) wires versioned
 * agent members into a collaboration, and a `ContextContract`
 * (`ctx-contract:*@semver`) governs the shared context. The ctx-contract is its
 * OWN reusable artifact referenced BY the manifest (never inlined — insight E5),
 * so two squads can share one contract by ref.
 *
 * Pure and headless: member currency (candidata/obsoleta) is a registry concept,
 * so it arrives by an INJECTED `resolveMemberStatus` (the `resolveDelegate`/
 * `resolveTool` mold) — agentflow never imports the registry (independence test).
 */

import type { AgentWorkflow, AutonomyLevel } from './types.js';
import { parseRef, type AgentRef } from './ref.js';
import { effectRequiresGate, type ResolveTool } from './toolContract.js';
import type { ValidationIssue } from './validate.js';

/** How a squad coordinates (cerca §5). */
export type SquadDynamic = 'hierarquico' | 'sequencial' | 'paralelo' | 'blackboard';

/** The six squad edge kinds (E9) — the only collaboration relations. */
export type SquadEdgeKind =
  | 'delegar'
  | 'enviar-contexto'
  | 'solicitar-revisao'
  | 'escalar'
  | 'consolidar'
  | 'fallback';

/** Why a context key exists (governs its merge/immutability semantics). */
export type ContextPurpose = 'grounding' | 'decision' | 'operational-action';

/** How writes to a context key combine. */
export type ContextMerge = 'acrescentar' | 'substituir' | 'exigir-decisao';

/** One squad member: a versioned agent, its persona, and its role. */
export interface SquadMember {
  agentRef: string;
  personaRef: string;
  role: string;
}

/** One collaboration relation between roles (`orch`, a member role, `humano`, `*`). */
export interface SquadEdge {
  from: string;
  to: string;
  kind: SquadEdgeKind;
}

/** A gate the squad passes through, and the scope of its approval. */
export interface SquadGate {
  gateId: string;
  scope: string;
}

/** The SQUAD artifact (`sqd-doc-review@1.0.0`). */
export interface SquadManifest {
  kind: 'SquadManifest';
  id: string;
  version: string;
  dynamic: SquadDynamic;
  orchestratorRef: string;
  members: SquadMember[];
  edges: SquadEdge[];
  contextContractRef: string;
  gates: SquadGate[];
}

/** One governed context key. A `forbidden` key grants no access. */
export interface ContextKey {
  key: string;
  owner?: string;
  readers?: string[];
  writers?: string[];
  purpose?: ContextPurpose;
  merge?: ContextMerge;
  ttl?: string;
  sensitivity?: string;
  immutableAfterGate?: boolean;
  forbidden?: boolean;
}

/** The reusable context contract artifact (`ctx-contract:doc-review@1.0.0`). */
export interface ContextContract {
  kind: 'ContextContract';
  id: string;
  version: string;
  keys: ContextKey[];
}

/** The valid squad dynamics. */
export const SQUAD_DYNAMICS: readonly SquadDynamic[] = [
  'hierarquico',
  'sequencial',
  'paralelo',
  'blackboard',
];

/** The six valid squad edge kinds. */
export const SQUAD_EDGE_KINDS: readonly SquadEdgeKind[] = [
  'delegar',
  'enviar-contexto',
  'solicitar-revisao',
  'escalar',
  'consolidar',
  'fallback',
];

/**
 * Validates a {@link ContextContract} on its own (it is reusable, so it is
 * validated once): `CTX_WRITE_FORBIDDEN` when a forbidden key still grants
 * access, `CTX_PURPOSE_VIOLATION` when a key's merge/immutability contradicts
 * its declared purpose.
 */
export function validateContextContract(contract: ContextContract): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const key of contract.keys) {
    if (key.forbidden === true) {
      const grantsAccess =
        key.owner !== undefined ||
        (key.readers !== undefined && key.readers.length > 0) ||
        (key.writers !== undefined && key.writers.length > 0);
      if (grantsAccess) {
        issues.push({
          code: 'CTX_WRITE_FORBIDDEN',
          severity: 'error',
          message: `Context key "${key.key}" is forbidden but still grants access (owner/readers/writers).`,
          remediation:
            'A forbidden key must declare no owner/readers/writers — remove the ACL, or unset forbidden.',
        });
      }
      continue; // a forbidden key has no purpose to violate
    }
    if (key.immutableAfterGate === true && key.purpose !== undefined && key.purpose !== 'operational-action') {
      issues.push({
        code: 'CTX_PURPOSE_VIOLATION',
        severity: 'error',
        message: `Context key "${key.key}" is immutableAfterGate but its purpose is "${key.purpose}", not operational-action.`,
        remediation:
          'immutableAfterGate is an operational-action guarantee — set purpose to "operational-action", or drop immutableAfterGate.',
      });
    }
    if (key.merge === 'exigir-decisao' && key.purpose === 'grounding') {
      issues.push({
        code: 'CTX_PURPOSE_VIOLATION',
        severity: 'error',
        message: `Context key "${key.key}" merges by "exigir-decisao" but its purpose is "grounding".`,
        remediation:
          'Grounding context accumulates or replaces — use merge "acrescentar"/"substituir", or change the purpose.',
      });
    }
  }
  return issues;
}

/** Injected, degradable integrations for {@link validateSquad}. */
export interface ValidateSquadOptions {
  /** Resolves `contextContractRef` to the contract so its keys can be checked. */
  resolveContextContract?: (ref: AgentRef) => ContextContract | undefined;
  /**
   * True when a member's agent version is candidate/obsolete (a registry
   * concept, injected). Absent → no `SQUAD_MEMBER_STALE` warning (degradable,
   * the `resolveDelegate`/`resolveTool` mold — agentflow never imports registry).
   */
  resolveMemberStatus?: (ref: AgentRef) => boolean;
}

/**
 * Validates a {@link SquadManifest}: structural validity (dynamic, the six edge
 * kinds, versioned refs), the injected member-currency warning
 * `SQUAD_MEMBER_STALE`, and — when the contract resolves — the `CTX_*` checks.
 */
export function validateSquad(
  manifest: SquadManifest,
  options: ValidateSquadOptions = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!SQUAD_DYNAMICS.includes(manifest.dynamic)) {
    issues.push({
      code: 'SQUAD_DYNAMIC_INVALID',
      severity: 'error',
      message: `Squad "${manifest.id}" has an unknown dynamic "${manifest.dynamic}".`,
      remediation: `Use one of: ${SQUAD_DYNAMICS.join(', ')}.`,
    });
  }

  // The legitimate role tokens: the orchestrator ("orch"), each declared member
  // role, and the human escalation target ("humano"). "*" is a broadcast SOURCE
  // only. This is the SAME set the react projection (`buildSquadDiagram`) treats
  // as drawable, so an edge the diagram silently omits is exactly an edge this
  // check flags — the omission is never mute (the user sees it in Problems).
  const knownRoles = new Set(['orch', 'humano', ...manifest.members.map((m) => m.role)]);
  for (const edge of manifest.edges) {
    if (!SQUAD_EDGE_KINDS.includes(edge.kind)) {
      issues.push({
        code: 'SQUAD_EDGE_KIND_INVALID',
        severity: 'error',
        message: `Squad edge ${edge.from} → ${edge.to} has an unknown kind "${edge.kind}".`,
        remediation: `Use one of the six kinds: ${SQUAD_EDGE_KINDS.join(', ')}.`,
      });
    }
    for (const [endpoint, isSource] of [
      [edge.from, true],
      [edge.to, false],
    ] as const) {
      // "*" is valid only as the source (broadcast); as a target it is unknown.
      if (isSource && endpoint === '*') continue;
      if (!knownRoles.has(endpoint)) {
        issues.push({
          code: 'SQUAD_EDGE_ROLE_UNKNOWN',
          severity: 'error',
          message: `Squad edge ${edge.from} → ${edge.to} references an unknown role "${endpoint}".`,
          remediation:
            'Reference the orchestrator ("orch"), a declared member role, "humano", or "*" (broadcast source).',
        });
      }
    }
  }

  const checkRef = (ref: string, where: string): void => {
    try {
      parseRef(ref);
    } catch (err) {
      issues.push({
        code: 'SQUAD_REF_INVALID',
        severity: 'error',
        message: `${where} references an invalid ref "${ref}": ${(err as Error).message}`,
        remediation: 'Use a versioned reference "id@major.minor.patch".',
      });
    }
  };
  checkRef(manifest.orchestratorRef, `Squad "${manifest.id}" orchestrator`);
  checkRef(manifest.contextContractRef, `Squad "${manifest.id}" contextContractRef`);
  for (const member of manifest.members) {
    checkRef(member.agentRef, `Member "${member.role}"`);
    checkRef(member.personaRef, `Member "${member.role}" persona`);
  }

  // SQUAD_MEMBER_STALE (warning) — injected + degradable (never imports registry).
  if (options.resolveMemberStatus) {
    for (const member of manifest.members) {
      let ref: AgentRef;
      try {
        ref = parseRef(member.agentRef).ref;
      } catch {
        continue; // malformed ref already reported
      }
      if (options.resolveMemberStatus(ref)) {
        issues.push({
          code: 'SQUAD_MEMBER_STALE',
          severity: 'warning',
          message: `Squad member "${member.role}" (${member.agentRef}) is a candidate/obsolete version.`,
          remediation: 'Coordinated promotion: bind the member to a current (active) agent version.',
        });
      }
    }
  }

  // CTX_* — validate the resolved context contract (reused, so checked once).
  if (options.resolveContextContract) {
    let ctxRef: AgentRef | undefined;
    try {
      ctxRef = parseRef(manifest.contextContractRef).ref;
    } catch {
      ctxRef = undefined;
    }
    const contract = ctxRef ? options.resolveContextContract(ctxRef) : undefined;
    if (contract) issues.push(...validateContextContract(contract));
  }

  return issues;
}

/**
 * The squad's composite autonomy — the MAX over its resolved members (the same
 * "max of the chain" rule as SL-4's `AUTONOMY_CHAIN`, not a new one). Members
 * are resolved through the injected resolver; `undefined` when none resolve.
 */
export function squadAutonomy(
  manifest: SquadManifest,
  resolveMember: (ref: AgentRef) => AgentWorkflow | undefined,
): AutonomyLevel | undefined {
  let max: AutonomyLevel | undefined;
  for (const member of manifest.members) {
    let ref: AgentRef;
    try {
      ref = parseRef(member.agentRef).ref;
    } catch {
      continue;
    }
    const wf = resolveMember(ref);
    if (wf) max = max === undefined ? wf.autonomyLevel : (Math.max(max, wf.autonomyLevel) as AutonomyLevel);
  }
  return max;
}

/** Injected, degradable integrations for {@link validateSquadFlow}. */
export interface SquadFlowOptions {
  /** Resolves a member `agentRef` to its workflow — needed to see the tools it
   * reaches (injected; agentflow never imports a registry). */
  resolveWorkflow: (ref: AgentRef) => AgentWorkflow | undefined;
  /** Resolves a `tool:*@semver` ref to its contract — needed for the effect. */
  resolveTool: ResolveTool;
}

/**
 * The FLOW half of `CTX_PURPOSE_VIOLATION` (Squad Lane SL-10, insight E5). The
 * STRUCTURAL half ({@link validateContextContract}) checks a key against itself;
 * this checks the key against the SQUAD GRAPH + the members' resolved tool
 * effects — information that only exists once the squad is assembled.
 *
 * The rule: `grounding` context is knowledge meant to INFORM, not to commit. If a
 * role that READS a grounding key reaches, in its workflow, a tool whose effect
 * requires a gate (`external-commitment` / `write-irreversible`) and the squad
 * declares NO gate at all, then grounding is flowing into an unreviewed
 * commitment — a violation. (A squad WITH gates defers the precise per-path
 * "does a gate cover THIS action" coverage to SL-12's `GATE_NOT_COVERING` over
 * `reachableGateFrom`; documented, not silently skipped.)
 *
 * Fully degradable: both resolvers must be injected, or the flow rule does not
 * run (the structural CTX checks still do). Returns issues to MERGE with
 * {@link validateSquad}'s — never mutates, never throws on an unresolved ref.
 */
export function validateSquadFlow(
  manifest: SquadManifest,
  contract: ContextContract,
  options: SquadFlowOptions,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Only a squad with no review whatsoever can let grounding reach a commitment
  // unreviewed; a gated squad is SL-12's finer question.
  if (manifest.gates.length > 0) return issues;

  const refByRole = new Map<string, string>([['orch', manifest.orchestratorRef]]);
  for (const m of manifest.members) refByRole.set(m.role, m.agentRef);

  /** The gate-requiring tool a role reaches, or undefined. */
  const committingTool = (role: string): string | undefined => {
    const agentRef = refByRole.get(role);
    if (agentRef === undefined) return undefined;
    let ref: AgentRef;
    try {
      ref = parseRef(agentRef).ref;
    } catch {
      return undefined;
    }
    const wf = options.resolveWorkflow(ref);
    if (!wf) return undefined;
    for (const node of wf.nodes) {
      if (node.type !== 'tool') continue;
      let toolRef: AgentRef;
      try {
        toolRef = parseRef(node.config.usesTool).ref;
      } catch {
        continue;
      }
      const tool = options.resolveTool(toolRef);
      if (tool && effectRequiresGate(tool.effect)) return node.config.usesTool;
    }
    return undefined;
  };

  for (const key of contract.keys) {
    if (key.forbidden === true || key.purpose !== 'grounding') continue;
    const readers = key.readers ?? [];
    const readerRoles = readers.includes('*')
      ? ['orch', ...manifest.members.map((m) => m.role)]
      : readers;
    for (const role of readerRoles) {
      const tool = committingTool(role);
      if (tool !== undefined) {
        issues.push({
          code: 'CTX_PURPOSE_VIOLATION',
          severity: 'error',
          message: `Grounding key "${key.key}" is read by "${role}", whose workflow reaches the gate-requiring tool "${tool}" with no gate in the squad.`,
          remediation:
            'Grounding must not drive an unreviewed external commitment — add a gate (scope covering the committing member), or narrow the reader/tool.',
          nodeId: role,
        });
      }
    }
  }
  return issues;
}
