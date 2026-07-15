import { rectsIntersect, type BpmnDiagram, type BpmnNode, type Rect } from '@buildtovalue/core';
import { activeNodesCached } from './activeCache.js';
import { isNodeVisible } from './visibility.js';

/**
 * Smart alignment guides (Handoff 14 §1b): while a single node is dragged,
 * its edges/centers magnetize to nearby nodes' edges/centers, and EQUAL
 * SPACING between 3+ neighbors snaps with Figma-style distance badges.
 * Candidates are limited to nodes intersecting the viewport (spec 1b) —
 * off-screen nodes never attract, and the per-frame cost tracks what is
 * visible. Applied AFTER grid snap, so guide alignment wins the final pixels.
 */

/** Snap distance in world units (spec 1b: ±4px, adopted in U-3). */
export const GUIDE_THRESHOLD = 4;

export interface AlignGuide {
  /** 'v' = vertical line at `position` (x); 'h' = horizontal line at y. */
  axis: 'v' | 'h';
  position: number;
  /** Segment extent along the other axis (covers both matched rects). */
  from: number;
  to: number;
}

/** One equal-spacing gap: a segment plus the shared gap value it carries. */
export interface SpacingBadge {
  /** 'h' = horizontal gaps (badge sits at y `position`); 'v' = vertical. */
  axis: 'h' | 'v';
  /** Gap size in world px (rounded for display). */
  value: number;
  /** Start/end of THIS gap along the axis. */
  from: number;
  to: number;
  /** Cross-axis coordinate where the badge pill is drawn. */
  position: number;
}

export interface GuideSnap {
  dx: number;
  dy: number;
  guides: AlignGuide[];
  badges: SpacingBadge[];
}

interface Candidate {
  delta: number;
  position: number;
  otherMin: number;
  otherMax: number;
}

function nodeRect(node: BpmnNode): Rect {
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

/**
 * Adjusts a drag offset so `dragged`+offset aligns with a nearby node (edge/
 * center) or equalizes spacing in a row/column, returning the guides and
 * distance badges to draw. Pure.
 */
export function computeGuideSnap(
  diagram: BpmnDiagram,
  drillId: string | null,
  viewport: Rect,
  dragged: BpmnNode,
  dx: number,
  dy: number,
  excludeIds: ReadonlySet<string>,
): GuideSnap {
  const neighbors: BpmnNode[] = [];
  for (const other of activeNodesCached(diagram)) {
    if (excludeIds.has(other.id)) continue;
    if (!isNodeVisible(diagram, other, drillId)) continue;
    if (!rectsIntersect(nodeRect(other), viewport)) continue; // spec 1b: viewport only
    neighbors.push(other);
  }

  const left = dragged.x + dx;
  const top = dragged.y + dy;
  const right = left + dragged.width;
  const bottom = top + dragged.height;
  const cx = left + dragged.width / 2;
  const cy = top + dragged.height / 2;

  let bestX: Candidate | null = null;
  let bestY: Candidate | null = null;

  for (const other of neighbors) {
    const oLeft = other.x;
    const oRight = other.x + other.width;
    const oCx = other.x + other.width / 2;
    const oTop = other.y;
    const oBottom = other.y + other.height;
    const oCy = other.y + other.height / 2;

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

  let outDx = dx + (bestX?.delta ?? 0);
  let outDy = dy + (bestY?.delta ?? 0);
  const badges: SpacingBadge[] = [];

  // Equal-spacing (3+ neighbors): only on an axis not already edge/center
  // snapped — the two magnets would fight over the final pixels.
  if (!bestX) {
    const spacing = equalSpacing('h', neighbors, dragged, outDx, outDy);
    if (spacing) {
      outDx += spacing.delta;
      badges.push(...spacing.badges);
    }
  }
  if (!bestY) {
    const spacing = equalSpacing('v', neighbors, dragged, outDx, outDy);
    if (spacing) {
      outDy += spacing.delta;
      badges.push(...spacing.badges);
    }
  }

  const guides: AlignGuide[] = [];
  if (bestX) {
    guides.push({ axis: 'v', position: bestX.position, from: bestX.otherMin - 12, to: bestX.otherMax + 12 });
  }
  if (bestY) {
    guides.push({ axis: 'h', position: bestY.position, from: bestY.otherMin - 12, to: bestY.otherMax + 12 });
  }
  return { dx: outDx, dy: outDy, guides, badges };
}

interface SpacingResult {
  delta: number;
  badges: SpacingBadge[];
}

/**
 * Equal-spacing detection along one axis. Considers neighbors overlapping the
 * dragged node's cross-axis span (the visual row/column) and snaps when:
 * - **between**: the dragged node sits between two neighbors and centering
 *   equalizes both gaps;
 * - **chain**: the gap to the nearest neighbor matches that neighbor's gap to
 *   the next one (extending an existing rhythm).
 */
function equalSpacing(
  axis: 'h' | 'v',
  neighbors: BpmnNode[],
  dragged: BpmnNode,
  dx: number,
  dy: number,
): SpacingResult | null {
  const main = (n: { x: number; y: number }) => (axis === 'h' ? n.x : n.y);
  const size = (n: { width: number; height: number }) => (axis === 'h' ? n.width : n.height);
  const crossStart = (n: BpmnNode) => (axis === 'h' ? n.y : n.x);
  const crossSize = (n: BpmnNode) => (axis === 'h' ? n.height : n.width);

  const dLead = axis === 'h' ? dragged.x + dx : dragged.y + dy;
  const dTrail = dLead + size(dragged);
  const dCrossStart = axis === 'h' ? dragged.y + dy : dragged.x + dx;
  const dCrossEnd = dCrossStart + crossSize(dragged);
  const dCrossMid = (dCrossStart + dCrossEnd) / 2;

  // The visual row/column: neighbors whose cross-axis span overlaps the drag.
  const row = neighbors
    .filter((n) => crossStart(n) < dCrossEnd && dCrossStart < crossStart(n) + crossSize(n))
    .sort((a, b) => main(a) - main(b) || (a.id < b.id ? -1 : 1));
  if (row.length < 2) return null;

  const before = row.filter((n) => main(n) + size(n) <= dLead + GUIDE_THRESHOLD);
  const after = row.filter((n) => main(n) >= dTrail - GUIDE_THRESHOLD);
  const prev = before[before.length - 1];
  const next = after[0];

  const badge = (from: number, to: number, value: number): SpacingBadge => ({
    axis,
    value: Math.round(value),
    from,
    to,
    position: dCrossMid,
  });

  // Case "between": equalize the two gaps around the dragged node.
  if (prev && next) {
    const total = main(next) - (main(prev) + size(prev)) - size(dragged);
    if (total > 0) {
      const gap = total / 2;
      const target = main(prev) + size(prev) + gap;
      const delta = target - dLead;
      if (Math.abs(delta) <= GUIDE_THRESHOLD) {
        return {
          delta,
          badges: [
            badge(main(prev) + size(prev), target, gap),
            badge(target + size(dragged), main(next), gap),
          ],
        };
      }
    }
  }

  // Case "chain": match the rhythm of the two nearest neighbors on one side.
  if (before.length >= 2) {
    const a = before[before.length - 2];
    const b = prev!;
    const rhythm = main(b) - (main(a) + size(a));
    const gap = dLead - (main(b) + size(b));
    const delta = rhythm - gap;
    if (rhythm > 0 && Math.abs(delta) <= GUIDE_THRESHOLD) {
      return {
        delta,
        badges: [
          badge(main(a) + size(a), main(b), rhythm),
          badge(main(b) + size(b), dLead + delta, rhythm),
        ],
      };
    }
  }
  if (after.length >= 2) {
    const b = next!;
    const c = after[1];
    const rhythm = main(c) - (main(b) + size(b));
    const gap = main(b) - dTrail;
    const delta = gap - rhythm;
    if (rhythm > 0 && Math.abs(delta) <= GUIDE_THRESHOLD) {
      return {
        delta,
        badges: [
          badge(dTrail + delta, main(b), rhythm),
          badge(main(b) + size(b), main(c), rhythm),
        ],
      };
    }
  }
  return null;
}
