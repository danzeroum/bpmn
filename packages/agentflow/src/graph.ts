/**
 * Pure graph helpers over an {@link AgentWorkflow}. No ecosystem imports
 * (independence test) — this is the abstract-graph core the validator and the
 * autonomy rule reason over.
 *
 * Control flow is a MERGE of two representations the schema carries (§3):
 *   - `decision` nodes route through their `config.onTrue`/`config.onFalse`
 *     (targets are a node id or the sink `"end"`) — authoritative for decisions;
 *   - `llm`/`tool` nodes flow along their outgoing `edges` (a `delegate` edge is
 *     a cross-agent reference, NOT internal flow, so it is excluded here).
 */

import { END_ROUTE, type AgentNode, type AgentWorkflow, type DecisionNode } from './types.js';

/** id → node, for O(1) lookup. */
export function nodeIndex(wf: AgentWorkflow): Map<string, AgentNode> {
  return new Map(wf.nodes.map((n) => [n.id, n]));
}

/** True when the workflow has any `delegate` edge (→ autonomy level 4). */
export function hasDelegateEdge(wf: AgentWorkflow): boolean {
  return wf.edges.some((e) => e.edgeType === 'delegate');
}

/** The two routes of a decision, labeled. */
export function decisionRoutes(node: DecisionNode): { branch: 'onTrue' | 'onFalse'; next: string; maxRetries?: number }[] {
  return [
    { branch: 'onTrue', next: node.config.onTrue.next, maxRetries: node.config.onTrue.maxRetries },
    { branch: 'onFalse', next: node.config.onFalse.next, maxRetries: node.config.onFalse.maxRetries },
  ];
}

/**
 * Internal control-flow successors of a node (node ids only; `"end"` and
 * delegate targets are dropped). Decisions use their config routes; other
 * nodes use their non-delegate outgoing edges.
 */
export function internalSuccessors(wf: AgentWorkflow, id: string, index = nodeIndex(wf)): string[] {
  const node = index.get(id);
  if (!node) return [];
  if (node.type === 'decision') {
    return decisionRoutes(node)
      .map((r) => r.next)
      .filter((next) => next !== END_ROUTE && index.has(next));
  }
  return wf.edges
    .filter((e) => e.from === id && e.edgeType !== 'delegate')
    .map((e) => e.to)
    .filter((to) => index.has(to));
}

/** True when `target` is reachable from `from` along internal successors
 * (path length ≥ 1, so a node reaches itself only through a real cycle). */
export function canReach(wf: AgentWorkflow, from: string, target: string, index = nodeIndex(wf)): boolean {
  const seen = new Set<string>();
  const stack = [...internalSuccessors(wf, from, index)];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === target) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...internalSuccessors(wf, cur, index));
  }
  return false;
}

/**
 * Strongly connected components with ≥1 internal edge (Tarjan). A returned
 * component is either a multi-node cycle or a single self-looping node — the
 * exact set of "loop" nodes. Trivial single-node components are omitted.
 */
export function loopComponents(wf: AgentWorkflow, index = nodeIndex(wf)): string[][] {
  let counter = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];

  const strongconnect = (v: string): void => {
    idx.set(v, counter);
    low.set(v, counter);
    counter += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of internalSuccessors(wf, v, index)) {
      if (!idx.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      const isLoop =
        component.length > 1 ||
        internalSuccessors(wf, component[0], index).includes(component[0]);
      if (isLoop) components.push(component);
    }
  };

  for (const node of wf.nodes) {
    if (!idx.has(node.id)) strongconnect(node.id);
  }
  return components;
}

/** True when the internal graph contains a retry loop (→ autonomy level ≥ 2). */
export function hasRetryLoop(wf: AgentWorkflow): boolean {
  return loopComponents(wf).length > 0;
}

/**
 * True when some decision genuinely branches into distinct forward paths (→
 * autonomy level 3): both routes are forward (neither loops back to the
 * decision), their targets differ, and at least one target is a real node
 * (not the sink). A retry decision (one route loops back) or a pure
 * terminator (both routes end) does not count.
 */
export function isBranchingDecision(wf: AgentWorkflow): boolean {
  const index = nodeIndex(wf);
  for (const node of wf.nodes) {
    if (node.type !== 'decision') continue;
    const routes = decisionRoutes(node);
    const forward = routes.filter((r) => r.next === END_ROUTE || !canReach(wf, r.next, node.id, index));
    if (forward.length < 2) continue; // a route loops back → retry, not a branch
    const [a, b] = forward;
    if (a.next === b.next) continue; // same target → not a branch
    if (a.next === END_ROUTE && b.next === END_ROUTE) continue; // pure terminator
    return true;
  }
  return false;
}
