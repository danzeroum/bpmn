import type { SimGraph } from './graph.js';

/** One structural route through the graph, from a start to a terminal. */
export interface CoveragePath {
  /** Stable signature (the traversed edge ids joined) — dedupe key. */
  id: string;
  /** Human-readable label: the node labels along the route. */
  label: string;
  /** Ordered sequence-flow edge ids that define the route. */
  edges: string[];
}

/** Snapshot of coverage for the panel checklist (Handoff 7A §3.3). */
export interface CoverageSummary {
  total: number;
  covered: number;
  /** True when path enumeration hit the safety cap (see {@link MAX_PATHS}). */
  truncated: boolean;
  paths: (CoveragePath & { covered: boolean })[];
}

/** Safety cap: inclusive/boundary branching can blow up combinatorially. */
export const MAX_PATHS = 1000;

/**
 * Enumerates the distinct structural paths through a simulation graph — the
 * checklist the coverage panel shows. This is the **same graph the soundness
 * analysis reasons over** (Handoff 7 §7.2): each XOR / event-based / inclusive
 * branch and each boundary event is a fork; a parallel branch is followed like
 * any other edge (a single session that fans out covers every branch it runs).
 * Cycles are cut the first time an edge repeats, so enumeration always
 * terminates.
 *
 * Inclusive splits are enumerated one branch at a time (not the power set) —
 * an intentional approximation kept in step with the approximate OR semantics
 * and documented in `docs/limitations.md`.
 */
export function enumerateStructuralPaths(graph: SimGraph): CoveragePath[] {
  const paths: CoveragePath[] = [];
  const seen = new Set<string>();
  let truncated = false;

  const emit = (edges: string[], nodes: string[]) => {
    const id = edges.join('>');
    if (seen.has(id)) return;
    seen.add(id);
    const label = nodes.map((n) => graph.nodes.get(n)?.label || n).join(' → ');
    paths.push({ id, label, edges });
  };

  const walk = (nodeId: string, edges: string[], nodes: string[], used: Set<string>) => {
    if (paths.length >= MAX_PATHS) {
      truncated = true;
      return;
    }
    const node = graph.nodes.get(nodeId);
    if (!node) return;
    // Every way forward: own outgoing flows, plus each boundary event's flows.
    const options: { edge: string; next: string }[] = [];
    for (const edgeId of node.outgoing) {
      options.push({ edge: edgeId, next: graph.edges.get(edgeId)!.target });
    }
    for (const boundaryId of graph.boundariesByHost.get(nodeId) ?? []) {
      const boundary = graph.nodes.get(boundaryId)!;
      for (const edgeId of boundary.outgoing) {
        options.push({ edge: edgeId, next: graph.edges.get(edgeId)!.target });
      }
    }
    const open = options.filter((o) => !used.has(o.edge));
    if (open.length === 0) {
      emit(edges, nodes);
      return;
    }
    for (const option of open) {
      walk(
        option.next,
        [...edges, option.edge],
        [...nodes, option.next],
        new Set(used).add(option.edge),
      );
    }
  };

  const seeds =
    graph.starts.length > 0
      ? graph.starts
      : [...graph.nodes.values()].filter((n) => n.incoming.length === 0).map((n) => n.id);
  for (const seed of seeds) {
    walk(seed, [], [seed], new Set());
  }
  if (truncated && paths.length > 0) paths[paths.length - 1].label += ' …';
  return paths;
}

/**
 * Tracks which structural paths a set of sessions has exercised. Held by the
 * host across engine resets, so "restart" keeps coverage (Handoff 7A §3.1). A
 * path counts as covered once a session's traversed edges include all of it.
 */
export class CoverageTracker {
  readonly paths: CoveragePath[];
  private readonly coveredIds = new Set<string>();
  private readonly truncated: boolean;

  constructor(graph: SimGraph) {
    this.paths = enumerateStructuralPaths(graph);
    this.truncated = this.paths.length >= MAX_PATHS;
  }

  /** Fold a completed session's traversed edges in; returns newly covered ids. */
  record(traversedEdges: Iterable<string>): string[] {
    const edges = new Set(traversedEdges);
    const fresh: string[] = [];
    for (const path of this.paths) {
      if (this.coveredIds.has(path.id)) continue;
      if (path.edges.length > 0 && path.edges.every((e) => edges.has(e))) {
        this.coveredIds.add(path.id);
        fresh.push(path.id);
      }
    }
    return fresh;
  }

  isCovered(pathId: string): boolean {
    return this.coveredIds.has(pathId);
  }

  get summary(): CoverageSummary {
    return {
      total: this.paths.length,
      covered: this.coveredIds.size,
      truncated: this.truncated,
      paths: this.paths.map((p) => ({ ...p, covered: this.coveredIds.has(p.id) })),
    };
  }
}
