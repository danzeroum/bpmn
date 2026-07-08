import type { EventDefinitionKind } from '@bpmn-react/core';
import { eventDefinitionOf, isNonInterrupting, isSubProcessExpanded } from '@bpmn-react/core';
import type { ShapeProps } from '../plugins/types.js';
import { ActivityBox, ShapeLabel, strokeFor, strokeWidthFor, theme } from './common.js';

/**
 * Typed-event glyph drawn inside an event circle. `filled` renders the throw
 * variant (solid glyph); catch/start/end use the outline variant. Glyphs are
 * neutral (muted ink) and scale to the circle radius `r`.
 */
function eventGlyph(kind: EventDefinitionKind, cx: number, cy: number, r: number, filled: boolean) {
  const color = theme.textMuted;
  const s = r * 0.5;
  const fill = filled ? color : 'none';
  const base = { stroke: color, strokeWidth: 1.3, fill: 'none' as const };
  switch (kind) {
    case 'message':
      return (
        <g strokeLinejoin="round">
          <rect x={cx - s} y={cy - s * 0.66} width={2 * s} height={s * 1.32} rx={1} stroke={color} strokeWidth={1.2} fill={fill} />
          <path d={`M ${cx - s} ${cy - s * 0.66} L ${cx} ${cy + s * 0.05} L ${cx + s} ${cy - s * 0.66}`} fill="none" stroke={filled ? theme.fillEvent : color} strokeWidth={1.2} />
        </g>
      );
    case 'timer':
      return (
        <g {...base}>
          <circle cx={cx} cy={cy} r={s} fill={fill} />
          <path d={`M ${cx} ${cy - s * 0.6} V ${cy} L ${cx + s * 0.5} ${cy + s * 0.3}`} stroke={filled ? theme.fillEvent : color} strokeLinecap="round" />
        </g>
      );
    case 'error':
      return <path d={`M ${cx - s} ${cy + s} L ${cx - s * 0.15} ${cy - s * 0.2} L ${cx + s * 0.15} ${cy + s * 0.25} L ${cx + s} ${cy - s}`} fill={filled ? color : 'none'} stroke={color} strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round" />;
    case 'signal':
      return <path d={`M ${cx} ${cy - s} L ${cx + s} ${cy + s * 0.7} L ${cx - s} ${cy + s * 0.7} Z`} fill={fill} stroke={color} strokeWidth={1.3} strokeLinejoin="round" />;
    case 'escalation':
      return <path d={`M ${cx - s * 0.8} ${cy + s * 0.7} L ${cx} ${cy - s} L ${cx + s * 0.8} ${cy + s * 0.7}`} fill={filled ? color : 'none'} stroke={color} strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round" />;
    case 'conditional':
      return (
        <g {...base}>
          <rect x={cx - s * 0.85} y={cy - s * 0.85} width={s * 1.7} height={s * 1.7} rx={1} fill={fill} />
          <path d={`M ${cx - s * 0.5} ${cy - s * 0.4} H ${cx + s * 0.5} M ${cx - s * 0.5} ${cy} H ${cx + s * 0.5} M ${cx - s * 0.5} ${cy + s * 0.4} H ${cx + s * 0.5}`} stroke={filled ? theme.fillEvent : color} />
        </g>
      );
    case 'link':
      return <path d={`M ${cx - s} ${cy - s * 0.4} H ${cx + s * 0.2} V ${cy - s * 0.8} L ${cx + s} ${cy} L ${cx + s * 0.2} ${cy + s * 0.8} V ${cy + s * 0.4} H ${cx - s} Z`} fill={fill} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />;
    case 'terminate':
      return <circle cx={cx} cy={cy} r={s} fill={color} stroke={color} />;
    default:
      return null;
  }
}

export function StartEventShape({ node, selected }: ShapeProps) {
  const r = Math.min(node.width, node.height) / 2;
  const kind = eventDefinitionOf(node);
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
      {kind && eventGlyph(kind, node.width / 2, node.height / 2, r, false)}
      <ShapeLabel
        label={node.label}
        width={node.width}
        y={node.height + 16}
        fontSize={11}
        color={theme.textMuted}
        maxLines={2}
        halo
      />
    </g>
  );
}

export function EndEventShape({ node, selected }: ShapeProps) {
  const r = Math.min(node.width, node.height) / 2;
  const kind = eventDefinitionOf(node);
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
      {kind && eventGlyph(kind, node.width / 2, node.height / 2, r, false)}
      <ShapeLabel
        label={node.label}
        width={node.width}
        y={node.height + 16}
        fontSize={11}
        color={theme.textMuted}
        maxLines={2}
        halo
      />
    </g>
  );
}

/**
 * Intermediate event: the BPMN double ring. Catch renders an outline glyph,
 * throw a filled one (`throwing`).
 */
function IntermediateEventShape({ node, selected, throwing }: ShapeProps & { throwing: boolean }) {
  const r = Math.min(node.width, node.height) / 2;
  const cx = node.width / 2;
  const cy = node.height / 2;
  const kind = eventDefinitionOf(node);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={theme.fillEvent} stroke={strokeFor(selected)} strokeWidth={strokeWidthFor(selected)} />
      <circle cx={cx} cy={cy} r={Math.max(2, r - 3)} fill="none" stroke={strokeFor(selected)} strokeWidth={strokeWidthFor(selected)} />
      {kind && eventGlyph(kind, cx, cy, r, throwing)}
      <ShapeLabel label={node.label} width={node.width} y={node.height + 16} fontSize={11} color={theme.textMuted} maxLines={2} halo />
    </g>
  );
}

export function IntermediateCatchEventShape(props: ShapeProps) {
  return <IntermediateEventShape {...props} throwing={false} />;
}

export function IntermediateThrowEventShape(props: ShapeProps) {
  return <IntermediateEventShape {...props} throwing />;
}

/**
 * Boundary event: a double-ring catch event that sits on its host's border.
 * Interrupting draws solid rings; non-interrupting (`cancelActivity: false`)
 * draws dashed rings.
 */
export function BoundaryEventShape({ node, selected }: ShapeProps) {
  const r = Math.min(node.width, node.height) / 2;
  const cx = node.width / 2;
  const cy = node.height / 2;
  const kind = eventDefinitionOf(node);
  const dash = isNonInterrupting(node) ? '3,2' : undefined;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={theme.fillEvent} stroke={strokeFor(selected)} strokeWidth={strokeWidthFor(selected)} strokeDasharray={dash} />
      <circle cx={cx} cy={cy} r={Math.max(2, r - 3)} fill="none" stroke={strokeFor(selected)} strokeWidth={strokeWidthFor(selected)} strokeDasharray={dash} />
      {kind && eventGlyph(kind, cx, cy, r, false)}
      <ShapeLabel label={node.label} width={node.width} y={node.height + 16} fontSize={11} color={theme.textMuted} maxLines={2} halo />
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

/** Send task: filled envelope. */
export function SendTaskShape(props: ShapeProps) {
  return (
    <ActivityBox {...props}>
      <g transform="translate(8, 6)" stroke={theme.textMuted} strokeWidth={1.2} strokeLinejoin="round">
        <rect x={0} y={1} width={16} height={11} rx={1} fill={theme.textMuted} />
        <path d="M 0.5 1.5 L 8 7.5 L 15.5 1.5" fill="none" stroke={theme.fillActivity} />
      </g>
    </ActivityBox>
  );
}

/** Receive task: outline envelope. */
export function ReceiveTaskShape(props: ShapeProps) {
  return (
    <ActivityBox {...props}>
      <g transform="translate(8, 6)" fill="none" stroke={theme.textMuted} strokeWidth={1.3} strokeLinejoin="round">
        <rect x={0} y={1} width={16} height={11} rx={1} />
        <path d="M 0.5 1.5 L 8 7.5 L 15.5 1.5" />
      </g>
    </ActivityBox>
  );
}

/** Manual task: hand glyph. */
export function ManualTaskShape(props: ShapeProps) {
  return (
    <ActivityBox {...props}>
      <g transform="translate(8, 5)" fill="none" stroke={theme.textMuted} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M 2 8 V 4.5 a 1 1 0 0 1 2 0 V 4 a 1 1 0 0 1 2 0 v 0.5 a 1 1 0 0 1 2 0 V 5 a 1 1 0 0 1 2 0 v 4 a 3.5 3.5 0 0 1 -3.5 3.5 H 5 a 3 3 0 0 1 -3 -3 z" />
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
      halo
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

/** Event-based gateway: a pentagon inside a double ring, inside the diamond. */
export function EventBasedGatewayShape(props: ShapeProps) {
  const { width, height } = props.node;
  const cx = width / 2;
  const cy = height / 2;
  const stroke = strokeFor(props.selected);
  const ro = Math.min(width, height) * 0.28;
  const ri = ro - 3;
  const rp = ri * 0.62;
  // Regular pentagon pointing up.
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `${(cx + rp * Math.cos(a)).toFixed(2)},${(cy + rp * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return (
    <g>
      <GatewayDiamond {...props} />
      <circle cx={cx} cy={cy} r={ro} fill="none" stroke={stroke} strokeWidth={1.4} />
      <circle cx={cx} cy={cy} r={ri} fill="none" stroke={stroke} strokeWidth={1.1} />
      <polygon points={pts} fill="none" stroke={stroke} strokeWidth={1.2} strokeLinejoin="round" />
      {gatewayLabel(props.node)}
    </g>
  );
}

export function SubProcessShape({ node, selected }: ShapeProps) {
  // Expanded sub-processes are light containers whose children render on top
  // (the interactive expand/collapse marker lives in the NodeRenderer, so the
  // shape stays pure). Collapsed ones look like a regular activity card.
  const expanded = isSubProcessExpanded(node);
  return (
    <g>
      <rect
        width={node.width}
        height={node.height}
        rx={10}
        ry={10}
        fill={expanded ? theme.fill : theme.fillActivity}
        stroke={strokeFor(selected)}
        strokeWidth={strokeWidthFor(selected)}
      />
      <ShapeLabel label={node.label} width={node.width} y={20} />
    </g>
  );
}

/**
 * Call activity: invokes another process (`properties.calledElement`). The
 * BPMN notation is an activity card with a THICK border and a static [+]
 * marker — the contents live in the called process, so the marker never
 * expands in place (drill happens through the registry, not the canvas).
 */
export function CallActivityShape({ node, selected }: ShapeProps) {
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
        strokeWidth={selected ? 4 : 3}
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

/** Data store: the BPMN cylinder (top ellipse + body rings). */
export function DataStoreShape({ node, selected }: ShapeProps) {
  const { width, height } = node;
  const ry = Math.min(10, height * 0.18);
  const stroke = strokeFor(selected);
  const strokeWidth = strokeWidthFor(selected);
  return (
    <g>
      <path
        d={`M 0 ${ry} A ${width / 2} ${ry} 0 0 1 ${width} ${ry} V ${height - ry} A ${width / 2} ${ry} 0 0 1 0 ${height - ry} Z`}
        fill={theme.fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <path
        d={`M 0 ${ry} A ${width / 2} ${ry} 0 0 0 ${width} ${ry}`}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <path
        d={`M 0 ${ry + 4} A ${width / 2} ${ry} 0 0 0 ${width} ${ry + 4}`}
        fill="none"
        stroke={stroke}
        strokeWidth={1}
      />
      <ShapeLabel
        label={node.label}
        width={width}
        y={height + 14}
        fontSize={11}
        color={theme.textMuted}
        maxLines={2}
        halo
      />
    </g>
  );
}

/**
 * Group: a non-semantic artifact — a dashed rounded rectangle that visually
 * frames a set of nodes. The interior is `fill: none` so clicks fall through to
 * the framed flow nodes; only the border and label are interactive.
 */
export function GroupShape({ node, selected }: ShapeProps) {
  return (
    <g>
      <rect
        width={node.width}
        height={node.height}
        rx={12}
        ry={12}
        fill="none"
        stroke={strokeFor(selected)}
        strokeWidth={strokeWidthFor(selected)}
        strokeDasharray="8,4"
      />
      <ShapeLabel label={node.label} width={node.width} y={18} color={theme.textMuted} />
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
        halo
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
