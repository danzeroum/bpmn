import {
  activeEdges,
  activeNodes,
  boundaryAttachedTo,
  flowScopeOf,
  isFlowEdge,
  isFlowNode,
  type BpmnDiagram,
  type BpmnNode,
} from '@buildtovalue/core';

/**
 * The sequence-flow graph the soundness rules run on. Built once per
 * validation (Handoff 4 §C1) and analyzed per SCOPE: the top process level
 * and each sub-process form their own subgraph, so every rule traverses the
 * F7 hierarchy without special cases.
 *
 * Structural analysis only — adjacency, reachability, SCCs. Never state
 * space (§3 do handoff).
 */
export interface FlowEdge {
  edgeId: string;
  source: string;
  target: string;
  /** True for the synthetic host → boundary-event edge (not a real flow). */
  implicit?: boolean;
}

export interface ScopeGraph {
  /** Sub-process id, or `undefined` for the top process level. */
  scope: string | undefined;
  /** Flow nodes in this scope, by id. */
  nodes: Map<string, BpmnNode>;
  out: Map<string, FlowEdge[]>;
  in: Map<string, FlowEdge[]>;
  /** Start events of this scope. */
  starts: string[];
  /**
   * Nodes that terminate this scope: its end events, or — BPMN allows an
   * implicit end — the sink nodes (no outgoing flow) when it has none.
   */
  ends: string[];
}

// Flow classification is hosted in core (`model/flow.ts`) and re-exported
// here so this package's public API is unchanged.
export { isFlowNode, isFlowEdge, flowScopeOf } from '@buildtovalue/core';

/**
 * Builds the per-scope flow graphs for a diagram. Closed (removed) elements
 * are excluded — soundness describes the process as it will run. Boundary
 * events get a synthetic incoming edge from their host so reachability sees
 * them (control arrives via the attachment, not a sequence flow).
 */
export function buildScopeGraphs(diagram: BpmnDiagram): ScopeGraph[] {
  const graphs = new Map<string | undefined, ScopeGraph>();
  const scopeOf = new Map<string, string | undefined>();

  const graphFor = (scope: string | undefined): ScopeGraph => {
    let graph = graphs.get(scope);
    if (!graph) {
      graph = {
        scope,
        nodes: new Map(),
        out: new Map(),
        in: new Map(),
        starts: [],
        ends: [],
      };
      graphs.set(scope, graph);
    }
    return graph;
  };

  for (const node of activeNodes(diagram)) {
    if (!isFlowNode(node)) continue;
    const scope = flowScopeOf(diagram, node);
    scopeOf.set(node.id, scope);
    const graph = graphFor(scope);
    graph.nodes.set(node.id, node);
    graph.out.set(node.id, []);
    graph.in.set(node.id, []);
    if (node.type === 'startEvent') graph.starts.push(node.id);
  }

  const link = (graph: ScopeGraph, flow: FlowEdge) => {
    graph.out.get(flow.source)!.push(flow);
    graph.in.get(flow.target)!.push(flow);
  };

  for (const edge of activeEdges(diagram)) {
    if (!isFlowEdge(edge)) continue;
    // Endpoints must exist as flow nodes in the SAME scope — dangling refs
    // and cross-scope flows are core validation errors, not soundness input.
    if (!scopeOf.has(edge.sourceId) || !scopeOf.has(edge.targetId)) continue;
    const sourceScope = scopeOf.get(edge.sourceId);
    if (sourceScope !== scopeOf.get(edge.targetId)) continue;
    link(graphFor(sourceScope), { edgeId: edge.id, source: edge.sourceId, target: edge.targetId });
  }

  // Synthetic host → boundary edges (reachability only; marked implicit).
  for (const [nodeId, scope] of scopeOf) {
    const node = diagram.nodes[nodeId];
    const host = node ? boundaryAttachedTo(node) : undefined;
    if (!host || !scopeOf.has(host) || scopeOf.get(host) !== scope) continue;
    link(graphFor(scope), {
      edgeId: `implicit:${host}->${nodeId}`,
      source: host,
      target: nodeId,
      implicit: true,
    });
  }

  for (const graph of graphs.values()) {
    const endEvents = [...graph.nodes.values()].filter((n) => n.type === 'endEvent');
    graph.ends =
      endEvents.length > 0
        ? endEvents.map((n) => n.id)
        : [...graph.nodes.keys()].filter((id) => graph.out.get(id)!.length === 0);
  }

  return [...graphs.values()];
}

/** Forward reachability from a seed set (BFS, O(V+E)). */
export function reachableFrom(graph: ScopeGraph, seeds: Iterable<string>): Set<string> {
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const seed of seeds) {
    if (graph.nodes.has(seed) && !seen.has(seed)) {
      seen.add(seed);
      queue.push(seed);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const flow of graph.out.get(current) ?? []) {
      if (!seen.has(flow.target)) {
        seen.add(flow.target);
        queue.push(flow.target);
      }
    }
  }
  return seen;
}

/** Backward reachability towards a seed set (BFS over incoming edges). */
export function coReachableTo(graph: ScopeGraph, seeds: Iterable<string>): Set<string> {
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const seed of seeds) {
    if (graph.nodes.has(seed) && !seen.has(seed)) {
      seen.add(seed);
      queue.push(seed);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const flow of graph.in.get(current) ?? []) {
      if (!seen.has(flow.source)) {
        seen.add(flow.source);
        queue.push(flow.source);
      }
    }
  }
  return seen;
}

/**
 * Strongly connected components (Tarjan, iterative — no recursion so deep
 * chains can't overflow the stack). Returns only the components that form a
 * real cycle: two or more nodes, or a single node with a self-loop.
 */
export function cyclicComponents(graph: ScopeGraph): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];

  for (const root of graph.nodes.keys()) {
    if (indices.has(root)) continue;
    // Iterative Tarjan: frames carry the node and its edge cursor.
    const frames: { node: string; edgeIndex: number }[] = [{ node: root, edgeIndex: 0 }];
    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      const { node } = frame;
      if (frame.edgeIndex === 0) {
        indices.set(node, index);
        lowlinks.set(node, index);
        index += 1;
        stack.push(node);
        onStack.add(node);
      }
      const edges = graph.out.get(node) ?? [];
      let advanced = false;
      while (frame.edgeIndex < edges.length) {
        const target = edges[frame.edgeIndex].target;
        frame.edgeIndex += 1;
        if (!indices.has(target)) {
          frames.push({ node: target, edgeIndex: 0 });
          advanced = true;
          break;
        }
        if (onStack.has(target)) {
          lowlinks.set(node, Math.min(lowlinks.get(node)!, indices.get(target)!));
        }
      }
      if (advanced) continue;
      // Node finished: pop the frame, close the component if it's a root.
      frames.pop();
      const parent = frames[frames.length - 1];
      if (parent) {
        lowlinks.set(parent.node, Math.min(lowlinks.get(parent.node)!, lowlinks.get(node)!));
      }
      if (lowlinks.get(node) === indices.get(node)) {
        const component: string[] = [];
        let member: string;
        do {
          member = stack.pop()!;
          onStack.delete(member);
          component.push(member);
        } while (member !== node);
        const selfLoop =
          component.length === 1 &&
          (graph.out.get(component[0]) ?? []).some((flow) => flow.target === component[0]);
        if (component.length > 1 || selfLoop) components.push(component);
      }
    }
  }
  return components;
}
