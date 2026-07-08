import { theme } from '../shapes/common.js';

export const ARROW_MARKER_ID = 'bpmnr-arrow';
export const ARROW_MARKER_MUTED_ID = 'bpmnr-arrow-muted';
export const ARROW_MARKER_SELECTED_ID = 'bpmnr-arrow-selected';

/**
 * Domain edge markers. These inherit the edge's own stroke via
 * `context-stroke`, so a single marker serves every domain color (handoff,
 * approval, feedback, escalation) instead of one marker per color.
 */
export const EDGE_MARKER_FILLED_ID = 'bpmnr-edge-filled';
export const EDGE_MARKER_OPEN_ID = 'bpmnr-edge-open';
export const EDGE_MARKER_CHEVRON_ID = 'bpmnr-edge-chevron';
export const EDGE_MARKER_DISC_ID = 'bpmnr-edge-disc';

/** Craft-pack drop shadow, applied only to activity/card shapes. */
export const SHADOW_FILTER_ID = 'bpmnr-shadow';
/** Elevated variant swapped in by CSS while the node is hovered. */
export const SHADOW_HOVER_FILTER_ID = 'bpmnr-shadow-hover';

/** Shared SVG defs: arrowheads, the node shadow and the dot-grid pattern. */
export function Defs({ gridSize }: { gridSize: number }) {
  return (
    <defs>
      {/* Single shared filter with a tight region keeps 350-node graphs cheap. */}
      <filter id={SHADOW_FILTER_ID} x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow
          dx={0}
          dy={1}
          stdDeviation={2}
          style={{ floodColor: 'var(--bpmnr-shadow, #44403a)', floodOpacity: 0.1 }}
        />
      </filter>
      <filter id={SHADOW_HOVER_FILTER_ID} x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow
          dx={0}
          dy={2}
          stdDeviation={4}
          style={{ floodColor: 'var(--bpmnr-shadow, #44403a)', floodOpacity: 0.12 }}
        />
      </filter>
      <marker
        id={ARROW_MARKER_ID}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={theme.stroke} />
      </marker>
      <marker
        id={ARROW_MARKER_MUTED_ID}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={theme.textMuted} />
      </marker>
      <marker
        id={ARROW_MARKER_SELECTED_ID}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={theme.strokeSelected} />
      </marker>
      {/* Filled arrowhead that adopts the edge's own color (handoff/approval). */}
      <marker
        id={EDGE_MARKER_FILLED_ID}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
      </marker>
      {/* Open (two-line) arrowhead for feedback edges. */}
      <marker
        id={EDGE_MARKER_OPEN_ID}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="9"
        markerHeight="9"
        orient="auto-start-reverse"
      >
        <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="context-stroke" strokeWidth="1.4" />
      </marker>
      {/* Filled disc — the DMN authority-requirement tip (Handoff 5 §4.1). */}
      <marker
        id={EDGE_MARKER_DISC_ID}
        viewBox="0 0 10 10"
        refX="5"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <circle cx="5" cy="5" r="3.5" fill="context-stroke" />
      </marker>
      {/* Double chevron for escalation edges. */}
      <marker
        id={EDGE_MARKER_CHEVRON_ID}
        viewBox="0 0 12 10"
        refX="10"
        refY="5"
        markerWidth="10"
        markerHeight="9"
        orient="auto-start-reverse"
      >
        <path d="M 1 1 L 5 5 L 1 9 M 6 1 L 10 5 L 6 9" fill="none" stroke="context-stroke" strokeWidth="1.4" />
      </marker>
      <pattern
        id="bpmnr-grid"
        width={gridSize}
        height={gridSize}
        patternUnits="userSpaceOnUse"
      >
        <circle cx={1} cy={1} r={1} fill="var(--bpmnr-grid-dot, #d8d3c8)" />
      </pattern>
    </defs>
  );
}

/** Grid rectangle covering the current viewport. */
export function GridLayer({
  viewport,
}: {
  viewport: { x: number; y: number; width: number; height: number };
}) {
  // Oversize the rect so panning never reveals its border.
  return (
    <rect
      x={viewport.x - viewport.width}
      y={viewport.y - viewport.height}
      width={viewport.width * 3}
      height={viewport.height * 3}
      fill="url(#bpmnr-grid)"
      pointerEvents="none"
    />
  );
}
