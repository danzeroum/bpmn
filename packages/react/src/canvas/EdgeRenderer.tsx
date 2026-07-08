import { memo } from 'react';
import {
  waypointsToPath,
  type BpmnEdge,
  type BpmnNode,
  type EdgeGeometry,
} from '@bpmn-react/core';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { EDGE_CORNER_RADIUS, theme } from '../shapes/common.js';
import {
  ARROW_MARKER_ID,
  ARROW_MARKER_MUTED_ID,
  ARROW_MARKER_SELECTED_ID,
  EDGE_MARKER_CHEVRON_ID,
  EDGE_MARKER_FILLED_ID,
  EDGE_MARKER_OPEN_ID,
} from './Defs.js';
import type { EdgeStyle } from '../plugins/types.js';

/** Below this zoom the purpose chip is hidden to keep dense graphs readable. */
const CHIP_MIN_ZOOM = 0.6;
/** Visible purpose text is truncated to this many chars (full text in <title>). */
const CHIP_MAX_CHARS = 24;

const DOMAIN_MARKER: Record<NonNullable<EdgeStyle['marker']>, string> = {
  filled: EDGE_MARKER_FILLED_ID,
  open: EDGE_MARKER_OPEN_ID,
  'double-chevron': EDGE_MARKER_CHEVRON_ID,
};

export interface EdgeRendererProps {
  edge: BpmnEdge;
  source: BpmnNode | undefined;
  target: BpmnNode | undefined;
  selected: boolean;
  /** Drag offsets applied to endpoints while their node is being dragged. */
  sourceOffset: { dx: number; dy: number };
  targetOffset: { dx: number; dy: number };
  onSelect: (edgeId: string, additive: boolean) => void;
}

function EdgeRendererInner({
  edge,
  source,
  target,
  selected,
  sourceOffset,
  targetOffset,
  onSelect,
}: EdgeRendererProps) {
  const config = useEditorConfig();
  // Boolean selector: an edge re-renders only when crossing the zoom threshold,
  // not on every zoom step. Zoom % is `1200 / viewport.width` (see Toolbar).
  const chipsVisible = useCanvasState((s) => 1200 / s.viewport.width >= CHIP_MIN_ZOOM);
  if (!source || !target) return null;

  const shiftedSource = {
    x: source.x + sourceOffset.dx,
    y: source.y + sourceOffset.dy,
    width: source.width,
    height: source.height,
  };
  const shiftedTarget = {
    x: target.x + targetOffset.dx,
    y: target.y + targetOffset.dy,
    width: target.width,
    height: target.height,
  };

  const dragging = sourceOffset.dx !== 0 || sourceOffset.dy !== 0 || targetOffset.dx !== 0 || targetOffset.dy !== 0;
  let geometry: EdgeGeometry;
  if (edge.waypoints && edge.waypoints.length >= 2 && !dragging) {
    const start = edge.waypoints[0];
    const end = edge.waypoints[edge.waypoints.length - 1];
    const mid = edge.waypoints[Math.floor(edge.waypoints.length / 2)];
    geometry = { path: waypointsToPath(edge.waypoints, EDGE_CORNER_RADIUS), start, end, midpoint: mid };
  } else {
    geometry = config.edgeRouter(shiftedSource, shiftedTarget);
  }

  const closed = edge.removedInVersion !== undefined;
  const domainStyle: EdgeStyle | undefined = config.edgeStyles[edge.type];

  // State always wins: closed (retired) → muted dashed, selected → highlight.
  // The domain style only paints the resting (open, unselected) edge.
  let stroke = closed ? theme.textMuted : selected ? theme.strokeSelected : theme.stroke;
  let strokeWidth = selected ? 2.5 : 1.5;
  let dash: string | undefined = closed ? '6,4' : undefined;
  let marker = closed
    ? ARROW_MARKER_MUTED_ID
    : selected
      ? ARROW_MARKER_SELECTED_ID
      : ARROW_MARKER_ID;

  if (domainStyle && !closed && !selected) {
    stroke = domainStyle.stroke;
    strokeWidth = domainStyle.strokeWidth ?? 1.5;
    dash = domainStyle.dash;
    marker = DOMAIN_MARKER[domainStyle.marker ?? 'filled'];
  }

  // Mid-segment decoration is tied to the edge type (not selection); hidden
  // only on retired edges.
  const decoration = closed ? undefined : domainStyle?.midDecoration;

  return (
    <g
      data-edge-id={edge.id}
      data-selected={selected || undefined}
      role="link"
      aria-label={edge.label ?? `${edge.type} connection`}
      onPointerDown={(event) => {
        if (event.button !== undefined && event.button !== 0) return;
        event.stopPropagation();
        onSelect(edge.id, event.shiftKey);
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* Invisible hit-area under the visible line. Must stay in the render
          tree (transparent stroke, not display:none) to receive events. */}
      <path d={geometry.path} fill="none" stroke="transparent" strokeWidth={12} />
      <path
        d={geometry.path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        markerEnd={`url(#${marker})`}
        pointerEvents="none"
      />
      {decoration === 'check-disc' && (
        <ApprovalCheckDisc x={geometry.midpoint.x} y={geometry.midpoint.y} color={stroke} />
      )}
      {decoration === 'purpose-chip' && chipsVisible && (
        <PurposeChip x={geometry.midpoint.x} y={geometry.midpoint.y} purpose={edge.purpose} />
      )}
      {edge.label && (
        <text
          className="bpmnr-edge-label"
          x={geometry.midpoint.x}
          y={geometry.midpoint.y - 8}
          textAnchor="middle"
          fontSize={11}
          fill={theme.textMuted}
          paintOrder="stroke"
          stroke="var(--bpmnr-canvas-bg, #faf9f6)"
          strokeWidth={3}
          strokeLinejoin="round"
          pointerEvents="none"
        >
          {edge.label}
        </text>
      )}
      {edge.purpose && <title>{edge.purpose}</title>}
    </g>
  );
}

/**
 * Approval decoration: a filled disc with a white check at the edge midpoint.
 * The disc adopts the edge's (green) color; the check stays light in both
 * themes since it sits on a saturated fill.
 */
function ApprovalCheckDisc({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={8} fill={color} />
      <path
        d={`M ${x - 3.5} ${y} L ${x - 1} ${y + 2.5} L ${x + 4} ${y - 3.5}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/**
 * Handoff decoration: a pill carrying the edge's purpose over the mid-segment,
 * promoting the hover-only <title> to visible state (Nielsen #1). The visible
 * text is truncated (full text stays in the edge <title>); a missing purpose
 * renders an error-colored placeholder, closing the loop with the domain
 * `handoffNeedsPurposeRule` warning.
 */
function PurposeChip({ x, y, purpose }: { x: number; y: number; purpose?: string }) {
  const full = (purpose ?? '').trim();
  const missing = full.length === 0;
  const text = missing
    ? 'sem purpose'
    : full.length > CHIP_MAX_CHARS
      ? `${full.slice(0, CHIP_MAX_CHARS - 1)}…`
      : full;
  const width = text.length * 6 + 14;
  const height = 15;
  const stroke = missing ? 'var(--btv-error, #b3372f)' : 'var(--btv-gold, #9a7b1e)';
  const fill = missing ? 'transparent' : 'var(--btv-gold-soft, #f6edd4)';
  return (
    <g pointerEvents="none">
      <rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={height}
        rx={7.5}
        fill={fill}
        stroke={stroke}
        strokeWidth={1}
      />
      <text
        x={x}
        y={y + 3.2}
        textAnchor="middle"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize={10}
        fill={stroke}
      >
        {text}
      </text>
    </g>
  );
}

export const EdgeRenderer = memo(EdgeRendererInner);

/** Granular store binding for one edge. */
export function ConnectedEdge({
  edge,
  nodes,
}: {
  edge: BpmnEdge;
  nodes: Record<string, BpmnNode>;
}) {
  const store = useCanvasStore();
  const selected = useCanvasState((s) => s.selectedIds.includes(edge.id));
  const sourceOffset = useCanvasState((s) =>
    s.dragState?.active && s.dragState.nodeIds.includes(edge.sourceId)
      ? { dx: s.dragState.dx, dy: s.dragState.dy }
      : ZERO_OFFSET,
  );
  const targetOffset = useCanvasState((s) =>
    s.dragState?.active && s.dragState.nodeIds.includes(edge.targetId)
      ? { dx: s.dragState.dx, dy: s.dragState.dy }
      : ZERO_OFFSET,
  );

  return (
    <EdgeRenderer
      edge={edge}
      source={nodes[edge.sourceId]}
      target={nodes[edge.targetId]}
      selected={selected}
      sourceOffset={sourceOffset}
      targetOffset={targetOffset}
      onSelect={(edgeId, additive) => {
        const current = store.getState().selectedIds;
        store.setState({
          selectedIds: additive
            ? current.includes(edgeId)
              ? current.filter((id) => id !== edgeId)
              : [...current, edgeId]
            : [edgeId],
        });
      }}
    />
  );
}

const ZERO_OFFSET = { dx: 0, dy: 0 };
