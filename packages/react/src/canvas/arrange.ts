import {
  activeEdges,
  alignPositions,
  compositeCommand,
  computeLayeredLayout,
  distributePositions,
  moveNodeCommand,
  updateEdgeCommand,
  type AlignMode,
  type BpmnDiagram,
  type BpmnNode,
  type Command,
  type Point,
} from '@buildtovalue/core';
import { isManualEdge, translateManualEdges, type ManualTranslation } from './routeEdge.js';

/**
 * Arrangement commands (referência item 2): auto-layout, align and
 * distribute, each as ONE composite of `moveNodeCommand`s — atomic undo,
 * audited like any other move.
 *
 * Handoff 14 §1e: the auto-layout is a PROPOSAL (cerca §1.7 — nothing
 * silent): `buildLayoutProposal` computes the target positions, rigidly
 * translates the manual 📍 routes of moved nodes (the SAME
 * `translateManualEdges` contract as the drag, R-3 — never re-routed) and
 * packages everything as ONE undoable composite plus the counts the
 * apply/refuse card shows. Nothing executes until the user confirms.
 */

function movesFrom(diagram: BpmnDiagram, positions: Map<string, Point>): Command[] {
  const commands: Command[] = [];
  for (const [id, to] of positions) {
    const node = diagram.nodes[id];
    if (!node || (node.x === to.x && node.y === to.y)) continue;
    commands.push(moveNodeCommand(id, { x: node.x, y: node.y }, to));
  }
  return commands;
}

/** One node the layout wants to move — feeds the preview ghosts and the fade. */
export interface LayoutMove {
  id: string;
  from: Point;
  to: Point;
  width: number;
  height: number;
}

/** The pending auto-layout, waiting for Aplicar/Recusar (Handoff 14 §1e). */
export interface LayoutProposal {
  /** ONE undoable composite: node moves + rigid 📍 translations. */
  command: Command;
  moved: LayoutMove[];
  /** Auto-routed edges touching moved nodes — they re-route on apply. */
  reroutedCount: number;
  /** Manual 📍 routes rigidly translated (PRESERVED, never re-routed). */
  manualCount: number;
  /** The diagram the proposal was computed against — a stale proposal
   * (diagram changed while the card was open) must be discarded. */
  baseDiagram: BpmnDiagram;
}

/**
 * Rigid 📍 translation for a layout where every node has its OWN delta:
 * moved nodes are grouped by delta and each group goes through the SAME
 * `translateManualEdges` (R-3) used by the drag — an edge whose endpoints
 * land in different groups gets each endpoint shifted by its own delta,
 * interior bends untouched. No new mechanism.
 */
function manualTranslationsForLayout(
  diagram: BpmnDiagram,
  positions: Map<string, Point>,
): ManualTranslation[] {
  const groups = new Map<string, { dx: number; dy: number; ids: Set<string> }>();
  for (const [id, to] of positions) {
    const node = diagram.nodes[id];
    if (!node) continue;
    const dx = to.x - node.x;
    const dy = to.y - node.y;
    if (dx === 0 && dy === 0) continue;
    const key = `${dx}:${dy}`;
    const group = groups.get(key) ?? { dx, dy, ids: new Set<string>() };
    group.ids.add(id);
    groups.set(key, group);
  }
  // Post-move snapshot (translateManualEdges works against final positions).
  let working: BpmnDiagram = { ...diagram, nodes: { ...diagram.nodes } };
  for (const [id, to] of positions) {
    const node = working.nodes[id];
    if (node) working.nodes[id] = { ...node, x: to.x, y: to.y };
  }
  const byEdge = new Map<string, ManualTranslation>();
  for (const group of groups.values()) {
    for (const t of translateManualEdges(working, group.ids, group.dx, group.dy)) {
      byEdge.set(t.edgeId, t);
      // Later groups must see earlier shifts (source and target endpoints
      // can belong to different delta groups).
      working = {
        ...working,
        edges: {
          ...working.edges,
          [t.edgeId]: { ...working.edges[t.edgeId], waypoints: t.waypoints },
        },
      };
    }
  }
  return [...byEdge.values()];
}

/** Computes the layout PROPOSAL; null when out of scope or a no-op. */
export function buildLayoutProposal(diagram: BpmnDiagram): LayoutProposal | null {
  const positions = computeLayeredLayout(diagram);
  if (!positions) return null;
  const moved: LayoutMove[] = [];
  for (const [id, to] of positions) {
    const node = diagram.nodes[id];
    if (!node || (node.x === to.x && node.y === to.y)) continue;
    moved.push({
      id,
      from: { x: node.x, y: node.y },
      to,
      width: node.width,
      height: node.height,
    });
  }
  if (moved.length === 0) return null;
  const movedIds = new Set(moved.map((m) => m.id));
  const translations = manualTranslationsForLayout(diagram, positions);
  const commands: Command[] = [
    ...movesFrom(diagram, positions),
    ...translations.map((t) => updateEdgeCommand(t.edgeId, { waypoints: t.waypoints })),
  ];
  const reroutedCount = activeEdges(diagram).filter(
    (edge) =>
      !isManualEdge(edge) && (movedIds.has(edge.sourceId) || movedIds.has(edge.targetId)),
  ).length;
  return {
    command: compositeCommand('Auto-layout', commands),
    moved,
    reroutedCount,
    manualCount: translations.length,
    baseDiagram: diagram,
  };
}

/** Layered auto-layout of the whole diagram; null when out of scope/no-op.
 * Kept for API compatibility — the toolbar now goes through the PROPOSAL. */
export function buildLayoutCommand(diagram: BpmnDiagram): Command | null {
  return buildLayoutProposal(diagram)?.command ?? null;
}

export function buildAlignCommand(
  diagram: BpmnDiagram,
  nodes: BpmnNode[],
  mode: AlignMode,
): Command | null {
  const commands = movesFrom(diagram, alignPositions(nodes, mode));
  if (commands.length === 0) return null;
  return compositeCommand(`Align ${mode}`, commands);
}

export function buildDistributeCommand(
  diagram: BpmnDiagram,
  nodes: BpmnNode[],
  axis: 'horizontal' | 'vertical',
): Command | null {
  const commands = movesFrom(diagram, distributePositions(nodes, axis));
  if (commands.length === 0) return null;
  return compositeCommand(`Distribute ${axis}`, commands);
}
