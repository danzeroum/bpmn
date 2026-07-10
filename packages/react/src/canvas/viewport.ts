import type { Point } from '@buildtovalue/core';
import { clamp } from '@buildtovalue/core';
import {
  MAX_VIEWPORT_WIDTH,
  MIN_VIEWPORT_WIDTH,
  type CanvasStore,
  type Viewport,
} from '../state/canvasStore.js';

/**
 * Converts a pointer event position to world (diagram) coordinates.
 * Prefers `getScreenCTM().inverse()` (robust with nested transforms); falls
 * back to viewBox math when the CTM is unavailable (e.g. jsdom).
 */
export function screenToWorld(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const ctm = svg.getScreenCTM?.();
  if (ctm) {
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  }
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox?.baseVal;
  if (!viewBox || rect.width === 0 || rect.height === 0) {
    return { x: clientX, y: clientY };
  }
  return {
    x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width,
    y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height,
  };
}

/**
 * Zooms the viewport keeping the world point under the cursor fixed
 * (Figma-style). `factor` > 1 zooms out, < 1 zooms in.
 */
export function zoomViewportAt(viewport: Viewport, worldPoint: Point, factor: number): Viewport {
  const width = clamp(viewport.width * factor, MIN_VIEWPORT_WIDTH, MAX_VIEWPORT_WIDTH);
  const effective = width / viewport.width;
  const height = viewport.height * effective;
  return {
    x: worldPoint.x - (worldPoint.x - viewport.x) * effective,
    y: worldPoint.y - (worldPoint.y - viewport.y) * effective,
    width,
    height,
  };
}

export function panViewport(viewport: Viewport, dxWorld: number, dyWorld: number): Viewport {
  return { ...viewport, x: viewport.x - dxWorld, y: viewport.y - dyWorld };
}

/** Wheel handler: zoom at cursor (plain wheel) — trackpad-friendly. */
export function applyWheelZoom(
  store: CanvasStore,
  svg: SVGSVGElement,
  event: { clientX: number; clientY: number; deltaY: number },
): void {
  const world = screenToWorld(svg, event.clientX, event.clientY);
  const factor = Math.exp(event.deltaY * 0.0015);
  const { viewport } = store.getState();
  store.setState({ viewport: zoomViewportAt(viewport, world, factor) });
}

/** Fits the viewport around a bounding box with padding. */
export function fitViewport(
  bounds: { x: number; y: number; width: number; height: number },
  aspectRatio: number,
  padding = 60,
): Viewport {
  const width = Math.max(bounds.width + padding * 2, MIN_VIEWPORT_WIDTH);
  const height = Math.max(bounds.height + padding * 2, width / aspectRatio);
  const finalWidth = Math.max(width, height * aspectRatio);
  return {
    x: bounds.x + bounds.width / 2 - finalWidth / 2,
    y: bounds.y + bounds.height / 2 - height / 2,
    width: finalWidth,
    height,
  };
}
