import { useCanvasState } from '../contexts/CanvasContext.js';
import { theme } from '../shapes/common.js';

/** Dashed preview line while a connection gesture is in progress. */
export function ConnectionPreview() {
  const connect = useCanvasState((s) => s.connectState);
  if (!connect) return null;
  const invalid = connect.invalidReason !== null;
  return (
    <g pointerEvents="none" data-connection-preview>
      <line
        className="bpmnr-connect-preview-line"
        x1={connect.sourcePoint.x}
        y1={connect.sourcePoint.y}
        x2={connect.currentPoint.x}
        y2={connect.currentPoint.y}
        stroke={invalid ? 'var(--bpmnr-danger, #b3372f)' : theme.strokeSelected}
        strokeWidth={1.5}
        strokeDasharray="6,4"
      />
      <circle
        cx={connect.currentPoint.x}
        cy={connect.currentPoint.y}
        r={4}
        fill={invalid ? 'var(--bpmnr-danger, #b3372f)' : theme.strokeSelected}
      />
      {invalid && connect.invalidReason && (
        <text
          x={connect.currentPoint.x + 10}
          y={connect.currentPoint.y - 10}
          fontSize={11}
          fill="var(--bpmnr-danger, #b3372f)"
        >
          {connect.invalidReason}
        </text>
      )}
    </g>
  );
}

/** Lasso rectangle during box selection. */
export function SelectionBoxOverlay() {
  const box = useCanvasState((s) => s.selectionBox);
  if (!box) return null;
  const x = Math.min(box.start.x, box.current.x);
  const y = Math.min(box.start.y, box.current.y);
  const width = Math.abs(box.current.x - box.start.x);
  const height = Math.abs(box.current.y - box.start.y);
  if (width < 2 && height < 2) return null;
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="var(--bpmnr-lasso-fill, rgba(26, 106, 84, 0.08))"
      stroke={theme.strokeSelected}
      strokeWidth={1}
      strokeDasharray="4,3"
      pointerEvents="none"
      data-selection-box
    />
  );
}
