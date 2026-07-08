import { memo } from 'react';
import type { BpmnNode } from '@bpmn-react/core';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { DefaultShape } from '../shapes/index.js';
import { theme } from '../shapes/common.js';
import type { Interactions } from './useInteractions.js';
import { NodeLabelEditor } from './NodeLabelEditor.js';
import { SHADOW_FILTER_ID } from './Defs.js';
import { ShapeErrorBoundary } from './ShapeErrorBoundary.js';

/** Below this zoom node shadows are dropped — SVG filters get expensive at scale. */
const SHADOW_MIN_ZOOM = 0.5;

export interface NodeRendererProps {
  node: BpmnNode;
  selected: boolean;
  editable: boolean;
  interactions: Interactions;
  /** Visual drag offset applied while the gesture is in progress. */
  dx: number;
  dy: number;
  connectHover: 'valid' | 'invalid' | null;
  /** Live rect override while a resize gesture is in progress. */
  resizeRect: { x: number; y: number; width: number; height: number } | null;
  /** True when this node's label is being edited inline. */
  editing: boolean;
}

function NodeRendererInner({
  node,
  selected,
  editable,
  interactions,
  dx,
  dy,
  connectHover,
  resizeRect,
  editing,
}: NodeRendererProps) {
  const config = useEditorConfig();
  const store = useCanvasStore();
  // Boolean selector: nodes re-render only when crossing the zoom threshold
  // (same pattern as the purpose chip in EdgeRenderer).
  const shadowsVisible = useCanvasState((s) => 1200 / s.viewport.width >= SHADOW_MIN_ZOOM);
  // Freshly created node plays the 120ms enter animation (craft pack A3).
  const entering = useCanvasState((s) => s.lastCreatedNodeId === node.id);
  const Shape = config.shapes[node.type] ?? DefaultShape;
  const closed = node.removedInVersion !== undefined;
  const rendered = resizeRect
    ? { ...node, x: resizeRect.x, y: resizeRect.y, width: resizeRect.width, height: resizeRect.height }
    : node;
  const typeDef = config.registry.has(node.type) ? config.registry.get(node.type) : undefined;
  // Shadows drop while the node is dragged (perf) and restore on drop.
  const dragging = dx !== 0 || dy !== 0;
  const hasShadow =
    !dragging && (typeDef ? (typeDef.visual?.shadow ?? typeDef.category === 'activity') : false);

  return (
    <g
      transform={`translate(${rendered.x + dx}, ${rendered.y + dy})`}
      data-node-id={node.id}
      data-node-type={node.type}
      data-selected={selected || undefined}
      role="button"
      aria-label={`${node.type}: ${node.label}`}
      opacity={closed ? 0.45 : 1}
      style={{ cursor: editable ? 'grab' : 'default' }}
      onPointerDown={editable ? (e) => interactions.onNodePointerDown(e, node.id) : undefined}
      onDoubleClick={editable ? (e) => interactions.onNodeDoubleClick(e, node.id) : undefined}
    >
      {/* Inner wrapper: the enter animation scales here (CSS transform) so it
          never fights the positional transform attribute on the outer <g>. */}
      <g
        className={entering ? 'bpmnr-node-enter' : undefined}
        onAnimationEnd={
          entering ? () => store.setState({ lastCreatedNodeId: null }) : undefined
        }
      >
        {/* The filter wraps only the shape so halo/ports/handles stay crisp. */}
        <ShapeErrorBoundary
          node={rendered}
          onError={(meta) => config.emitEditorEvent('shape.render.error', meta)}
        >
          {hasShadow && shadowsVisible ? (
            <g data-node-shadow filter={`url(#${SHADOW_FILTER_ID})`}>
              <Shape node={rendered} selected={selected} />
            </g>
          ) : (
            <Shape node={rendered} selected={selected} />
          )}
        </ShapeErrorBoundary>
      </g>
      {editing && <NodeLabelEditor node={rendered} />}

      {connectHover && (
        <rect
          x={-4}
          y={-4}
          width={rendered.width + 8}
          height={rendered.height + 8}
          rx={8}
          fill="none"
          stroke={connectHover === 'valid' ? theme.strokeSelected : 'var(--bpmnr-danger, #b3372f)'}
          strokeWidth={2}
          strokeDasharray="4,3"
          pointerEvents="none"
        />
      )}

      {/* Selection halo (craft spec): the shape's own 2.5 stroke is the solid
          outline; this soft offset ring replaces the old dashed marquee. */}
      {selected && !connectHover && (
        <rect
          x={-3}
          y={-3}
          width={rendered.width + 6}
          height={rendered.height + 6}
          rx={11}
          fill="none"
          stroke={theme.strokeSelected}
          strokeWidth={2}
          opacity={0.35}
          data-selection-halo
          pointerEvents="none"
        />
      )}

      {/* Ports live in the DOM whenever the node is editable; CSS fades them
          in on hover/selection (craft pack A2 — no per-node hover state). */}
      {editable && <ConnectionPorts node={rendered} interactions={interactions} />}
      {editable && selected && (
        <ResizeHandles node={rendered} nodeId={node.id} interactions={interactions} />
      )}
    </g>
  );
}

function ConnectionPorts({
  node,
  interactions,
}: {
  node: BpmnNode;
  interactions: Interactions;
}) {
  const ports = [
    { x: node.width, y: node.height / 2 },
    { x: node.width / 2, y: node.height },
    { x: 0, y: node.height / 2 },
    { x: node.width / 2, y: 0 },
  ];
  return (
    <g data-ports>
      {ports.map((port, index) => (
        <circle
          key={index}
          cx={port.x}
          cy={port.y}
          r={4}
          fill="var(--bpmnr-port, #ffffff)"
          stroke={theme.strokeSelected}
          strokeWidth={1.5}
          style={{ cursor: 'crosshair' }}
          data-port
          aria-label="Connection port"
          onPointerDown={(e) => interactions.onPortPointerDown(e, node.id)}
        />
      ))}
    </g>
  );
}

function ResizeHandles({
  node,
  nodeId,
  interactions,
}: {
  node: { width: number; height: number };
  nodeId: string;
  interactions: Interactions;
}) {
  const size = 7;
  const corners = [
    { corner: 'nw' as const, x: 0, y: 0, cursor: 'nwse-resize' },
    { corner: 'ne' as const, x: node.width, y: 0, cursor: 'nesw-resize' },
    { corner: 'sw' as const, x: 0, y: node.height, cursor: 'nesw-resize' },
    { corner: 'se' as const, x: node.width, y: node.height, cursor: 'nwse-resize' },
  ];
  return (
    <g data-resize-handles>
      {corners.map(({ corner, x, y, cursor }) => (
        <rect
          key={corner}
          x={x - size / 2}
          y={y - size / 2}
          width={size}
          height={size}
          fill="var(--bpmnr-port, #ffffff)"
          stroke={theme.strokeSelected}
          strokeWidth={1.2}
          style={{ cursor }}
          data-resize-corner={corner}
          aria-label={`Resize ${corner}`}
          onPointerDown={(e) => interactions.onResizePointerDown(e, nodeId, corner)}
        />
      ))}
    </g>
  );
}

export const NodeRenderer = memo(NodeRendererInner);

/** Connects a node id to its slice of canvas state, keeping renders granular. */
export function ConnectedNode({
  node,
  interactions,
}: {
  node: BpmnNode;
  interactions: Interactions;
}) {
  const selected = useCanvasState((s) => s.selectedIds.includes(node.id));
  const readOnly = useCanvasState((s) => s.readOnly);
  const drag = useCanvasState((s) =>
    s.dragState?.active && s.dragState.nodeIds.includes(node.id)
      ? { dx: s.dragState.dx, dy: s.dragState.dy }
      : null,
  );
  const connectHover = useCanvasState((s) =>
    s.connectState?.hoverTargetId === node.id
      ? s.connectState.invalidReason
        ? ('invalid' as const)
        : ('valid' as const)
      : null,
  );
  // Lanes light up as drop targets while a flow node is dragged over them.
  const laneDropTarget = useCanvasState((s) =>
    Boolean(s.dragState?.active && s.dragState.dropLaneId === node.id),
  );
  const resizeRect = useCanvasState((s) =>
    s.resizeState?.nodeId === node.id ? s.resizeState.current : null,
  );
  const editing = useCanvasState((s) => s.editingNodeId === node.id);

  return (
    <NodeRenderer
      node={node}
      selected={selected}
      editable={!readOnly}
      interactions={interactions}
      dx={drag?.dx ?? 0}
      dy={drag?.dy ?? 0}
      connectHover={connectHover ?? (laneDropTarget ? 'valid' : null)}
      resizeRect={resizeRect}
      editing={editing}
    />
  );
}
