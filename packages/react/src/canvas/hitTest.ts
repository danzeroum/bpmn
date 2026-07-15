import {
  BOUNDARY_SNAP_THRESHOLD,
  nearestBoundaryAnchor,
  type BpmnDiagram,
  type BpmnNode,
  type NodeTypeRegistry,
  type Point,
} from '@buildtovalue/core';
import { activeNodesCached } from './activeCache.js';
import { isNodeVisible } from './visibility.js';

/**
 * Pure hit-testing helpers extracted from `useInteractions` (melhorias F9):
 * explicit parameters instead of hook closures, so the per-frame logic is
 * unit-testable without mounting a canvas.
 */

export interface BoundarySnap {
  hostId: string;
  side: 'top' | 'right' | 'bottom' | 'left';
  t: number;
  point: Point;
}

/**
 * While dragging a boundary(-capable) event: the nearest activity border
 * anchor within the snap zone, or null.
 */
export function findBoundarySnapAt(
  diagram: BpmnDiagram,
  registry: NodeTypeRegistry,
  drillId: string | null,
  dragged: BpmnNode,
  pointer: Point,
): BoundarySnap | null {
  let best: (BoundarySnap & { distance: number }) | null = null;
  for (const host of activeNodesCached(diagram)) {
    if (host.id === dragged.id) continue;
    if (!registry.has(host.type) || registry.get(host.type).category !== 'activity') continue;
    if (!isNodeVisible(diagram, host, drillId)) continue;
    const anchor = nearestBoundaryAnchor(host, pointer);
    if (anchor.distance > BOUNDARY_SNAP_THRESHOLD) continue;
    if (!best || anchor.distance < best.distance) {
      best = {
        hostId: host.id,
        side: anchor.side,
        t: anchor.t,
        point: anchor.point,
        distance: anchor.distance,
      };
    }
  }
  return best ? { hostId: best.hostId, side: best.side, t: best.t, point: best.point } : null;
}

/** Topmost visible active node containing `point` (later-rendered wins). */
export function findNodeAtPoint(
  diagram: BpmnDiagram,
  drillId: string | null,
  point: Point,
): BpmnNode | undefined {
  const nodes = activeNodesCached(diagram).filter((node) => isNodeVisible(diagram, node, drillId));
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (
      point.x >= node.x &&
      point.x <= node.x + node.width &&
      point.y >= node.y &&
      point.y <= node.y + node.height
    ) {
      return node;
    }
  }
  return undefined;
}
