import type { BpmnDiagram, BpmnNode, Point } from '../model/types.js';
import {
  activeEdges,
  activeNodes,
  boundaryAttachedTo,
  isContainerType,
  nodeParentId,
} from '../model/types.js';
import { isFlowEdge, isFlowNode } from '../model/flow.js';

/**
 * Layered auto-layout (referência item 2) — a dependency-free Sugiyama-style
 * pass: longest-path ranking, barycenter ordering, predecessor-averaged row
 * placement. Deterministic (stable tie-breaks by id) so the same diagram
 * always lays out identically.
 *
 * v1 scope: the TOP process level of a single-process diagram. Diagrams with
 * pools/lanes keep their manual arrangement (`null` is returned — swimlane
 * layout is a dedicated post-1.0 effort, pendências §4). Sub-process children
 * and boundary events follow their host: children keep their offset relative
 * to the container; boundary events keep their anchor.
 */
export interface LayoutOptions {
  /** Horizontal gap between layers. Default 72. */
  gapX?: number;
  /** Vertical gap between nodes in a layer. Default 40. */
  gapY?: number;
  /** Top-left origin of the arrangement. Default {x: 60, y: 60}. */
  origin?: Point;
}

/**
 * Computes new positions for the layout scope. Returns `null` when the
 * diagram is outside the v1 scope (has pools/lanes) or has nothing to lay
 * out; otherwise a map of nodeId → new top-left position covering every
 * repositioned node (top-level flow nodes, their sub-process children and
 * attached boundary events).
 */
export function computeLayeredLayout(
  diagram: BpmnDiagram,
  options: LayoutOptions = {},
): Map<string, Point> | null {
  const gapX = options.gapX ?? 72;
  const gapY = options.gapY ?? 40;
  const origin = options.origin ?? { x: 60, y: 60 };

  const nodes = activeNodes(diagram);
  if (nodes.some((n) => isContainerType(n.type))) return null;

  // Layout the top scope: flow nodes without a parent, boundary events
  // excluded (they ride their host).
  const scope = nodes.filter(
    (n) => isFlowNode(n) && nodeParentId(n) === undefined && !boundaryAttachedTo(n),
  );
  if (scope.length === 0) return null;
  const scopeIds = new Set(scope.map((n) => n.id));

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const id of scopeIds) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }
  for (const edge of activeEdges(diagram)) {
    if (!isFlowEdge(edge)) continue;
    if (!scopeIds.has(edge.sourceId) || !scopeIds.has(edge.targetId)) continue;
    if (edge.sourceId === edge.targetId) continue;
    outgoing.get(edge.sourceId)!.push(edge.targetId);
    incoming.get(edge.targetId)!.push(edge.sourceId);
  }

  // 1. Ranking — longest path from the sources, DFS with a stack-based guard
  //    so cycles don't recurse forever (back edges are simply not deepened).
  const rank = new Map<string, number>();
  const sorted = [...scope].sort((a, b) => (a.id < b.id ? -1 : 1));
  const visitState = new Map<string, 'visiting' | 'done'>();
  const assign = (id: string, r: number) => {
    if ((rank.get(id) ?? -1) >= r && visitState.get(id) === 'done') return;
    if (visitState.get(id) === 'visiting') return; // back edge → ignore
    visitState.set(id, 'visiting');
    if ((rank.get(id) ?? -1) < r) rank.set(id, r);
    for (const next of outgoing.get(id) ?? []) assign(next, (rank.get(id) ?? 0) + 1);
    visitState.set(id, 'done');
  };
  for (const node of sorted) {
    if ((incoming.get(node.id) ?? []).length === 0) assign(node.id, 0);
  }
  // Disconnected/cyclic-only nodes still need a rank.
  for (const node of sorted) if (!rank.has(node.id)) assign(node.id, 0);

  // 2. Ordering — group by rank, then two barycenter sweeps over predecessors.
  const layers = new Map<number, string[]>();
  for (const node of sorted) {
    const r = rank.get(node.id) ?? 0;
    if (!layers.has(r)) layers.set(r, []);
    layers.get(r)!.push(node.id);
  }
  const layerIndex = new Map<string, number>();
  const refreshIndexes = () => {
    for (const ids of layers.values()) ids.forEach((id, i) => layerIndex.set(id, i));
  };
  refreshIndexes();
  const ranksAsc = [...layers.keys()].sort((a, b) => a - b);
  for (let sweep = 0; sweep < 2; sweep++) {
    for (const r of ranksAsc.slice(1)) {
      const ids = layers.get(r)!;
      const center = (id: string): number => {
        const preds = incoming.get(id) ?? [];
        const known = preds.filter((p) => layerIndex.has(p));
        if (known.length === 0) return layerIndex.get(id) ?? 0;
        return known.reduce((sum, p) => sum + (layerIndex.get(p) ?? 0), 0) / known.length;
      };
      ids.sort((a, b) => center(a) - center(b) || (a < b ? -1 : 1));
      refreshIndexes();
    }
  }

  // 3. Coordinates — per-layer column (width = widest node), rows averaged to
  //    predecessors' centers with overlap resolution top-down.
  const byId = new Map(scope.map((n) => [n.id, n]));
  const result = new Map<string, Point>();
  let x = origin.x;
  const centerY = new Map<string, number>();
  for (const r of ranksAsc) {
    const ids = layers.get(r)!;
    const columnWidth = Math.max(...ids.map((id) => byId.get(id)!.width));
    // Desired center: average of predecessors' centers (first layer: stacked).
    const desired = ids.map((id) => {
      const preds = (incoming.get(id) ?? []).filter((p) => centerY.has(p));
      if (preds.length === 0) return Number.NaN;
      return preds.reduce((sum, p) => sum + centerY.get(p)!, 0) / preds.length;
    });
    let cursor = origin.y;
    ids.forEach((id, i) => {
      const node = byId.get(id)!;
      let top = Number.isNaN(desired[i]) ? cursor : desired[i] - node.height / 2;
      if (top < cursor) top = cursor; // resolve overlap downwards
      result.set(id, { x: x + (columnWidth - node.width) / 2, y: round(top) });
      centerY.set(id, top + node.height / 2);
      cursor = top + node.height + gapY;
    });
    x += columnWidth + gapX;
  }

  // 4. Followers: sub-process children keep their offset inside the moved
  //    container; boundary events keep their offset on the moved host.
  for (const node of nodes) {
    if (result.has(node.id)) continue;
    const anchorId = boundaryAttachedTo(node) ?? nodeParentId(node);
    if (!anchorId) continue;
    // Resolve through nesting to a repositioned ancestor.
    let ancestor: BpmnNode | undefined = diagram.nodes[anchorId];
    const chain: BpmnNode[] = [];
    while (ancestor && !result.has(ancestor.id)) {
      chain.push(ancestor);
      const nextId: string | undefined = boundaryAttachedTo(ancestor) ?? nodeParentId(ancestor);
      ancestor = nextId ? diagram.nodes[nextId] : undefined;
    }
    if (!ancestor) continue;
    const moved = result.get(ancestor.id)!;
    const shiftX = moved.x - ancestor.x;
    const shiftY = moved.y - ancestor.y;
    // Followers keep their EXACT offset (never re-rounded — a boundary
    // event's anchor parameter must survive the move).
    result.set(node.id, { x: node.x + shiftX, y: node.y + shiftY });
    for (const link of chain) {
      if (!result.has(link.id)) {
        result.set(link.id, { x: link.x + shiftX, y: link.y + shiftY });
      }
    }
  }

  return result;
}

function round(value: number): number {
  return Math.round(value / 10) * 10;
}

// ------------------------------------------------------------ align/distribute

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';

/** New positions aligning `nodes` on the given edge/axis (2+ nodes). */
export function alignPositions(nodes: BpmnNode[], mode: AlignMode): Map<string, Point> {
  const result = new Map<string, Point>();
  if (nodes.length < 2) return result;
  const lefts = nodes.map((n) => n.x);
  const rights = nodes.map((n) => n.x + n.width);
  const tops = nodes.map((n) => n.y);
  const bottoms = nodes.map((n) => n.y + n.height);
  const anchor = {
    left: Math.min(...lefts),
    right: Math.max(...rights),
    top: Math.min(...tops),
    bottom: Math.max(...bottoms),
    centerX: (Math.min(...lefts) + Math.max(...rights)) / 2,
    centerY: (Math.min(...tops) + Math.max(...bottoms)) / 2,
  };
  for (const node of nodes) {
    let x = node.x;
    let y = node.y;
    if (mode === 'left') x = anchor.left;
    if (mode === 'right') x = anchor.right - node.width;
    if (mode === 'centerX') x = anchor.centerX - node.width / 2;
    if (mode === 'top') y = anchor.top;
    if (mode === 'bottom') y = anchor.bottom - node.height;
    if (mode === 'centerY') y = anchor.centerY - node.height / 2;
    if (x !== node.x || y !== node.y) result.set(node.id, { x, y });
  }
  return result;
}

/** New positions spreading `nodes` evenly along the axis (3+ nodes). */
export function distributePositions(
  nodes: BpmnNode[],
  axis: 'horizontal' | 'vertical',
): Map<string, Point> {
  const result = new Map<string, Point>();
  if (nodes.length < 3) return result;
  const sorted = [...nodes].sort((a, b) =>
    axis === 'horizontal' ? a.x - b.x || (a.id < b.id ? -1 : 1) : a.y - b.y || (a.id < b.id ? -1 : 1),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (axis === 'horizontal') {
    const span = last.x + last.width - first.x;
    const total = sorted.reduce((sum, n) => sum + n.width, 0);
    const gap = (span - total) / (sorted.length - 1);
    let cursor = first.x;
    for (const node of sorted) {
      if (Math.round(cursor) !== node.x) result.set(node.id, { x: Math.round(cursor), y: node.y });
      cursor += node.width + gap;
    }
  } else {
    const span = last.y + last.height - first.y;
    const total = sorted.reduce((sum, n) => sum + n.height, 0);
    const gap = (span - total) / (sorted.length - 1);
    let cursor = first.y;
    for (const node of sorted) {
      if (Math.round(cursor) !== node.y) result.set(node.id, { x: node.x, y: Math.round(cursor) });
      cursor += node.height + gap;
    }
  }
  return result;
}
