import {
  addEdgeCommand,
  addNodeCommand,
  compositeCommand,
  createEdge,
  createNode,
  type BpmnDiagram,
  type BpmnNode,
  type Command,
  type NodeTypeRegistry,
} from '@buildtovalue/core';
import { findNodeAtPoint } from './hitTest.js';

/**
 * Quick-add (Handoff 14 §1a): create the next element ALREADY CONNECTED to a
 * source node, as ONE composite command. Shared by the context pad buttons
 * and the `Tab` shortcut (mouse-free chaining).
 */

/** Spec geometry: the created node's left edge sits +140px from the source's center. */
export const QUICK_ADD_OFFSET = 140;

/**
 * Free spot for the created node: `source.centerX + 140` on the same line
 * (spec 1a), clamped to clear wide sources, stepping DOWN below occupied
 * slots (never overlapping).
 */
export function quickAddPosition(
  diagram: BpmnDiagram,
  source: BpmnNode,
  size: { width: number; height: number },
  drillId: string | null,
): { x: number; y: number } {
  // +140 from the center per spec; the max() guard keeps the new element
  // clear of sources wider than ~230px (expanded sub-processes).
  const x = Math.max(source.x + source.width / 2 + QUICK_ADD_OFFSET, source.x + source.width + 24);
  let y = source.y + source.height / 2 - size.height / 2;
  for (let attempt = 0; attempt < 10; attempt++) {
    const center = { x: x + size.width / 2, y: y + size.height / 2 };
    const hit = findNodeAtPoint(diagram, drillId, center);
    if (!hit || hit.id === source.id) return { x, y };
    y = hit.y + hit.height + 24;
  }
  return { x, y };
}

/**
 * Builds the atomic "append connected element" command. Returns the command
 * plus the created node's id (select it so the flow chains).
 */
export function buildQuickAddCommand(
  diagram: BpmnDiagram,
  registry: NodeTypeRegistry,
  source: BpmnNode,
  type: string,
  drillId: string | null,
): { command: Command; nodeId: string } {
  const def = registry.has(type) ? registry.get(type) : undefined;
  const size = def?.defaultSize ?? { width: 120, height: 60 };
  const position = quickAddPosition(diagram, source, size, drillId);
  const created = createNode(
    {
      type,
      x: position.x,
      y: position.y,
      versionId: diagram.version.id,
      // Quick-added elements inherit the source's sub-process scope.
      ...(typeof source.properties.parentId === 'string'
        ? { properties: { parentId: source.properties.parentId } }
        : {}),
    },
    registry,
  );
  const edge = createEdge({
    sourceId: source.id,
    targetId: created.id,
    versionId: diagram.version.id,
  });
  return {
    command: compositeCommand(`Append ${type}`, [addNodeCommand(created), addEdgeCommand(edge)]),
    nodeId: created.id,
  };
}
