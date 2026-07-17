import { useMemo, useRef, type ReactNode, type WheelEvent } from 'react';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasState } from '../contexts/CanvasContext.js';
import { Defs, GridLayer } from '../canvas/Defs.js';
import { ConnectedNode } from '../canvas/NodeRenderer.js';
import { ConnectedEdge } from '../canvas/EdgeRenderer.js';
import { hiddenNodeIds } from '../canvas/visibility.js';
import { selectRenderList, SEMANTIC_ZOOM_MIN } from '../canvas/renderList.js';
import type { Interactions } from '../canvas/useInteractions.js';
import { useViewerPan } from './useViewerPan.js';

/**
 * Lightweight SVG canvas for the read-only viewer (Handoff 11 N-7). It paints
 * the SAME structure as the editor `BpmnCanvas` — Defs, grid, edges, nodes,
 * overlay layer — reusing the exact `ConnectedNode`/`ConnectedEdge` renderers,
 * so the render is byte-identical to the editor's read-only output (proven by
 * viewerEquivalence.test). What it leaves out is the editor graph: no
 * `useInteractions`, no keyboard shortcuts, no selection/drag/connect/resize/
 * context-menu wiring — only pan + wheel-zoom.
 *
 * Nodes are always read-only here (the CanvasProvider is created with
 * `readOnly: true`), so `editable` is false and the required `interactions`
 * prop is never invoked — a frozen no-op stub satisfies the type without
 * pulling the interaction runtime (the import is type-only, erased at build).
 */
const NOOP_INTERACTIONS = Object.freeze({}) as unknown as Interactions;

/** Diff paint category per element (Handoff 15 §2a — the DiffEntry kinds). */
export type DiffPaintKind = 'added' | 'removed' | 'moved' | 'changed' | 'rerouted';

export interface ViewerCanvasProps {
  /** Extra SVG content rendered on the overlay layer (world coordinates). */
  overlay?: ReactNode;
  /** Show closed (removedInVersion) elements. Default true. */
  showClosed?: boolean;
  /**
   * Diff painting (Handoff 15 §2a): element id → kind. When provided, every
   * rendered element gains a `data-diff-state` wrapper — elements NOT in the
   * map read `unchanged` and dim to 45% via CSS (never hidden). When absent
   * the render tree is BYTE-IDENTICAL to before (viewerEquivalence).
   */
  diffStates?: Record<string, DiffPaintKind>;
}

export function ViewerCanvas({ overlay, showClosed = true, diffStates }: ViewerCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { diagram } = useDiagram();
  const viewport = useCanvasState((s) => s.viewport);
  const gridSize = useCanvasState((s) => s.gridSize);
  const isPanning = useCanvasState((s) => s.isPanning);
  const drillId = useCanvasState((s) => s.drillId);
  const pan = useViewerPan(svgRef);

  const hiddenIds = useMemo(() => hiddenNodeIds(diagram, drillId), [diagram, drillId]);
  const { nodes, edges } = selectRenderList(diagram, hiddenIds, viewport, showClosed);

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
      onPointerDown={pan.onPointerDown}
      onPointerMove={pan.onPointerMove}
      onPointerUp={pan.onPointerUp}
      onPointerLeave={pan.onPointerUp}
      onWheel={swallowReactWheel}
    >
      <Defs gridSize={gridSize} />
      <GridLayer viewport={viewport} />
      <g data-layer="edges">
        {edges.map((edge) =>
          diffStates ? (
            <g key={edge.id} data-diff-state={diffStates[edge.id] ?? 'unchanged'}>
              <ConnectedEdge edge={edge} nodes={diagram.nodes} />
            </g>
          ) : (
            <ConnectedEdge key={edge.id} edge={edge} nodes={diagram.nodes} />
          ),
        )}
      </g>
      <g data-layer="nodes">
        {nodes.map((node) =>
          diffStates ? (
            <g key={node.id} data-diff-state={diffStates[node.id] ?? 'unchanged'}>
              <ConnectedNode node={node} interactions={NOOP_INTERACTIONS} />
            </g>
          ) : (
            <ConnectedNode key={node.id} node={node} interactions={NOOP_INTERACTIONS} />
          ),
        )}
      </g>
      <g data-layer="overlay">{overlay}</g>
    </svg>
  );
}

function swallowReactWheel(event: WheelEvent) {
  // Real handling happens in the non-passive native listener in useViewerPan.
  event.stopPropagation();
}
