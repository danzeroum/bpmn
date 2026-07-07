import { memo } from 'react';
import type { BpmnNode } from '@bpmn-react/core';
import { useCanvasState } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { DefaultShape } from '../shapes/index.js';
import { theme } from '../shapes/common.js';
import type { Interactions } from './useInteractions.js';

export interface NodeRendererProps {
  node: BpmnNode;
  selected: boolean;
  editable: boolean;
  interactions: Interactions;
  /** Visual drag offset applied while the gesture is in progress. */
  dx: number;
  dy: number;
  connectHover: 'valid' | 'invalid' | null;
}

function NodeRendererInner({
  node,
  selected,
  editable,
  interactions,
  dx,
  dy,
  connectHover,
}: NodeRendererProps) {
  const config = useEditorConfig();
  const Shape = config.shapes[node.type] ?? DefaultShape;
  const closed = node.removedInVersion !== undefined;

  return (
    <g
      transform={`translate(${node.x + dx}, ${node.y + dy})`}
      data-node-id={node.id}
      data-node-type={node.type}
      role="button"
      aria-label={`${node.type}: ${node.label}`}
      opacity={closed ? 0.45 : 1}
      style={{ cursor: editable ? 'grab' : 'default' }}
      onPointerDown={editable ? (e) => interactions.onNodePointerDown(e, node.id) : undefined}
    >
      <Shape node={node} selected={selected} />

      {connectHover && (
        <rect
          x={-4}
          y={-4}
          width={node.width + 8}
          height={node.height + 8}
          rx={8}
          fill="none"
          stroke={connectHover === 'valid' ? theme.strokeSelected : 'var(--bpmnr-danger, #b3372f)'}
          strokeWidth={2}
          strokeDasharray="4,3"
          pointerEvents="none"
        />
      )}

      {selected && !connectHover && (
        <rect
          x={-4}
          y={-4}
          width={node.width + 8}
          height={node.height + 8}
          rx={8}
          fill="none"
          stroke={theme.strokeSelected}
          strokeWidth={1}
          strokeDasharray="3,3"
          pointerEvents="none"
        />
      )}

      {editable && selected && (
        <ConnectionPorts node={node} interactions={interactions} />
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
          r={5}
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

  return (
    <NodeRenderer
      node={node}
      selected={selected}
      editable={!readOnly}
      interactions={interactions}
      dx={drag?.dx ?? 0}
      dy={drag?.dy ?? 0}
      connectHover={connectHover}
    />
  );
}
