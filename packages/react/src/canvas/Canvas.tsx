import { useEffect, useRef, type ReactNode, type WheelEvent } from 'react';
import { activeEdges, activeNodes } from '@bpmn-react/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { applyWheelZoom } from './viewport.js';
import { useInteractions } from './useInteractions.js';
import { Defs, GridLayer } from './Defs.js';
import { ConnectedNode } from './NodeRenderer.js';
import { ConnectedEdge } from './EdgeRenderer.js';
import { ConnectionPreview, SelectionBoxOverlay } from './overlays.js';
import { useKeyboardShortcuts } from '../gestures/useKeyboardShortcuts.js';

export interface CanvasProps {
  /** Extra SVG content rendered on the overlay layer (world coordinates). */
  overlay?: ReactNode;
  /** Show closed (removedInVersion) elements. Default true. */
  showClosed?: boolean;
}

/**
 * Semantic zoom (craft pack A5): below this zoom the canvas is stamped
 * `data-zoom-band="reduced"` and CSS fades out secondary ink — edge labels
 * and domain type tags ([data-shape-tag]). Same threshold as the purpose
 * chip in the EdgeRenderer.
 */
export const SEMANTIC_ZOOM_MIN = 0.6;

/**
 * The SVG canvas. Pan/zoom via the `viewBox` attribute (crisp text at every
 * zoom level); world-coordinate conversion via `getScreenCTM().inverse()`.
 */
export function BpmnCanvas({ overlay, showClosed = true }: CanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { diagram } = useDiagram();
  const store = useCanvasStore();
  const viewport = useCanvasState((s) => s.viewport);
  const gridSize = useCanvasState((s) => s.gridSize);
  const isPanning = useCanvasState((s) => s.isPanning);
  const interactions = useInteractions(svgRef);

  useKeyboardShortcuts(interactions);

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

  const nodes = orderByZ(showClosed ? Object.values(diagram.nodes) : activeNodes(diagram));
  const edges = showClosed ? Object.values(diagram.edges) : activeEdges(diagram);

  return (
    <svg
      ref={svgRef}
      className="bpmnr-canvas"
      role="application"
      aria-label={`BPMN diagram: ${diagram.name}`}
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
      onPointerMove={interactions.onPointerMove}
      onPointerUp={interactions.onPointerUp}
      onPointerLeave={interactions.onPointerUp}
      onWheel={swallowReactWheel}
    >
      <Defs gridSize={gridSize} />
      <GridLayer viewport={viewport} />
      <g data-layer="edges">
        {edges.map((edge) => (
          <ConnectedEdge key={edge.id} edge={edge} nodes={diagram.nodes} />
        ))}
      </g>
      <g data-layer="nodes">
        {nodes.map((node) => (
          <ConnectedNode key={node.id} node={node} interactions={interactions} />
        ))}
      </g>
      <g data-layer="overlay">
        <ConnectionPreview />
        <SelectionBoxOverlay />
        {overlay}
      </g>
    </svg>
  );
}

function swallowReactWheel(event: WheelEvent) {
  // Real handling happens in the non-passive native listener above.
  event.stopPropagation();
}

/**
 * Draws swimlane containers (pools, then lanes) behind flow nodes so the flow
 * always paints — and stays clickable — on top. Order within each group is
 * preserved (JS sort is stable).
 */
function orderByZ<T extends { type: string }>(nodes: T[]): T[] {
  const rank = (type: string) => (type === 'pool' ? 0 : type === 'lane' ? 1 : 2);
  return [...nodes].sort((a, b) => rank(a.type) - rank(b.type));
}
