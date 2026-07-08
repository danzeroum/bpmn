import { useEffect, useMemo, useRef, type ReactNode, type WheelEvent } from 'react';
import {
  activeEdges,
  activeNodes,
  isSubProcessExpanded,
  nodeParentId,
  type BpmnDiagram,
  type BpmnNode,
} from '@bpmn-react/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
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
  const config = useEditorConfig();
  const viewport = useCanvasState((s) => s.viewport);
  const gridSize = useCanvasState((s) => s.gridSize);
  const isPanning = useCanvasState((s) => s.isPanning);
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
  // the [+] marker); expanded rendering/drill-down lands with F7-2. Memoized
  // by diagram identity — the canvas re-renders per viewport frame.
  const hiddenIds = useMemo(() => collapsedDescendantIds(diagram), [diagram]);
  const nodes = orderByZ(
    (showClosed ? Object.values(diagram.nodes) : activeNodes(diagram)).filter(
      (node) => !hiddenIds.has(node.id),
    ),
  );
  const edges = (showClosed ? Object.values(diagram.edges) : activeEdges(diagram)).filter(
    (edge) => !hiddenIds.has(edge.sourceId) && !hiddenIds.has(edge.targetId),
  );

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

/** Ids of every node whose ancestry contains a collapsed sub-process. */
function collapsedDescendantIds(diagram: BpmnDiagram): Set<string> {
  const hidden = new Set<string>();
  const isHidden = (node: BpmnNode): boolean => {
    const seen = new Set<string>();
    let parentId = nodeParentId(node);
    while (parentId !== undefined && !seen.has(parentId)) {
      seen.add(parentId);
      const container: BpmnNode | undefined = diagram.nodes[parentId];
      if (!container) return false;
      if (container.type === 'subProcess' && !isSubProcessExpanded(container)) return true;
      parentId = nodeParentId(container);
    }
    return false;
  };
  for (const node of Object.values(diagram.nodes)) {
    if (nodeParentId(node) !== undefined && isHidden(node)) hidden.add(node.id);
  }
  return hidden;
}
