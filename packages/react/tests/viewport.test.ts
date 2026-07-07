import { describe, expect, it } from 'vitest';
import { fitViewport, panViewport, zoomViewportAt } from '../src/canvas/viewport.js';

describe('zoomViewportAt', () => {
  it('keeps the anchor world point fixed while zooming', () => {
    const viewport = { x: 0, y: 0, width: 1200, height: 800 };
    const anchor = { x: 600, y: 400 };
    const zoomed = zoomViewportAt(viewport, anchor, 0.5);
    // Anchor relative position must be preserved (was at 50%/50%)
    expect((anchor.x - zoomed.x) / zoomed.width).toBeCloseTo(0.5);
    expect((anchor.y - zoomed.y) / zoomed.height).toBeCloseTo(0.5);
    expect(zoomed.width).toBe(600);
  });

  it('keeps off-center anchors fixed too', () => {
    const viewport = { x: 100, y: 50, width: 1000, height: 500 };
    const anchor = { x: 200, y: 100 }; // at 10% / 10%
    const zoomed = zoomViewportAt(viewport, anchor, 2);
    expect((anchor.x - zoomed.x) / zoomed.width).toBeCloseTo(0.1);
    expect((anchor.y - zoomed.y) / zoomed.height).toBeCloseTo(0.1);
  });

  it('clamps the zoom range', () => {
    const viewport = { x: 0, y: 0, width: 1200, height: 800 };
    expect(zoomViewportAt(viewport, { x: 0, y: 0 }, 0.0001).width).toBe(200);
    expect(zoomViewportAt(viewport, { x: 0, y: 0 }, 1e9).width).toBe(20000);
  });
});

describe('panViewport', () => {
  it('shifts opposite to the pointer delta', () => {
    const viewport = { x: 10, y: 20, width: 100, height: 100 };
    expect(panViewport(viewport, 5, -3)).toEqual({ x: 5, y: 23, width: 100, height: 100 });
  });
});

describe('fitViewport', () => {
  it('contains the bounds with padding and respects aspect ratio', () => {
    const bounds = { x: 100, y: 100, width: 400, height: 200 };
    const viewport = fitViewport(bounds, 2, 50);
    expect(viewport.width / viewport.height).toBeCloseTo(2);
    // Bounds fully inside
    expect(viewport.x).toBeLessThanOrEqual(bounds.x);
    expect(viewport.y).toBeLessThanOrEqual(bounds.y);
    expect(viewport.x + viewport.width).toBeGreaterThanOrEqual(bounds.x + bounds.width);
    expect(viewport.y + viewport.height).toBeGreaterThanOrEqual(bounds.y + bounds.height);
    // Centered
    expect(viewport.x + viewport.width / 2).toBeCloseTo(bounds.x + bounds.width / 2);
  });
});
