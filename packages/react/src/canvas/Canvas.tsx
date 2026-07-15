import { useEffect, useMemo, useRef, type ReactNode, type WheelEvent } from 'react';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { applyWheelZoom } from './viewport.js';
import { useInteractions } from './useInteractions.js';
import { Defs, GridLayer } from './Defs.js';
import { ConnectedNode } from './NodeRenderer.js';
import { ConnectedEdge } from './EdgeRenderer.js';
import {
  AlignmentGuidesOverlay,
  BoundarySnapOverlay,
  ConnectionPreview,
  LayoutPreviewOverlay,
  ReparentTargetOverlay,
  SearchPulseOverlay,
  SelectionBoxOverlay,
} from './overlays.js';
import { LayoutSettleOverlay, SettlingOverlay } from './SettlingOverlay.js';
import { ContextPad } from './ContextPad.js';
import { EdgeLabelEditor } from './EdgeLabelEditor.js';
import { hiddenNodeIds } from './visibility.js';
import { selectRenderList, SEMANTIC_ZOOM_MIN } from './renderList.js';
import { useKeyboardShortcuts } from '../gestures/useKeyboardShortcuts.js';

// Re-exported for API compatibility; the source of truth is renderList.ts so
// the lightweight ViewerCanvas can share it without importing this module.
export { SEMANTIC_ZOOM_MIN };

export interface CanvasProps {
  /** Extra SVG content rendered on the overlay layer (world coordinates). */
  overlay?: ReactNode;
  /** Show closed (removedInVersion) elements. Default true. */
  showClosed?: boolean;
}

/**
 * The SVG canvas. Pan/zoom via the `viewBox` attribute (crisp text at every
 * zoom level); world-coordinate conversion via `getScreenCTM().inverse()`.
 */
export function BpmnCanvas({ overlay, showClosed = true }: CanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { diagram } = useDiagram();
  const store = useCanvasStore();
  const config = useEditorConfig();
  const viewport = useCanvasState((s) => s.viewport);
  const gridSize = useCanvasState((s) => s.gridSize);
  const isPanning = useCanvasState((s) => s.isPanning);
  const drillId = useCanvasState((s) => s.drillId);
  const readOnly = useCanvasState((s) => s.readOnly);
  const interactions = useInteractions(svgRef);

  useKeyboardShortcuts(interactions);

  // Observability (§2): while panning, watch frame pacing and report the
  // first frame over 32ms — once per gesture, so a slow pan can't flood the
  // host's sink.
  useEffect(() => {
    if (!isPanning) return;
    let raf = 0;
    let last = performance.now();
    let reported = false;
    const tick = () => {
      const now = performance.now();
      if (!reported && now - last > 32) {
        reported = true;
        config.emitEditorEvent('render.slow', { frameMs: Math.round(now - last) });
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPanning, config]);

  // N-3 `selection.changed`: one event per distinct selection set.
  useEffect(() => {
    let previous = store.getState().selectedIds;
    return store.subscribe(() => {
      const next = store.getState().selectedIds;
      if (next === previous) return;
      const changed =
        next.length !== previous.length || next.some((id, index) => id !== previous[index]);
      previous = next;
      if (changed) config.emitEditorEvent('selection.changed', { selectedIds: [...next] });
    });
  }, [store, config]);

  // Wheel zoom must be a non-passive listener to preventDefault scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      applyWheelZoom(store, svg, event);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [store]);

  // Children of a COLLAPSED sub-process stay off the canvas (they live behind
  // the [+] marker). In drill-down mode only the drilled sub-process' contents
  // show — the container itself and everything outside it hide. Memoized by
  // diagram identity — the canvas re-renders per viewport frame.
  const hiddenIds = useMemo(() => hiddenNodeIds(diagram, drillId), [diagram, drillId]);
  // Visible + z-ordered + viewport-culled — shared with the lightweight
  // ViewerCanvas (N-7) so the two render paths can never drift. Virtualization
  // is a no-op below CULL_THRESHOLD; the canvas already re-renders per viewport
  // frame, so this adds no re-renders — only fewer mounted node/edge components.
  const { nodes, edges } = selectRenderList(diagram, hiddenIds, viewport, showClosed);

  return (
    <svg
      ref={svgRef}
      className="bpmnr-canvas"
      role="application"
      aria-label={`BPMN diagram: ${diagram.name}`}
      // Keyboard entry point for roving element focus — editor only, so the
      // read-only canvas stays byte-identical to the lightweight viewer (N-7).
      tabIndex={readOnly ? undefined : 0}
      data-zoom-band={1200 / viewport.width >= SEMANTIC_ZOOM_MIN ? 'full' : 'reduced'}
      width="100%"
      height="100%"
      viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
      style={{
        display: 'block',
        background: 'var(--bpmnr-canvas-bg, #faf9f6)',
        cursor: isPanning ? 'grabbing' : 'default',
        touchAction: 'none',
        userSelect: 'none',
      }}
      onPointerDown={interactions.onCanvasPointerDown}
      onContextMenu={interactions.onCanvasContextMenu}
      onPointerMove={interactions.onPointerMove}
      onPointerUp={interactions.onPointerUp}
      onPointerLeave={interactions.onPointerUp}
      onWheel={swallowReactWheel}
    >
      <Defs gridSize={gridSize} />
      <GridLayer viewport={viewport} />
      <g data-layer="edges">
        {edges.map((edge) => (
          <ConnectedEdge key={edge.id} edge={edge} nodes={diagram.nodes} interactions={interactions} />
        ))}
      </g>
      <g data-layer="nodes">
        {nodes.map((node) => (
          <ConnectedNode key={node.id} node={node} interactions={interactions} />
        ))}
      </g>
      <g data-layer="overlay">
        <SettlingOverlay />
        <ContextPad interactions={interactions} />
        <ConnectionPreview />
        <BoundarySnapOverlay />
        <ReparentTargetOverlay />
        <SelectionBoxOverlay />
        <AlignmentGuidesOverlay />
        <SearchPulseOverlay />
        <LayoutPreviewOverlay />
        <LayoutSettleOverlay />
        <EdgeLabelEditor />
        {overlay}
      </g>
    </svg>
  );
}

function swallowReactWheel(event: WheelEvent) {
  // Real handling happens in the non-passive native listener above.
  event.stopPropagation();
}

