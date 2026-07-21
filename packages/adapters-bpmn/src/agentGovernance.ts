import type { BpmnDiagram, RuleVerdict } from '@buildtovalue/core';
import { runEvalSet, toRef, validateGraph, type AgentWorkflow, type EvalSet } from '@buildtovalue/agentflow';
import type { LifecycleStatus } from '@buildtovalue/library';
import type { AgentArtifactSource } from './agentWorkflowAdapter.js';

/**
 * Agent Lane (Handoff 12 A-6) — governance glue for the agent artifact.
 * Promoting an agent runs the SAME checks (cerca §5): the §3 graph validation
 * must be green (a gate, the standard evaluateGates/PromotionRule verdict
 * shape), and — for a process referencing an agent — the currency (vigência)
 * warning is REUSED from the call activity: an active process pointing at a
 * candidate/deprecated agent version warns at promotion.
 */

/**
 * Promotion gate for an agent version (§5): the agentflow §3 graph validation
 * must produce no error, or promotion is blocked. Returns the standard
 * {@link RuleVerdict} so it drops into the same governance path as
 * `soundnessPromotionRule` / the autonomy→gate rule.
 */
export function agentPromotionGate(workflow: AgentWorkflow, locale: 'en' | 'pt' = 'en'): RuleVerdict {
  const errors = validateGraph(workflow).filter((issue) => issue.severity === 'error');
  if (errors.length === 0) return { allowed: true };
  const codes = [...new Set(errors.map((e) => e.code))].join(', ');
  return {
    allowed: false,
    reason:
      locale === 'pt'
        ? `Validação do grafo: ${errors.length} erro(s) §3 bloqueiam a promoção — ${codes}`
        : `Graph validation: ${errors.length} §3 error(s) block promotion — ${codes}`,
  };
}

/**
 * Squad Lane SL-7 — the EvalSet promotion gate. Running the target's eval set
 * below its `promotionThreshold` blocks promotion to active, expressed through
 * the SAME {@link RuleVerdict} shape as `agentPromotionGate` (reusing the
 * evaluateGates/PromotionRule path, not a new mechanism). `EVAL_BELOW_THRESHOLD`
 * is the stable token in the reason (the codes-in-reason convention). An eval
 * with no assertions never blocks (honest degradation — nothing to fail).
 */
export function evalPromotionGate(
  workflow: AgentWorkflow,
  evalSet: EvalSet,
  locale: 'en' | 'pt' = 'en',
): RuleVerdict {
  const report = runEvalSet(evalSet, workflow);
  if (report.total === 0 || report.meetsThreshold) return { allowed: true };
  const pct = Math.round(report.passRate * 100);
  const threshold = Math.round(report.threshold * 100);
  return {
    allowed: false,
    reason:
      locale === 'pt'
        ? `EVAL_BELOW_THRESHOLD: avaliação passou ${report.passed}/${report.total} (${pct}%), abaixo do limiar ${threshold}%`
        : `EVAL_BELOW_THRESHOLD: eval passed ${report.passed}/${report.total} (${pct}%), below threshold ${threshold}%`,
  };
}

/** A process→agent reference whose target version is not current (§5). */
export interface AgentReferenceWarning {
  nodeId: string;
  ref: string;
  status: LifecycleStatus;
  message: string;
}

/**
 * Currency (vigência) warnings for a process that references agents (§5) —
 * the SAME rule as the call activity, not a new one: an agentTask pointing at
 * an agent version that is not `active` (candidate/deprecated/…) warns at
 * promotion. Resolution is against the injected agent source (the analog of
 * `resolveCallActivities`). An unresolved ref is NOT a currency warning — that
 * is the CALL_REF_MISSING badge the shape already reuses (A-3/A-4).
 */
export function agentReferenceCurrencyWarnings(
  diagram: BpmnDiagram,
  source: AgentArtifactSource,
  locale: 'en' | 'pt' = 'en',
): AgentReferenceWarning[] {
  const versions = source();
  const warnings: AgentReferenceWarning[] = [];
  for (const node of Object.values(diagram.nodes)) {
    if (node.type !== 'agentTask') continue;
    const ref = node.properties.agentWorkflowRef;
    if (typeof ref !== 'string') continue;
    let parsed;
    try {
      parsed = toRef(ref);
    } catch {
      continue; // malformed ref is a validation error elsewhere, not currency
    }
    const match = versions.find(
      (v) => v.workflow.id === parsed.id && v.workflow.version === parsed.version,
    );
    if (!match || match.status === 'active') continue; // resolved & current → no warning
    warnings.push({
      nodeId: node.id,
      ref,
      status: match.status,
      message:
        locale === 'pt'
          ? `O processo referencia o agente ${ref}, que está "${match.status}" (não ativo) — vigência: mesma regra do callActivity.`
          : `Process references agent ${ref}, which is "${match.status}" (not active) — currency: same rule as the call activity.`,
    });
  }
  return warnings;
}
