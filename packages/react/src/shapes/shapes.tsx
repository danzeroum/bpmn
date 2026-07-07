import type { ShapeProps } from '../plugins/types.js';
import { ActivityBox, ShapeLabel, strokeFor, strokeWidthFor, theme } from './common.js';

export function StartEventShape({ node, selected }: ShapeProps) {
  const r = Math.min(node.width, node.height) / 2;
  return (
    <g>
      <circle
        cx={node.width / 2}
        cy={node.height / 2}
        r={r}
        fill={theme.fillEvent}
        stroke={strokeFor(selected)}
        strokeWidth={strokeWidthFor(selected)}
      />
      <ShapeLabel
        label={node.label}
        width={node.width}
        y={node.height + 16}
        fontSize={11}
        color={theme.textMuted}
        maxLines={2}
      />
    </g>
  );
}

export function EndEventShape({ node, selected }: ShapeProps) {
  const r = Math.min(node.width, node.height) / 2;
  return (
    <g>
      <circle
        cx={node.width / 2}
        cy={node.height / 2}
        r={r}
        fill={theme.fillEvent}
        stroke={strokeFor(selected)}
        strokeWidth={selected ? 4 : 3}
      />
      <circle
        cx={node.width / 2}
        cy={node.height / 2}
        r={Math.max(2, r - 5)}
        fill="none"
        stroke={strokeFor(selected)}
        strokeWidth={1}
      />
      <ShapeLabel
        label={node.label}
        width={node.width}
        y={node.height + 16}
        fontSize={11}
        color={theme.textMuted}
        maxLines={2}
      />
    </g>
  );
}

export function TaskShape(props: ShapeProps) {
  return <ActivityBox {...props} />;
}

/** Small person glyph in the top-left corner. */
export function UserTaskShape(props: ShapeProps) {
  return (
    <ActivityBox {...props}>
      <g transform="translate(8, 6)" fill="none" stroke={theme.textMuted} strokeWidth={1.4}>
        <circle cx={6} cy={4} r={3.2} />
        <path d="M 0.5 13 C 0.5 8.6 11.5 8.6 11.5 13" />
      </g>
    </ActivityBox>
  );
}

/** Gear glyph. */
export function ServiceTaskShape(props: ShapeProps) {
  return (
    <ActivityBox {...props}>
      <g transform="translate(8, 6)" fill="none" stroke={theme.textMuted} strokeWidth={1.4}>
        <circle cx={7} cy={7} r={3} />
        <path d="M 7 1.5 v 2 M 7 10.5 v 2 M 1.5 7 h 2 M 10.5 7 h 2 M 3.1 3.1 l 1.4 1.4 M 9.5 9.5 l 1.4 1.4 M 10.9 3.1 L 9.5 4.5 M 4.5 9.5 l -1.4 1.4" />
      </g>
    </ActivityBox>
  );
}

/** Script/scroll glyph. */
export function ScriptTaskShape(props: ShapeProps) {
  return (
    <ActivityBox {...props}>
      <g transform="translate(8, 6)" fill="none" stroke={theme.textMuted} strokeWidth={1.4}>
        <path d="M 2 1 h 8 c -2 2 2 4 0 6 c 2 2 -2 4 0 6 h -8 c 2 -2 -2 -4 0 -6 c -2 -2 2 -4 0 -6 z" />
        <path d="M 4 5 h 5 M 4 9 h 5" strokeWidth={1} />
      </g>
    </ActivityBox>
  );
}

function GatewayDiamond({ node, selected }: ShapeProps) {
  const { width, height } = node;
  return (
    <polygon
      points={`${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`}
      fill={theme.fillGateway}
      stroke={strokeFor(selected)}
      strokeWidth={strokeWidthFor(selected)}
    />
  );
}

function gatewayLabel(node: ShapeProps['node']) {
  return (
    <ShapeLabel
      label={node.label}
      width={node.width}
      y={node.height + 16}
      fontSize={11}
      color={theme.textMuted}
      maxLines={2}
    />
  );
}

export function ExclusiveGatewayShape(props: ShapeProps) {
  const { width, height } = props.node;
  const c = { x: width / 2, y: height / 2 };
  const o = Math.min(width, height) * 0.16;
  return (
    <g>
      <GatewayDiamond {...props} />
      <path
        d={`M ${c.x - o} ${c.y - o} L ${c.x + o} ${c.y + o} M ${c.x + o} ${c.y - o} L ${c.x - o} ${c.y + o}`}
        stroke={strokeFor(props.selected)}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {gatewayLabel(props.node)}
    </g>
  );
}

export function ParallelGatewayShape(props: ShapeProps) {
  const { width, height } = props.node;
  const c = { x: width / 2, y: height / 2 };
  const o = Math.min(width, height) * 0.22;
  return (
    <g>
      <GatewayDiamond {...props} />
      <path
        d={`M ${c.x} ${c.y - o} V ${c.y + o} M ${c.x - o} ${c.y} H ${c.x + o}`}
        stroke={strokeFor(props.selected)}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {gatewayLabel(props.node)}
    </g>
  );
}

export function InclusiveGatewayShape(props: ShapeProps) {
  const { width, height } = props.node;
  return (
    <g>
      <GatewayDiamond {...props} />
      <circle
        cx={width / 2}
        cy={height / 2}
        r={Math.min(width, height) * 0.2}
        fill="none"
        stroke={strokeFor(props.selected)}
        strokeWidth={2.5}
      />
      {gatewayLabel(props.node)}
    </g>
  );
}

export function SubProcessShape({ node, selected }: ShapeProps) {
  const boxSize = 14;
  return (
    <g>
      <rect
        width={node.width}
        height={node.height}
        rx={10}
        ry={10}
        fill={theme.fillActivity}
        stroke={strokeFor(selected)}
        strokeWidth={strokeWidthFor(selected)}
      />
      <ShapeLabel label={node.label} width={node.width} y={20} />
      <g
        transform={`translate(${node.width / 2 - boxSize / 2}, ${node.height - boxSize - 5})`}
        stroke={theme.textMuted}
        fill="none"
        strokeWidth={1.4}
      >
        <rect width={boxSize} height={boxSize} rx={2} />
        <path d={`M ${boxSize / 2} 3 V ${boxSize - 3} M 3 ${boxSize / 2} H ${boxSize - 3}`} />
      </g>
    </g>
  );
}

export function DataObjectShape({ node, selected }: ShapeProps) {
  const { width, height } = node;
  const fold = Math.min(width, height) * 0.28;
  return (
    <g>
      <path
        d={`M 0 0 H ${width - fold} L ${width} ${fold} V ${height} H 0 Z`}
        fill={theme.fill}
        stroke={strokeFor(selected)}
        strokeWidth={strokeWidthFor(selected)}
      />
      <path
        d={`M ${width - fold} 0 V ${fold} H ${width}`}
        fill="none"
        stroke={strokeFor(selected)}
        strokeWidth={1}
      />
      <ShapeLabel
        label={node.label}
        width={width}
        y={height + 14}
        fontSize={11}
        color={theme.textMuted}
        maxLines={2}
      />
    </g>
  );
}

export function TextAnnotationShape({ node, selected }: ShapeProps) {
  return (
    <g>
      <path
        d={`M 12 0 H 0 V ${node.height} H 12`}
        fill="none"
        stroke={strokeFor(selected)}
        strokeWidth={strokeWidthFor(selected)}
      />
      <ShapeLabel
        label={node.label}
        width={node.width}
        y={node.height / 2 + 4}
        fontSize={11}
        color={theme.textMuted}
      />
    </g>
  );
}

/**
 * Pool — a swimlane container with a rotated title band on the left. The body
 * has no fill so flow nodes placed on top stay visible and empty interior
 * clicks fall through to the canvas; select/drag via its border or band.
 */
export function PoolShape({ node, selected }: ShapeProps) {
  return <SwimlaneContainer node={node} selected={selected} band={30} fontSize={13} />;
}

/** Lane — a subdivision of a pool. Thinner title band, muted styling. */
export function LaneShape({ node, selected }: ShapeProps) {
  return <SwimlaneContainer node={node} selected={selected} band={24} fontSize={12} muted />;
}

function SwimlaneContainer({
  node,
  selected,
  band,
  fontSize,
  muted = false,
}: ShapeProps & { band: number; fontSize: number; muted?: boolean }) {
  const stroke = strokeFor(selected);
  return (
    <g>
      <rect
        width={node.width}
        height={node.height}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidthFor(selected)}
      />
      <line x1={band} y1={0} x2={band} y2={node.height} stroke={stroke} strokeWidth={1} />
      <rect
        width={band}
        height={node.height}
        fill={muted ? 'var(--bpmnr-fill-lane, transparent)' : 'var(--bpmnr-fill-pool, #f2f0ec)'}
        opacity={muted ? 0.5 : 1}
        pointerEvents="none"
      />
      <text
        x={band / 2}
        y={node.height / 2}
        transform={`rotate(-90, ${band / 2}, ${node.height / 2})`}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fill={muted ? theme.textMuted : theme.text}
        fontFamily="inherit"
        pointerEvents="none"
      >
        {node.label}
      </text>
    </g>
  );
}

export function DefaultShape({ node, selected }: ShapeProps) {
  return (
    <g>
      <rect
        width={node.width}
        height={node.height}
        rx={4}
        fill={theme.fill}
        stroke={strokeFor(selected)}
        strokeWidth={strokeWidthFor(selected)}
        strokeDasharray="4,3"
      />
      <ShapeLabel label={node.label} width={node.width} y={node.height / 2 + 4} />
    </g>
  );
}
