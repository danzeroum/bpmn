import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useCanvasStore } from '../contexts/CanvasContext.js';
import { applyWheelZoom, panViewport } from '../canvas/viewport.js';

/**
 * Read-only pan + wheel-zoom for the lightweight viewer (Handoff 11 N-7).
 * Deliberately NOT `useInteractions`: no selection, drag, connect, resize,
 * context menu or keyboard editing — just moving the `viewBox`. Keeping this
 * self-contained is what lets `@buildtovalue/react/viewer` tree-shake the whole
 * editor interaction graph.
 */
export function useViewerPan(svgRef: RefObject<SVGSVGElement | null>) {
  const store = useCanvasStore();
  const panRef = useRef<{ x: number; y: number } | null>(null);

  // Wheel zoom must be a non-passive listener to preventDefault scrolling —
  // same mechanism as the editor canvas.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      applyWheelZoom(store, svg, event);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [store, svgRef]);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    panRef.current = { x: event.clientX, y: event.clientY };
    store.setState({ isPanning: true });
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = panRef.current;
    const svg = svgRef.current;
    if (!start || !svg) return;
    const { viewport } = store.getState();
    // Convert the pixel delta to world units so the grabbed point tracks the
    // cursor 1:1 at any zoom.
    const dxWorld = ((event.clientX - start.x) * viewport.width) / (svg.clientWidth || 1);
    const dyWorld = ((event.clientY - start.y) * viewport.height) / (svg.clientHeight || 1);
    panRef.current = { x: event.clientX, y: event.clientY };
    store.setState({ viewport: panViewport(viewport, -dxWorld, -dyWorld) });
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!panRef.current) return;
    panRef.current = null;
    store.setState({ isPanning: false });
    svgRef.current?.releasePointerCapture?.(event.pointerId);
  };

  return { onPointerDown, onPointerMove, onPointerUp };
}
