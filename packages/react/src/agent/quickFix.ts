import {
  canReach,
  END_ROUTE,
  nodeIndex,
  type AgentWorkflow,
  type DecisionRoute,
  type ValidationIssue,
} from '@buildtovalue/agentflow';
import { updateNodeConfig, type EditResult } from './agentEditor.js';

/**
 * Safe, reversible quick-fixes (Squad Lane SL-6). A quick-fix produces ONE
 * ordinary {@link EditResult} applied through the modal's single undoable
 * command/undo stack (never a parallel mutation path). Only fixes that CANNOT
 * change the I/O contract are offered — contract/gate problems
 * (`TOOL_EFFECT_UNGATED`, `TOOL_PARAMS_MISMATCH`, `DELEGATE_CONTRACT_MISMATCH`,
 * empty-schema, …) intentionally have NO quick-fix (cerca §2 / prototype 04).
 */

/** The codes with a safe, reversible, non-I/O quick-fix. */
export const SAFE_QUICK_FIX_CODES: readonly string[] = ['RETRY_WITHOUT_MAX', 'LLM_NOT_STRUCTURED'];

/** True when a code offers a safe quick-fix. */
export function hasQuickFix(code: string): boolean {
  return SAFE_QUICK_FIX_CODES.includes(code);
}

/**
 * Builds the safe edit for an issue, or `null` when there is no safe fix. The
 * caller applies the result through the isolated editor stack (undoable).
 */
export function quickFixFor(issue: ValidationIssue, wf: AgentWorkflow): EditResult | null {
  if (!issue.nodeId) return null;
  const node = wf.nodes.find((n) => n.id === issue.nodeId);
  if (!node) return null;

  // LLM_NOT_STRUCTURED → force JSON mode; touches only the node config, never I/O.
  if (issue.code === 'LLM_NOT_STRUCTURED' && node.type === 'llm') {
    return updateNodeConfig(wf, node.id, { structuredOutput: true });
  }

  // RETRY_WITHOUT_MAX → bound the loop-back route(s) that lack a maxRetries.
  if (issue.code === 'RETRY_WITHOUT_MAX' && node.type === 'decision') {
    const index = nodeIndex(wf);
    const bound = (route: DecisionRoute): DecisionRoute =>
      route.maxRetries === undefined &&
      route.next !== END_ROUTE &&
      index.has(route.next) &&
      canReach(wf, route.next, node.id, index)
        ? { ...route, maxRetries: 3 }
        : route;
    return updateNodeConfig(wf, node.id, {
      onTrue: bound(node.config.onTrue),
      onFalse: bound(node.config.onFalse),
    });
  }

  return null;
}
