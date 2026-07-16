import type { BpmnDiagram, BpmnEdge, BpmnNode, Point } from '../model/types.js';
import { isFlowEdge } from '../model/flow.js';
import { computeDiff, type FieldChange } from './index.js';

/**
 * Review-grade semantic diff (Handoff 15 §2a, V-1): classifies the raw
 * {@link computeDiff} output into the five review categories and returns the
 * entries in a STABLE graph-reading order — the single list every review
 * surface consumes (canvas overlay, change-by-change navigation, the Studio
 * "Mudanças" tab). Headless, deterministic, zero new dependencies;
 * `computeDiff`/`DiffView` are untouched.
 *
 * Classification (validated in the V-0 reconciliation):
 * - node update whose only changes are `x`/`y`            → `moved`
 * - node update with position AND other fields            → `changed` + `moved: true`
 * - edge update whose only change is `waypoints`          → `rerouted` (its own
 *   category — a re-route never pollutes a node's ΔN nor counts as `changed`)
 * - `removedInVersion` set in the target                  → `removed` (a closed
 *   element IS removed for review purposes); cleared → `added` (reopened)
 * - edge supersession                                     → `changed` with a
 *   `supersededBy` field change
 * - `changes` NEVER includes `x`/`y`/`waypoints`/`removedInVersion` — its size
 *   is the ΔN badge.
 */
export type DiffKind = 'added' | 'removed' | 'moved' | 'changed' | 'rerouted';

export interface DiffEntry {
  kind: DiffKind;
  elementKind: 'node' | 'edge';
  elementId: string;
  /** Label for lists/a11y — target's when present, else the base's. */
  label?: string;
  /** ΔN content: field → from/to, excluding x/y/waypoints/removedInVersion. */
  changes?: Record<string, FieldChange>;
  /** Node position in the BASE version (removed ghost / move origin). */
  from?: Point;
  /** Node position in the TARGET version (move destination). */
  to?: Point;
  /** `changed` entries that ALSO moved — render draws halo + origin arrow. */
  moved?: boolean;
}

/** Geometry fields — movement, never part of ΔN. */
const NODE_GEOMETRY = new Set(['x', 'y']);
/** Route field — `rerouted`, never part of ΔN. */
const EDGE_ROUTE = new Set(['waypoints']);
/** Lifecycle field — classified as removed/added, never part of ΔN. */
const LIFECYCLE = 'removedInVersion';

function nodePoint(node: BpmnNode | undefined): Point | undefined {
  return node ? { x: node.x, y: node.y } : undefined;
}

function withoutKeys(
  changes: Record<string, FieldChange>,
  excluded: (key: string) => boolean,
): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {};
  for (const [key, change] of Object.entries(changes)) {
    if (!excluded(key)) out[key] = change;
  }
  return out;
}

/**
 * Graph-reading ranks for ORDERING (2b "ordem estável de leitura do grafo"):
 * BFS over sequence-flow edges from the source nodes (no incoming flow),
 * cycles tolerated; unreachable nodes rank after the reachable graph. Pure
 * function of the diagram's CONTENT — never of map insertion order.
 */
function flowRanks(diagram: BpmnDiagram): Map<string, number> {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const ids = Object.keys(diagram.nodes).sort();
  for (const id of ids) {
    incoming.set(id, 0);
    outgoing.set(id, []);
  }
  for (const edge of Object.values(diagram.edges)) {
    if (!isFlowEdge(edge) || edge.removedInVersion) continue;
    if (!(edge.sourceId in diagram.nodes) || !(edge.targetId in diagram.nodes)) continue;
    if (edge.sourceId === edge.targetId) continue;
    incoming.set(edge.targetId, (incoming.get(edge.targetId) ?? 0) + 1);
    outgoing.get(edge.sourceId)?.push(edge.targetId);
  }
  const ranks = new Map<string, number>();
  // Deterministic BFS: sources in sorted-id order, neighbours in sorted order.
  const queue = ids.filter((id) => (incoming.get(id) ?? 0) === 0);
  for (const id of queue) ranks.set(id, 0);
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const rank = ranks.get(current) ?? 0;
    for (const next of [...(outgoing.get(current) ?? [])].sort()) {
      if (ranks.has(next)) continue; // cycle / joined path — first rank wins
      ranks.set(next, rank + 1);
      queue.push(next);
    }
  }
  // Cycle-only or disconnected nodes: after the reachable graph, stable order.
  let tail = queue.length === 0 ? 0 : Math.max(...ranks.values()) + 1;
  for (const id of ids) {
    if (!ranks.has(id)) ranks.set(id, tail++);
  }
  return ranks;
}

function classifyNode(
  base: BpmnNode | undefined,
  target: BpmnNode | undefined,
  rawChanges: Record<string, FieldChange> | undefined,
): DiffEntry | null {
  const id = (target ?? base)!.id;
  const label = target?.label || base?.label || undefined;
  const common = { elementKind: 'node' as const, elementId: id, ...(label ? { label } : {}) };

  if (!base && target) {
    return { kind: 'added', ...common, to: nodePoint(target) };
  }
  if (base && !target) {
    return { kind: 'removed', ...common, from: nodePoint(base) };
  }
  if (!rawChanges) return null;

  // Lifecycle first: closing IS removal for review; reopening is an addition.
  const lifecycle = rawChanges[LIFECYCLE];
  if (lifecycle) {
    return lifecycle.to
      ? { kind: 'removed', ...common, from: nodePoint(base) }
      : { kind: 'added', ...common, to: nodePoint(target) };
  }

  const movedNow = Object.keys(rawChanges).some((key) => NODE_GEOMETRY.has(key));
  const changes = withoutKeys(rawChanges, (key) => NODE_GEOMETRY.has(key) || key === LIFECYCLE);
  const hasChanges = Object.keys(changes).length > 0;
  if (movedNow && !hasChanges) {
    return { kind: 'moved', ...common, from: nodePoint(base), to: nodePoint(target) };
  }
  if (hasChanges) {
    return {
      kind: 'changed',
      ...common,
      changes,
      ...(movedNow ? { moved: true, from: nodePoint(base), to: nodePoint(target) } : {}),
    };
  }
  return null;
}

function classifyEdge(
  base: BpmnEdge | undefined,
  target: BpmnEdge | undefined,
  rawChanges: Record<string, FieldChange> | undefined,
  supersededBy?: string,
): DiffEntry | null {
  const id = (target ?? base)!.id;
  const label = target?.label || base?.label || undefined;
  const common = { elementKind: 'edge' as const, elementId: id, ...(label ? { label } : {}) };

  if (supersededBy) {
    return {
      kind: 'changed',
      elementKind: 'edge',
      elementId: base!.id,
      ...(base!.label ? { label: base!.label } : {}),
      changes: { supersededBy: { from: null, to: supersededBy } },
    };
  }
  if (!base && target) return { kind: 'added', ...common };
  if (base && !target) return { kind: 'removed', ...common };
  if (!rawChanges) return null;

  const lifecycle = rawChanges[LIFECYCLE];
  if (lifecycle) {
    return lifecycle.to ? { kind: 'removed', ...common } : { kind: 'added', ...common };
  }

  const reroutedNow = Object.keys(rawChanges).some((key) => EDGE_ROUTE.has(key));
  const changes = withoutKeys(rawChanges, (key) => EDGE_ROUTE.has(key) || key === LIFECYCLE);
  const hasChanges = Object.keys(changes).length > 0;
  if (reroutedNow && !hasChanges) {
    return { kind: 'rerouted', ...common };
  }
  if (hasChanges) {
    return { kind: 'changed', ...common, changes };
  }
  return null;
}

/**
 * The V-1 entry point: classified, deterministically ordered review diff.
 * Ordering: topological graph-reading rank (target graph; elements absent
 * from the target rank by the BASE graph), ties broken by base-version
 * position (y, then x), then nodes before their edges, then id — a pure
 * function of content, proven by the shuffle test.
 */
export function diffDiagrams(base: BpmnDiagram, target: BpmnDiagram): DiffEntry[] {
  const raw = computeDiff(base, target);
  const entries: DiffEntry[] = [];

  for (const op of raw.nodes) {
    const entry =
      op.op === 'add'
        ? classifyNode(undefined, op.node, undefined)
        : op.op === 'remove'
          ? classifyNode(base.nodes[op.nodeId], undefined, undefined)
          : classifyNode(base.nodes[op.nodeId], target.nodes[op.nodeId], op.changes);
    if (entry) entries.push(entry);
  }
  for (const op of raw.edges) {
    const entry =
      op.op === 'add'
        ? classifyEdge(undefined, op.edge, undefined)
        : op.op === 'remove'
          ? classifyEdge(base.edges[op.edgeId], undefined, undefined)
          : op.op === 'supersede'
            ? // Temporal shape (old edge CLOSED but still in the map): the
              // replacement is genuinely new content — `added`; the old edge's
              // own removedInVersion update reports the `removed` side. Hard
              // replacement (old edge gone): ONE `changed` entry on the old id
              // carrying the supersededBy breadcrumb.
              target.edges[op.edgeId]
              ? classifyEdge(undefined, target.edges[op.newEdgeId], undefined)
              : classifyEdge(base.edges[op.edgeId], undefined, undefined, op.newEdgeId)
            : classifyEdge(base.edges[op.edgeId], target.edges[op.edgeId], op.changes);
    if (entry) entries.push(entry);
  }

  const targetRanks = flowRanks(target);
  const baseRanks = flowRanks(base);
  const rankOf = (entry: DiffEntry): number => {
    if (entry.elementKind === 'node') {
      return targetRanks.get(entry.elementId) ?? baseRanks.get(entry.elementId) ?? Number.MAX_SAFE_INTEGER;
    }
    // Edges read right after their latest endpoint.
    const edge = target.edges[entry.elementId] ?? base.edges[entry.elementId];
    if (!edge) return Number.MAX_SAFE_INTEGER;
    const rank = (nodeId: string) =>
      targetRanks.get(nodeId) ?? baseRanks.get(nodeId) ?? Number.MAX_SAFE_INTEGER - 1;
    return Math.max(rank(edge.sourceId), rank(edge.targetId)) + 0.5;
  };
  const posOf = (entry: DiffEntry): Point => {
    if (entry.elementKind === 'node') {
      const node = base.nodes[entry.elementId] ?? target.nodes[entry.elementId];
      return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
    }
    const edge = base.edges[entry.elementId] ?? target.edges[entry.elementId];
    const source = edge ? (base.nodes[edge.sourceId] ?? target.nodes[edge.sourceId]) : undefined;
    return source ? { x: source.x, y: source.y } : { x: 0, y: 0 };
  };

  return entries
    .map((entry) => ({ entry, rank: rankOf(entry), pos: posOf(entry) }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.pos.y !== b.pos.y) return a.pos.y - b.pos.y;
      if (a.pos.x !== b.pos.x) return a.pos.x - b.pos.x;
      return a.entry.elementId < b.entry.elementId ? -1 : a.entry.elementId > b.entry.elementId ? 1 : 0;
    })
    .map(({ entry }) => entry);
}
