import type { BpmnNode, Point } from '../model/types.js';

/**
 * Parametric boundary anchoring (Handoff 11 N-1, pendências §6): a boundary
 * event attaches to a host activity at `side + t ∈ [0,1]` so it can slide
 * along the border and REFLOW proportionally when the host resizes. The
 * parametric pair lives in `properties.boundarySide` / `properties.boundaryT`
 * as EDITOR-ONLY state: the XML profile stays intact (standard absolute DI
 * coordinates); on import the pair is derived back from the DI geometry.
 */
export type BoundarySide = 'top' | 'right' | 'bottom' | 'left';

export interface BoundaryRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoundaryAnchor {
  side: BoundarySide;
  /** Position along the side: left→right (top/bottom), top→bottom (left/right). */
  t: number;
  /** The anchor point ON the border (the boundary event centers here). */
  point: Point;
  /** Distance from the queried point to the border anchor. */
  distance: number;
}

/** Snap zone for drag-to-attach (px, world units) — spec §2 N-1. */
export const BOUNDARY_SNAP_THRESHOLD = 12;

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** The border point of a host rect for a parametric anchor. */
export function boundaryPositionOf(host: BoundaryRect, side: BoundarySide, t: number): Point {
  const k = clamp01(t);
  switch (side) {
    case 'top':
      return { x: host.x + host.width * k, y: host.y };
    case 'bottom':
      return { x: host.x + host.width * k, y: host.y + host.height };
    case 'left':
      return { x: host.x, y: host.y + host.height * k };
    case 'right':
      return { x: host.x + host.width, y: host.y + host.height * k };
  }
}

/**
 * The nearest parametric border anchor of `host` for a world point — always
 * returns the best of the four sides; callers decide the snap by comparing
 * `distance` against {@link BOUNDARY_SNAP_THRESHOLD}.
 */
export function nearestBoundaryAnchor(host: BoundaryRect, point: Point): BoundaryAnchor {
  const sides: BoundarySide[] = ['top', 'right', 'bottom', 'left'];
  let best: BoundaryAnchor | undefined;
  for (const side of sides) {
    const horizontal = side === 'top' || side === 'bottom';
    const t = horizontal
      ? host.width === 0
        ? 0
        : clamp01((point.x - host.x) / host.width)
      : host.height === 0
        ? 0
        : clamp01((point.y - host.y) / host.height);
    const anchor = boundaryPositionOf(host, side, t);
    const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
    if (!best || distance < best.distance) best = { side, t, point: anchor, distance };
  }
  return best!;
}

/**
 * The parametric anchor of an attached boundary node: the STORED pair when
 * present (attach/slide wrote it), otherwise derived from geometry — which is
 * exactly how imported diagrams (absolute DI coordinates, no editor state)
 * regain the parametric model.
 */
export function boundaryAnchorOf(
  host: BoundaryRect,
  node: Pick<BpmnNode, 'x' | 'y' | 'width' | 'height' | 'properties'>,
): { side: BoundarySide; t: number } {
  const side = node.properties.boundarySide;
  const t = node.properties.boundaryT;
  if (
    (side === 'top' || side === 'right' || side === 'bottom' || side === 'left') &&
    typeof t === 'number' &&
    Number.isFinite(t)
  ) {
    return { side, t: clamp01(t) };
  }
  const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  const derived = nearestBoundaryAnchor(host, center);
  return { side: derived.side, t: derived.t };
}

/** Top-left position that centers a node of `size` on the border anchor. */
export function boundaryNodePosition(
  host: BoundaryRect,
  side: BoundarySide,
  t: number,
  size: { width: number; height: number },
): Point {
  const border = boundaryPositionOf(host, side, t);
  return { x: border.x - size.width / 2, y: border.y - size.height / 2 };
}
