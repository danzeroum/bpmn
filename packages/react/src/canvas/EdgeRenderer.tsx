import { memo } from 'react';
import {
  waypointsToPath,
  type BpmnEdge,
  type BpmnNode,
  type EdgeGeometry,
} from '@bpmn-react/core';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { theme } from '../shapes/common.js';
import {
  ARROW_MARKER_ID,
  ARROW_MARKER_MUTED_ID,
  ARROW_MARKER_SELECTED_ID,
} from './Defs.js';

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
    geometry = { path: waypointsToPath(edge.waypoints), start, end, midpoint: mid };
  } else {
    geometry = config.edgeRouter(shiftedSource, shiftedTarget);
  }

  const closed = edge.removedInVersion !== undefined;
  const stroke = closed ? theme.textMuted : selected ? theme.strokeSelected : theme.stroke;
  const marker = closed
    ? ARROW_MARKER_MUTED_ID
    : selected
      ? ARROW_MARKER_SELECTED_ID
      : ARROW_MARKER_ID;

  return (
    <g
      data-edge-id={edge.id}
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
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={closed ? '6,4' : undefined}
        markerEnd={`url(#${marker})`}
        pointerEvents="none"
      />
      {edge.label && (
        <text
          x={geometry.midpoint.x}
          y={geometry.midpoint.y - 8}
          textAnchor="middle"
          fontSize={11}
          fill={theme.textMuted}
          pointerEvents="none"
        >
          {edge.label}
        </text>
      )}
      {edge.purpose && <title>{edge.purpose}</title>}
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
