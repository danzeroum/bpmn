import { memo } from 'react';
import {
  straightConnection,
  waypointsToPath,
  type BpmnEdge,
  type BpmnNode,
  type EdgeGeometry,
  type Point,
} from '@buildtovalue/core';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useT } from '../i18n/I18nContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { isManualEdge } from './routeEdge.js';
import type { Interactions } from './useInteractions.js';
import { EDGE_CORNER_RADIUS, theme } from '../shapes/common.js';
import {
  ARROW_MARKER_ID,
  ARROW_MARKER_MUTED_ID,
  ARROW_MARKER_SELECTED_ID,
  EDGE_MARKER_CHEVRON_ID,
  EDGE_MARKER_DISC_ID,
  EDGE_MARKER_FILLED_ID,
  EDGE_MARKER_OPEN_ID,
} from './Defs.js';
import type { EdgeStyle } from '../plugins/types.js';

/** Below this zoom the purpose chip is hidden to keep dense graphs readable. */
const CHIP_MIN_ZOOM = 0.6;
/** Visible purpose text is truncated to this many chars (full text in <title>). */
const CHIP_MAX_CHARS = 24;

const DOMAIN_MARKER: Record<NonNullable<EdgeStyle['marker']>, string | undefined> = {
  filled: EDGE_MARKER_FILLED_ID,
  open: EDGE_MARKER_OPEN_ID,
  'double-chevron': EDGE_MARKER_CHEVRON_ID,
  disc: EDGE_MARKER_DISC_ID,
  // Handoff 19 §6b: a BPMN association is a plain line with NO flow arrow.
  none: undefined,
};

export interface EdgeRendererProps {
  edge: BpmnEdge;
  source: BpmnNode | undefined;
  target: BpmnNode | undefined;
  selected: boolean;
  /** Route handles + manual badge show on hover as well as selection (R-3). */
  hovered?: boolean;
  /** Live route while its own waypoint/segment is being dragged (R-3). */
  liveWaypoints?: Point[] | null;
  readOnly?: boolean;
  interactions?: Interactions;
  /** Drag offsets applied to endpoints while their node is being dragged. */
  sourceOffset: { dx: number; dy: number };
  targetOffset: { dx: number; dy: number };
  onSelect: (edgeId: string, additive: boolean) => void;
  onHoverChange?: (edgeId: string, hovered: boolean) => void;
  /** Roving keyboard focus target (tabIndex 0 vs -1). */
  focused?: boolean;
  onFocus?: () => void;
}

function EdgeRendererInner({
  edge,
  source,
  target,
  selected,
  hovered = false,
  liveWaypoints = null,
  readOnly = false,
  interactions,
  sourceOffset,
  targetOffset,
  onSelect,
  onHoverChange,
  focused = false,
  onFocus,
}: EdgeRendererProps) {
  const config = useEditorConfig();
  const t = useT();
  // Boolean selector: an edge re-renders only when crossing the zoom threshold,
  // not on every zoom step. Zoom % is `1200 / viewport.width` (see Toolbar).
  const chipsVisible = useCanvasState((s) => 1200 / s.viewport.width >= CHIP_MIN_ZOOM);
  // Squad Lane SL-9 — the Estrutura↔Colaboração perspective (one store key).
  const viewMode = useCanvasState((s) => s.viewMode);
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
  const manual = isManualEdge(edge);
  let geometry: EdgeGeometry;
  if (liveWaypoints && liveWaypoints.length >= 2) {
    // A manual-route edit in progress — follow the live waypoints exactly.
    const start = liveWaypoints[0];
    const end = liveWaypoints[liveWaypoints.length - 1];
    const mid = liveWaypoints[Math.floor(liveWaypoints.length / 2)];
    geometry = { path: waypointsToPath(liveWaypoints, EDGE_CORNER_RADIUS), start, end, midpoint: mid };
  } else if (edge.waypoints && edge.waypoints.length >= 2 && !dragging) {
    const start = edge.waypoints[0];
    const end = edge.waypoints[edge.waypoints.length - 1];
    const mid = edge.waypoints[Math.floor(edge.waypoints.length / 2)];
    geometry = { path: waypointsToPath(edge.waypoints, EDGE_CORNER_RADIUS), start, end, midpoint: mid };
  } else {
    geometry = config.edgeRouter(shiftedSource, shiftedTarget);
  }

  const closed = edge.removedInVersion !== undefined;
  const baseStyle: EdgeStyle | undefined = config.edgeStyles[edge.type];
  // Squad Lane SL-9 — merge the collaboration override ONLY in that view; a
  // style without one renders identically in both perspectives (no regression).
  const domainStyle: EdgeStyle | undefined =
    baseStyle && viewMode === 'colaboracao' && baseStyle.collaboration
      ? { ...baseStyle, ...baseStyle.collaboration }
      : baseStyle;
  // DMN requirement edges route STRAIGHT regardless of the editor's router
  // (Handoff 5 §4.1); explicit waypoints still win.
  if (domainStyle?.routing === 'straight' && !(edge.waypoints && edge.waypoints.length >= 2 && !dragging)) {
    geometry = straightConnection(shiftedSource, shiftedTarget);
  }

  // State always wins: closed (retired) → muted dashed, selected → highlight.
  // The domain style only paints the resting (open, unselected) edge.
  let stroke = closed ? theme.textMuted : selected ? theme.strokeSelected : theme.stroke;
  let strokeWidth = selected ? 2.5 : 1.5;
  let dash: string | undefined = closed ? '6,4' : undefined;
  let marker: string | undefined = closed
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

  // Fallback state (Handoff 10 R-2b): an A* edge whose route found no corridor
  // is cached anyway but flagged — dashed error stroke + a ⚠ chip — so the
  // author knows the line may cross a shape until the graph opens up. Never
  // shown mid-drag (the live preview isn't the settled route yet).
  const fallback = Boolean(edge.properties.routeFallback) && !closed && !dragging;
  if (fallback) {
    stroke = selected ? theme.strokeSelected : 'var(--btv-error, #b3372f)';
    dash = '5,4';
  }

  // Manual route (Handoff 10 R-3): identical to an auto edge at rest, but on
  // hover/selection it wears the gold stroke that pairs with its handles + 📍
  // badge — the affordance that its route is pinned.
  const manualActive = manual && (hovered || selected) && !closed && !dragging;
  if (manualActive) {
    stroke = 'var(--btv-gold, #9a7b1e)';
    strokeWidth = 2.5;
    dash = undefined;
  }

  // A manual route translated onto a shape (edge case 6) keeps its route but
  // flags ⚠ — never re-routed. Shares the chip with the auto no-corridor state.
  const collision = Boolean(edge.properties.routeCollision) && !closed && !dragging;

  // Route handles + 📍 badge reveal on hover/selection; editing is live once
  // selected (drag a handle or segment to author a manual bend).
  const editWaypoints: Point[] =
    liveWaypoints && liveWaypoints.length >= 2
      ? liveWaypoints
      : edge.waypoints && edge.waypoints.length >= 2
        ? edge.waypoints
        : [geometry.start, geometry.end];
  const showHandles = (hovered || selected) && !closed && !dragging;
  const editable = showHandles && selected && !readOnly && Boolean(interactions);

  // Edge labels sit on the LONGEST segment of the route, not the geometric
  // midpoint (§4) — the readability §8.1 criterion depends on it.
  const labelPoint =
    edge.waypoints && edge.waypoints.length >= 2 && !dragging
      ? longestSegmentMidpoint(liveWaypoints && liveWaypoints.length >= 2 ? liveWaypoints : edge.waypoints)
      : geometry.midpoint;

  // Mid-segment decoration is tied to the edge type (not selection); hidden
  // only on retired edges.
  const decoration = closed ? undefined : domainStyle?.midDecoration;

  return (
    <g
      data-edge-id={edge.id}
      data-selected={selected || undefined}
      data-focused={focused || undefined}
      role="link"
      aria-label={edge.label ?? t('canvas.edge.aria', { type: edge.type })}
      tabIndex={interactions && !readOnly ? (focused ? 0 : -1) : undefined}
      onFocus={onFocus}
      onPointerDown={(event) => {
        if (event.button !== undefined && event.button !== 0) return;
        event.stopPropagation();
        onSelect(edge.id, event.shiftKey);
        interactions?.armLongPress(event, 'edge', edge.id);
      }}
      onContextMenu={interactions ? (event) => interactions.onEdgeContextMenu(event, edge.id) : undefined}
      onPointerEnter={onHoverChange ? () => onHoverChange(edge.id, true) : undefined}
      onPointerLeave={onHoverChange ? () => onHoverChange(edge.id, false) : undefined}
      style={{ cursor: 'pointer', opacity: dragging ? 0.7 : undefined }}
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
        markerEnd={marker ? `url(#${marker})` : undefined}
        pointerEvents="none"
      />
      {decoration === 'check-disc' && (
        <ApprovalCheckDisc x={geometry.midpoint.x} y={geometry.midpoint.y} color={stroke} />
      )}
      {decoration === 'purpose-chip' && chipsVisible && (
        <PurposeChip x={geometry.midpoint.x} y={geometry.midpoint.y} purpose={edge.purpose} />
      )}
      {(fallback || collision) && chipsVisible && (
        <FallbackChip x={geometry.midpoint.x} y={geometry.midpoint.y} />
      )}
      {showHandles && (
        <RouteEditLayer
          edgeId={edge.id}
          waypoints={editWaypoints}
          manual={manual}
          editable={editable}
          interactions={interactions}
        />
      )}
      {manual && (hovered || selected) && chipsVisible && (
        <ManualBadge x={geometry.midpoint.x} y={geometry.midpoint.y} />
      )}
      {edge.label && (
        <text
          className="bpmnr-edge-label"
          x={labelPoint.x}
          y={labelPoint.y - 8}
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

/**
 * Fallback marker (Handoff 10 R-2b): a small ⚠ disc over the mid-segment of an
 * A* edge that found no obstacle-free corridor. Purely informational — the edge
 * still carries its best-effort cached route.
 */
function FallbackChip({ x, y }: { x: number; y: number }) {
  const t = useT();
  return (
    <g pointerEvents="none" aria-hidden="true">
      <title>{t('canvas.edge.noRoute')}</title>
      <circle cx={x} cy={y} r={7.5} fill="var(--btv-error, #b3372f)" />
      <text
        x={x}
        y={y + 3.6}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="#ffffff"
      >
        !
      </text>
    </g>
  );
}

/**
 * Manual-route affordance layer (Handoff 10 R-3): draggable segment hit-areas
 * (grab a segment, drag → author a bend → manual) and interior waypoint handles
 * (drag to move, double-click to remove). Handles are filled gold when the
 * route is already manual, hollow (white) when auto — the "drag to pin"
 * affordance. Each interactive handle carries an invisible 44px hit target for
 * touch (§6). When `editable` is false the layer is a pure hover preview.
 */
function RouteEditLayer({
  edgeId,
  waypoints,
  manual,
  editable,
  interactions,
}: {
  edgeId: string;
  waypoints: Point[];
  manual: boolean;
  editable: boolean;
  interactions?: Interactions;
}) {
  const fill = manual ? 'var(--btv-gold, #9a7b1e)' : '#ffffff';
  const stroke = manual ? 'var(--btv-gold, #9a7b1e)' : theme.strokeSelected;
  return (
    <g aria-hidden="true">
      {editable &&
        interactions &&
        waypoints.slice(0, -1).map((p, i) => {
          const q = waypoints[i + 1];
          return (
            <line
              key={`seg-${i}`}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke="transparent"
              strokeWidth={14}
              strokeLinecap="round"
              style={{ cursor: 'crosshair' }}
              onPointerDown={(event) =>
                interactions.onEdgeSegmentPointerDown(event, edgeId, i, waypoints)
              }
            />
          );
        })}
      {waypoints.map((p, i) => {
        const interior = i > 0 && i < waypoints.length - 1;
        return (
          <g key={`wp-${i}`}>
            {editable && interior && interactions && (
              <circle
                cx={p.x}
                cy={p.y}
                r={22}
                fill="transparent"
                style={{ cursor: 'grab' }}
                onPointerDown={(event) =>
                  interactions.onEdgeHandlePointerDown(event, edgeId, i, waypoints)
                }
                onDoubleClick={(event) =>
                  interactions.onEdgeWaypointDoubleClick(event, edgeId, i, waypoints)
                }
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={interior ? 5 : 3.5}
              fill={interior ? fill : '#ffffff'}
              stroke={stroke}
              strokeWidth={1.5}
              pointerEvents="none"
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Manual-route badge (Handoff 10 R-3): `📍 rota manual` pill over the
 * mid-segment, shown only on hover/selection — no permanent canvas ink.
 */
function ManualBadge({ x, y }: { x: number; y: number }) {
  const text = '📍 rota manual';
  const width = text.length * 6 + 12;
  return (
    <g pointerEvents="none" aria-hidden="true">
      <rect
        x={x - width / 2}
        y={y - 22}
        width={width}
        height={14}
        rx={7}
        fill="var(--btv-gold-soft, #FDFAF1)"
        stroke="var(--btv-gold, #9a7b1e)"
        strokeWidth={1}
      />
      <text
        x={x}
        y={y - 12}
        textAnchor="middle"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize={9}
        fill="var(--btv-gold, #9a7b1e)"
      >
        {text}
      </text>
    </g>
  );
}

/** Midpoint of the longest segment of a polyline route (§4 label placement). */
export function longestSegmentMidpoint(waypoints: Point[]): Point {
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i + 1 < waypoints.length; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  const a = waypoints[best];
  const b = waypoints[best + 1] ?? a;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export const EdgeRenderer = memo(EdgeRendererInner);

/** Granular store binding for one edge. */
export function ConnectedEdge({
  edge,
  nodes,
  interactions,
}: {
  edge: BpmnEdge;
  nodes: Record<string, BpmnNode>;
  interactions?: Interactions;
}) {
  const store = useCanvasStore();
  // One consolidated selector per edge (see ConnectedNode): flattened to
  // primitives so the shallowEqual selector cache stays effective while the
  // store notifies all listeners per frame.
  const view = useCanvasState((s) => {
    const sourceDragged = s.dragState?.active && s.dragState.nodeIds.includes(edge.sourceId);
    const targetDragged = s.dragState?.active && s.dragState.nodeIds.includes(edge.targetId);
    return {
      selected: s.selectedIds.includes(edge.id),
      hovered: s.hoveredEdgeId === edge.id,
      readOnly: s.readOnly,
      focused: s.focusedElementId === edge.id,
      liveWaypoints:
        s.edgeDrag?.edgeId === edge.id && s.edgeDrag.active ? s.edgeDrag.waypoints : null,
      sdx: sourceDragged ? s.dragState!.dx : 0,
      sdy: sourceDragged ? s.dragState!.dy : 0,
      tdx: targetDragged ? s.dragState!.dx : 0,
      tdy: targetDragged ? s.dragState!.dy : 0,
    };
  });

  return (
    <EdgeRenderer
      edge={edge}
      source={nodes[edge.sourceId]}
      target={nodes[edge.targetId]}
      selected={view.selected}
      hovered={view.hovered}
      liveWaypoints={view.liveWaypoints}
      readOnly={view.readOnly}
      interactions={interactions}
      sourceOffset={view.sdx !== 0 || view.sdy !== 0 ? { dx: view.sdx, dy: view.sdy } : ZERO_OFFSET}
      targetOffset={view.tdx !== 0 || view.tdy !== 0 ? { dx: view.tdx, dy: view.tdy } : ZERO_OFFSET}
      focused={view.focused}
      onFocus={() => store.setState({ focusedElementId: edge.id })}
      onHoverChange={(edgeId, next) => {
        const current = store.getState().hoveredEdgeId;
        if (next) store.setState({ hoveredEdgeId: edgeId });
        else if (current === edgeId) store.setState({ hoveredEdgeId: null });
      }}
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
