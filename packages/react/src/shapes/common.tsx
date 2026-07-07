import type { ReactNode } from 'react';
import type { ShapeProps } from '../plugins/types.js';

/** Theme tokens — override via CSS variables (see styles.css). */
export const theme = {
  stroke: 'var(--bpmnr-stroke, #44403a)',
  strokeSelected: 'var(--bpmnr-selected, #1a6a54)',
  fill: 'var(--bpmnr-fill, #ffffff)',
  fillActivity: 'var(--bpmnr-fill-activity, #f8f7f4)',
  fillEvent: 'var(--bpmnr-fill-event, #eef4f0)',
  fillGateway: 'var(--bpmnr-fill-gateway, #fdf4e3)',
  text: 'var(--bpmnr-text, #262220)',
  textMuted: 'var(--bpmnr-text-muted, #6f675a)',
};

export function strokeFor(selected: boolean): string {
  return selected ? theme.strokeSelected : theme.stroke;
}

export function strokeWidthFor(selected: boolean): number {
  return selected ? 2.5 : 1.5;
}

/** Multi-purpose centered label with rudimentary word wrapping. */
export function ShapeLabel({
  label,
  width,
  y,
  fontSize = 12,
  color = theme.text,
  maxLines = 3,
}: {
  label: string;
  width: number;
  y: number;
  fontSize?: number;
  color?: string;
  maxLines?: number;
}) {
  const lines = wrapLabel(label, Math.max(4, Math.floor(width / (fontSize * 0.58))), maxLines);
  return (
    <text
      x={width / 2}
      y={y}
      textAnchor="middle"
      fontSize={fontSize}
      fill={color}
      fontFamily="inherit"
      pointerEvents="none"
    >
      {lines.map((line, index) => (
        <tspan key={index} x={width / 2} dy={index === 0 ? 0 : fontSize + 2}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export function wrapLabel(label: string, charsPerLine: number, maxLines: number): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= charsPerLine || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  const consumed = lines.join(' ').length;
  if (consumed < label.trim().length && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : `${last}…`;
  }
  return lines;
}

/** Rounded-rectangle body shared by all activity shapes. */
export function ActivityBox({
  node,
  selected,
  children,
}: ShapeProps & { children?: ReactNode }) {
  return (
    <g>
      <rect
        width={node.width}
        height={node.height}
        rx={8}
        ry={8}
        fill={theme.fillActivity}
        stroke={strokeFor(selected)}
        strokeWidth={strokeWidthFor(selected)}
      />
      {children}
      <ShapeLabel label={node.label} width={node.width} y={node.height / 2 + 4} />
    </g>
  );
}
