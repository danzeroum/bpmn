import { theme } from '../shapes/common.js';

export const ARROW_MARKER_ID = 'bpmnr-arrow';
export const ARROW_MARKER_MUTED_ID = 'bpmnr-arrow-muted';
export const ARROW_MARKER_SELECTED_ID = 'bpmnr-arrow-selected';

/** Shared SVG defs: arrowheads and the dot-grid pattern. */
export function Defs({ gridSize }: { gridSize: number }) {
  return (
    <defs>
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
