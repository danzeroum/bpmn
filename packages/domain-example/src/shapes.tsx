import type { ShapeProps } from '@bpmn-react/react';
import { ShapeLabel, theme } from '@bpmn-react/react';

const stroke = (selected: boolean) => (selected ? theme.strokeSelected : theme.stroke);
const strokeWidth = (selected: boolean) => (selected ? 2.5 : 1.5);

/** Squad: container card with a team glyph. */
export function SquadShape({ node, selected }: ShapeProps) {
  return (
    <g>
      <rect
        width={node.width}
        height={node.height}
        rx={12}
        fill="var(--btv-squad-fill, #eef1f8)"
        stroke={stroke(selected)}
        strokeWidth={strokeWidth(selected)}
      />
      <g transform="translate(10, 8)" fill="none" stroke={theme.textMuted} strokeWidth={1.4}>
        <circle cx={5} cy={4} r={2.6} />
        <circle cx={13} cy={4} r={2.6} />
        <path d="M 0 12 C 0 8.5 10 8.5 10 12 M 8 12 C 8 8.5 18 8.5 18 12" />
      </g>
      <ShapeLabel label={node.label} width={node.width} y={node.height / 2 + 4} />
      <text x={10} y={node.height - 8} fontSize={10} fill={theme.textMuted} pointerEvents="none">
        squad
      </text>
    </g>
  );
}

/** Persona: rounded card with an avatar circle and role subtitle. */
export function PersonaShape({ node, selected }: ShapeProps) {
  const role = typeof node.properties.role === 'string' ? node.properties.role : '';
  return (
    <g>
      <rect
        width={node.width}
        height={node.height}
        rx={node.height / 2}
        fill="var(--btv-persona-fill, #fdf3e3)"
        stroke={stroke(selected)}
        strokeWidth={strokeWidth(selected)}
      />
      <circle
        cx={node.height / 2}
        cy={node.height / 2}
        r={node.height / 2 - 8}
        fill="var(--btv-persona-avatar, #f3ddb0)"
        stroke={theme.textMuted}
        strokeWidth={1}
      />
      <g
        transform={`translate(${node.height / 2 - 6}, ${node.height / 2 - 8})`}
        fill="none"
        stroke={theme.textMuted}
        strokeWidth={1.4}
      >
        <circle cx={6} cy={4.5} r={3} />
        <path d="M 0.5 14 C 0.5 9 11.5 9 11.5 14" />
      </g>
      <text
        x={node.height + 4}
        y={node.height / 2 - 2}
        fontSize={12}
        fontWeight={600}
        fill={theme.text}
        pointerEvents="none"
      >
        {node.label}
      </text>
      <text
        x={node.height + 4}
        y={node.height / 2 + 12}
        fontSize={10}
        fill={theme.textMuted}
        pointerEvents="none"
      >
        {role || 'persona'}
      </text>
    </g>
  );
}

/** Gate: hexagon, pending (hand) or approved (check). */
export function GateShape({ node, selected }: ShapeProps) {
  const approved = node.properties.approved === true;
  const { width: w, height: h } = node;
  return (
    <g>
      <polygon
        points={`${w * 0.25},0 ${w * 0.75},0 ${w},${h / 2} ${w * 0.75},${h} ${w * 0.25},${h} 0,${h / 2}`}
        fill={approved ? 'var(--btv-gate-approved, #dff0e6)' : 'var(--btv-gate-pending, #fdf3e3)'}
        stroke={selected ? theme.strokeSelected : approved ? '#1a6a54' : '#b08a24'}
        strokeWidth={strokeWidth(selected)}
      />
      <text
        x={w / 2}
        y={h / 2 + 5}
        textAnchor="middle"
        fontSize={16}
        pointerEvents="none"
        aria-hidden
      >
        {approved ? '✓' : '✋'}
      </text>
      <ShapeLabel
        label={node.label}
        width={w}
        y={h + 14}
        fontSize={11}
        color={theme.textMuted}
        maxLines={2}
      />
    </g>
  );
}

/** Prompt: note card with lines. */
export function PromptShape({ node, selected }: ShapeProps) {
  return (
    <g>
      <rect
        width={node.width}
        height={node.height}
        rx={6}
        fill="var(--btv-prompt-fill, #f4e9ef)"
        stroke={stroke(selected)}
        strokeWidth={strokeWidth(selected)}
      />
      <g stroke={theme.textMuted} strokeWidth={1}>
        <line x1={10} y1={14} x2={node.width - 40} y2={14} />
        <line x1={10} y1={22} x2={node.width - 24} y2={22} />
      </g>
      <ShapeLabel label={node.label} width={node.width} y={node.height / 2 + 12} />
    </g>
  );
}

/** Connector: external tool plug. */
export function ConnectorShape({ node, selected }: ShapeProps) {
  return (
    <g>
      <rect
        width={node.width}
        height={node.height}
        rx={8}
        fill="var(--btv-connector-fill, #e6f0fa)"
        stroke={stroke(selected)}
        strokeWidth={strokeWidth(selected)}
        strokeDasharray="6,3"
      />
      <g transform="translate(10, 8)" fill="none" stroke={theme.textMuted} strokeWidth={1.4}>
        <path d="M 3 0 v 5 M 9 0 v 5" />
        <path d="M 1 5 h 10 v 3 a 5 5 0 0 1 -10 0 z" />
        <path d="M 6 13 v 4" />
      </g>
      <ShapeLabel label={node.label} width={node.width} y={node.height / 2 + 8} />
    </g>
  );
}

/** Deliverable: output flag card. */
export function DeliverableShape({ node, selected }: ShapeProps) {
  const { width: w, height: h } = node;
  return (
    <g>
      <path
        d={`M 0 0 H ${w} V ${h * 0.72} L ${w / 2} ${h} L 0 ${h * 0.72} Z`}
        fill="var(--btv-deliverable-fill, #e7efe9)"
        stroke={stroke(selected)}
        strokeWidth={strokeWidth(selected)}
      />
      <ShapeLabel label={node.label} width={w} y={h / 2 - 2} />
    </g>
  );
}
