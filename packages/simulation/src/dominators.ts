import type { SimGraph } from './graph.js';

/**
 * Dominator analysis over the simulation control-flow graph, used to give the
 * inclusive (OR) join a correct convergence rule.
 *
 * A node D *dominates* node N when every path from the process start to N goes
 * through D. For an OR-join J this answers "does this live token exist only
 * because a token already passed through J?" — if J dominates the token, its
 * future arrival at J belongs to a *later* loop iteration, not the activation J
 * is currently waiting on, so it must not hold the join open.
 *
 * Implementation is the Cooper-Harvey-Kennedy "simple, fast dominance"
 * algorithm (iterative dataflow over reverse-postorder). It is O(N^2) worst
 * case but, as the paper shows, outperforms Lengauer-Tarjan on the small,
 * near-reducible control-flow graphs a BPMN diagram produces — and the simpler
 * code is far easier to audit, which matters for a correctness-critical path.
 */

/** Synthetic entry that dominates every real start node (not a valid node id). */
const ENTRY = '@@entry@@';

/**
 * Immediate-dominator map (`node -> idom`). Nodes unreachable from a start are
 * absent. The synthetic {@link ENTRY} is its own idom and never a real node.
 */
export function computeDominators(graph: SimGraph): Map<string, string> {
  const seeds =
    graph.starts.length > 0
      ? graph.starts
      : [...graph.nodes.values()].filter((n) => n.incoming.length === 0).map((n) => n.id);

  const successors = (id: string): string[] => {
    if (id === ENTRY) return seeds;
    const node = graph.nodes.get(id);
    if (!node) return [];
    return node.outgoing.map((edgeId) => graph.edges.get(edgeId)!.target);
  };

  const preds = new Map<string, string[]>();
  const addPred = (node: string, pred: string) => {
    const list = preds.get(node);
    if (list) list.push(pred);
    else preds.set(node, [pred]);
  };
  for (const seed of seeds) addPred(seed, ENTRY);
  for (const node of graph.nodes.values()) {
    for (const edgeId of node.outgoing) {
      addPred(graph.edges.get(edgeId)!.target, node.id);
    }
  }

  // Postorder DFS from ENTRY (iterative — BPMN graphs are small but cycles must
  // not recurse forever).
  const visited = new Set<string>();
  const postorder: string[] = [];
  const stack: Array<{ id: string; next: number }> = [{ id: ENTRY, next: 0 }];
  visited.add(ENTRY);
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const succ = successors(frame.id);
    if (frame.next < succ.length) {
      const child = succ[frame.next++];
      if (!visited.has(child)) {
        visited.add(child);
        stack.push({ id: child, next: 0 });
      }
    } else {
      postorder.push(frame.id);
      stack.pop();
    }
  }

  const order = [...postorder].reverse(); // reverse postorder
  const rpo = new Map<string, number>();
  order.forEach((id, index) => rpo.set(id, index));

  const idom = new Map<string, string>();
  idom.set(ENTRY, ENTRY);

  // Walk two fingers up the (partial) dominator tree to their common ancestor.
  const intersect = (a: string, b: string): string => {
    let finger1 = a;
    let finger2 = b;
    while (finger1 !== finger2) {
      while ((rpo.get(finger1) ?? 0) > (rpo.get(finger2) ?? 0)) finger1 = idom.get(finger1)!;
      while ((rpo.get(finger2) ?? 0) > (rpo.get(finger1) ?? 0)) finger2 = idom.get(finger2)!;
    }
    return finger1;
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const b of order) {
      if (b === ENTRY) continue;
      const processed = (preds.get(b) ?? []).filter((p) => idom.has(p));
      if (processed.length === 0) continue;
      let newIdom = processed[0];
      for (let i = 1; i < processed.length; i++) newIdom = intersect(processed[i], newIdom);
      if (idom.get(b) !== newIdom) {
        idom.set(b, newIdom);
        changed = true;
      }
    }
  }

  idom.delete(ENTRY);
  return idom;
}

/**
 * True when `a` dominates `b` (every start->`b` path passes through `a`).
 * Reflexive: a node dominates itself. Returns false when `b` is unreachable.
 */
export function dominates(idom: Map<string, string>, a: string, b: string): boolean {
  if (a === b) return true;
  const seen = new Set<string>();
  let current = idom.get(b);
  while (current !== undefined && !seen.has(current)) {
    if (current === a) return true;
    seen.add(current);
    current = idom.get(current);
  }
  return false;
}
