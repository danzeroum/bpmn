import {
  alignPositions,
  compositeCommand,
  computeLayeredLayout,
  distributePositions,
  moveNodeCommand,
  type AlignMode,
  type BpmnDiagram,
  type BpmnNode,
  type Command,
  type Point,
} from '@buildtovalue/core';

/**
 * Arrangement commands (referência item 2): auto-layout, align and
 * distribute, each as ONE composite of `moveNodeCommand`s — atomic undo,
 * audited like any other move.
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

/** Layered auto-layout of the whole diagram; null when out of scope/no-op. */
export function buildLayoutCommand(diagram: BpmnDiagram): Command | null {
  const positions = computeLayeredLayout(diagram);
  if (!positions) return null;
  const commands = movesFrom(diagram, positions);
  if (commands.length === 0) return null;
  return compositeCommand('Auto-layout', commands);
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
