import type { BpmnDiagram, BpmnNode } from '@buildtovalue/core';
import { activeNodesCached } from './activeCache.js';
import { isNodeVisible } from './visibility.js';

/**
 * Smart alignment guides (referência item 2): while a single node is
 * dragged, its edges/centers magnetize to nearby nodes' edges/centers and a
 * guide line is drawn through the pair. Applied AFTER grid snap, so guide
 * alignment wins the final pixels (standard editor behavior).
 */

/** Snap distance in world units. */
export const GUIDE_THRESHOLD = 6;

export interface AlignGuide {
  /** 'v' = vertical line at `position` (x); 'h' = horizontal line at y. */
  axis: 'v' | 'h';
  position: number;
  /** Segment extent along the other axis (covers both matched rects). */
  from: number;
  to: number;
}

export interface GuideSnap {
  dx: number;
  dy: number;
  guides: AlignGuide[];
}

interface Candidate {
  delta: number;
  position: number;
  otherMin: number;
  otherMax: number;
}

/**
 * Adjusts a drag offset so `dragged`+offset aligns with a nearby node when
 * within {@link GUIDE_THRESHOLD}, returning the guides to draw. Pure.
 */
export function computeGuideSnap(
  diagram: BpmnDiagram,
  drillId: string | null,
  dragged: BpmnNode,
  dx: number,
  dy: number,
  excludeIds: ReadonlySet<string>,
): GuideSnap {
  const left = dragged.x + dx;
  const top = dragged.y + dy;
  const right = left + dragged.width;
  const bottom = top + dragged.height;
  const cx = left + dragged.width / 2;
  const cy = top + dragged.height / 2;

  let bestX: Candidate | null = null;
  let bestY: Candidate | null = null;

  for (const other of activeNodesCached(diagram)) {
    if (excludeIds.has(other.id)) continue;
    if (!isNodeVisible(diagram, other, drillId)) continue;
    const oLeft = other.x;
    const oRight = other.x + other.width;
    const oCx = other.x + other.width / 2;
    const oTop = other.y;
    const oBottom = other.y + other.height;
    const oCy = other.y + other.height / 2;

    // Vertical guides (x alignment): my left/center/right vs their left/center/right.
    for (const [mine, theirs] of [
      [left, oLeft],
      [cx, oCx],
      [right, oRight],
    ] as const) {
      const delta = theirs - mine;
      if (Math.abs(delta) <= GUIDE_THRESHOLD && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
        bestX = {
          delta,
          position: theirs,
          otherMin: Math.min(top, oTop),
          otherMax: Math.max(bottom, oBottom),
        };
      }
    }
    for (const [mine, theirs] of [
      [top, oTop],
      [cy, oCy],
      [bottom, oBottom],
    ] as const) {
      const delta = theirs - mine;
      if (Math.abs(delta) <= GUIDE_THRESHOLD && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
        bestY = {
          delta,
          position: theirs,
          otherMin: Math.min(left, oLeft),
          otherMax: Math.max(right, oRight),
        };
      }
    }
  }

  const guides: AlignGuide[] = [];
  if (bestX) {
    guides.push({ axis: 'v', position: bestX.position, from: bestX.otherMin - 12, to: bestX.otherMax + 12 });
  }
  if (bestY) {
    guides.push({ axis: 'h', position: bestY.position, from: bestY.otherMin - 12, to: bestY.otherMax + 12 });
  }
  return { dx: dx + (bestX?.delta ?? 0), dy: dy + (bestY?.delta ?? 0), guides };
}
