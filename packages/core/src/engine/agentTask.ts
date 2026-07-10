import type { BpmnDiagram, BpmnNode } from '../model/types.js';
import type { PromotionRule } from './lifecycle.js';

/**
 * Agent Lane (Handoff 12 A-3) — the pieces the CORE owns for the `agentTask`
 * node type: the autonomy→gate promotion rule and the snapshot-fallback
 * resolver. Both take their domain-specific halves by INJECTION so core never
 * imports `@buildtovalue/agentflow` (cerca §1.7): the "does this level need a
 * gate" predicate comes from agentflow's pure `requiresDownstreamGate`, and
 * "what counts as a gate" comes from the domain (e.g. `btv:gate`).
 */

/** The autonomyLevel stored on an agentTask node, if present and numeric. */
export function agentAutonomyLevelOf(node: BpmnNode): number | undefined {
  const level = node.properties.autonomyLevel;
  return typeof level === 'number' && Number.isFinite(level) ? level : undefined;
}

/** Every agentTask node in the diagram. */
export function agentTasksOf(diagram: BpmnDiagram): BpmnNode[] {
  return Object.values(diagram.nodes).filter((n) => n.type === 'agentTask');
}

/**
 * True when a node satisfying `isGate` is reachable downstream of `startId`
 * along sequence flows (forward BFS). "A jusante no processo" (§4).
 */
export function reachableGateFrom(
  diagram: BpmnDiagram,
  startId: string,
  isGate: (node: BpmnNode) => boolean,
): boolean {
  const outgoing = new Map<string, string[]>();
  for (const edge of Object.values(diagram.edges)) {
    if (edge.type !== 'sequenceFlow') continue;
    outgoing.set(edge.sourceId, [...(outgoing.get(edge.sourceId) ?? []), edge.targetId]);
  }
  const seen = new Set<string>();
  const queue = [...(outgoing.get(startId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = diagram.nodes[id];
    if (node && isGate(node)) return true;
    queue.push(...(outgoing.get(id) ?? []));
  }
  return false;
}

/** Options for {@link agentAutonomyGateRule}. */
export interface AgentGateRuleOptions {
  /**
   * True when an autonomyLevel requires a reachable downstream gate. Inject
   * `requiresDownstreamGate` from `@buildtovalue/agentflow` (levels 0–3).
   */
  requiresGate: (autonomyLevel: number) => boolean;
  /** True when a node is a governance gate (e.g. a `btv:gate`). Domain-injected. */
  isGate: (node: BpmnNode) => boolean;
  /** Message locale. Default `en`. */
  locale?: 'en' | 'pt';
}

/** An agentTask that violates the autonomy→gate rule. */
export interface AgentGateViolation {
  nodeId: string;
  autonomyLevel: number;
  /** Actionable remediation (§4): add a gate, or raise the level. */
  remediation: string;
}

function remediationFor(node: BpmnNode, level: number, locale: 'en' | 'pt'): string {
  const name = node.label || node.id;
  return locale === 'pt'
    ? `Adicione um btv:gate a jusante de "${name}" ou eleve o autonomyLevel acima de 3 (atual: ${level}).`
    : `Add a btv:gate downstream of "${name}" or raise its autonomyLevel above 3 (currently ${level}).`;
}

/**
 * Finds every agentTask whose autonomyLevel requires a downstream gate (§4)
 * but has none reachable. Drives both the promotion rule and the react
 * inspector's error-with-remediation.
 */
export function agentGateViolations(
  diagram: BpmnDiagram,
  options: AgentGateRuleOptions,
): AgentGateViolation[] {
  const locale = options.locale ?? 'en';
  const violations: AgentGateViolation[] = [];
  for (const node of agentTasksOf(diagram)) {
    const level = agentAutonomyLevelOf(node);
    if (level === undefined || !options.requiresGate(level)) continue;
    if (reachableGateFrom(diagram, node.id, options.isGate)) continue;
    violations.push({ nodeId: node.id, autonomyLevel: level, remediation: remediationFor(node, level, locale) });
  }
  return violations;
}

/**
 * Promotion gate (§4, §1.5): an agentTask at autonomyLevel ≤ 3 without a
 * reachable downstream btv:gate is an ERROR that blocks promotion to `active`
 * through the existing LifecycleEngine — drop it into
 * `lifecycleConfig.promotionRules` and `evaluateGates`/`promote` enforce it
 * like any other gate (same shape as `soundnessPromotionRule`). The error
 * always carries an exact remediation.
 */
export function agentAutonomyGateRule(options: AgentGateRuleOptions): PromotionRule {
  const locale = options.locale ?? 'en';
  return ({ diagram, target }) => {
    if (target !== 'active') return { allowed: true };
    const violations = agentGateViolations(diagram, options);
    if (violations.length === 0) return { allowed: true };
    const first = violations[0];
    const lead =
      locale === 'pt'
        ? `Autonomia: ${violations.length} agentTask de nível ≤3 sem btv:gate a jusante bloqueia a ativação. ${first.remediation}`
        : `Autonomy: ${violations.length} agentTask at level ≤3 without a downstream btv:gate block activation. ${first.remediation}`;
    return { allowed: false, reason: lead };
  };
}

/** The outcome of resolving an agentTask's sub-workflow. */
export interface AgentWorkflowResolution {
  source: 'registry' | 'snapshot' | 'unresolved';
  /** The resolved sub-workflow JSON (parsed), when resolvable. */
  workflow?: unknown;
  /** Present only when the snapshot was used because the registry did not
   * resolve — the honest "degraded read" warning (§1.1). */
  warning?: string;
}

/**
 * Resolves an agentTask's sub-workflow (Handoff 12 §1.1). The Library/registry
 * is ALWAYS the source of truth — pass a `resolveFromRegistry` that looks up the
 * `agentWorkflowRef`. The embedded snapshot is used ONLY as a degraded read when
 * the registry does not resolve, and always with a warning; it is never the
 * source of truth. Neither available → `unresolved` (the CALL_REF_MISSING-style
 * broken reference the react layer badges).
 */
export function resolveAgentWorkflow(
  node: BpmnNode,
  resolveFromRegistry: (ref: string) => unknown | undefined,
  locale: 'en' | 'pt' = 'en',
): AgentWorkflowResolution {
  const ref = typeof node.properties.agentWorkflowRef === 'string' ? node.properties.agentWorkflowRef : undefined;
  if (ref !== undefined) {
    const fromRegistry = resolveFromRegistry(ref);
    if (fromRegistry !== undefined) return { source: 'registry', workflow: fromRegistry };
  }
  const snapshot = node.properties.agentWorkflowSnapshot;
  if (typeof snapshot === 'string') {
    try {
      return {
        source: 'snapshot',
        workflow: JSON.parse(snapshot),
        warning: locale === 'pt' ? 'snapshot — registry indisponível' : 'snapshot — registry unavailable',
      };
    } catch {
      // Corrupt snapshot — fall through to unresolved rather than guess.
    }
  }
  return { source: 'unresolved' };
}
