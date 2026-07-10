import { ShapeLabel, theme, type ShapeProps } from '@buildtovalue/react';

/**
 * DRD shapes (Handoff 5 §4.1) — the DMN family claims the 185° teal step of
 * the 9-hue wheel; inside the family, differentiation is by FORM (OMG DMN
 * notation), by fill weight (logic / data / authority) — never by new hue.
 * OMG-standard geometry stays neutral: no bevel, no tag (§7.1). Selection
 * reuses the BPMN overlays (green 2.5 + halo + ports).
 */
const dmn = {
  fill: 'var(--btv-dmn-fill, #e2f0ee)',
  stroke: 'var(--btv-dmn-stroke, #26766b)',
  inputFill: 'var(--btv-dmn-input-fill, #f1f8f6)',
  inputStroke: 'var(--btv-dmn-input-stroke, #58968b)',
  knowledgeFill: 'var(--btv-dmn-knowledge-fill, #faf9f6)',
  knowledgeStroke: 'var(--btv-dmn-knowledge-stroke, #26766b)',
};

const strokeOf = (selected: boolean, resting: string) =>
  selected ? theme.strokeSelected : resting;
const widthOf = (selected: boolean) => (selected ? 2.5 : 1.5);

/** Decision: SHARP rectangle (rx 0); table glyph bottom-left when it has a
 * decision table bound. */
export function DmnDecisionShape({ node, selected }: ShapeProps) {
  const hasTable = node.properties.decisionTable !== undefined;
  return (
    <g>
      <rect
        width={node.width}
        height={node.height}
        fill={dmn.fill}
        stroke={strokeOf(selected, dmn.stroke)}
        strokeWidth={widthOf(selected)}
      />
      <ShapeLabel label={node.label} width={node.width} y={node.height / 2 + 4} />
      {hasTable && (
        <g
          data-decision-table-glyph
          transform={`translate(9, ${node.height - 17})`}
          stroke={dmn.stroke}
          fill="none"
          strokeWidth={1.1}
        >
          <rect width={12} height={9} rx={0.5} />
          <path d="M 0 3 H 12 M 4 3 V 9" />
        </g>
      )}
    </g>
  );
}

/** Input data: flattened oval (rx = h/2) — lighter fill: it is data, not logic. */
export function DmnInputDataShape({ node, selected }: ShapeProps) {
  return (
    <g>
      <rect
        width={node.width}
        height={node.height}
        rx={node.height / 2}
        ry={node.height / 2}
        fill={dmn.inputFill}
        stroke={strokeOf(selected, dmn.inputStroke)}
        strokeWidth={widthOf(selected)}
      />
      <ShapeLabel label={node.label} width={node.width} y={node.height / 2 + 4} />
    </g>
  );
}

/** Knowledge source: rectangle with a WAVY base (2 alternating curves,
 * amplitude 8) — paper-neutral fill: external authority. */
export function DmnKnowledgeSourceShape({ node, selected }: ShapeProps) {
  const w = node.width;
  const h = node.height;
  const base = h - 8;
  const path = [
    `M 0 0 H ${w} V ${base}`,
    `C ${(w * 5) / 6} ${base - 8} ${(w * 4) / 6} ${base + 8} ${w / 2} ${base}`,
    `C ${(w * 2) / 6} ${base - 8} ${w / 6} ${base + 8} 0 ${base}`,
    'Z',
  ].join(' ');
  return (
    <g>
      <path
        d={path}
        fill={dmn.knowledgeFill}
        stroke={strokeOf(selected, dmn.knowledgeStroke)}
        strokeWidth={widthOf(selected)}
      />
      <ShapeLabel label={node.label} width={node.width} y={node.height / 2 - 2} />
    </g>
  );
}

/** Business knowledge model: rectangle with two 12px cut corners (top-left in
 * perspective + bottom-right), inner edge visible. */
export function DmnBusinessKnowledgeModelShape({ node, selected }: ShapeProps) {
  const w = node.width;
  const h = node.height;
  const c = 12;
  const stroke = strokeOf(selected, dmn.stroke);
  return (
    <g>
      <polygon
        points={`${c},0 ${w},0 ${w},${h - c} ${w - c},${h} 0,${h} 0,${c}`}
        fill={dmn.fill}
        stroke={stroke}
        strokeWidth={widthOf(selected)}
      />
      {/* Perspective inner edge on the top-left bevel. */}
      <path d={`M ${c} 0 L ${c} ${c} L 0 ${c}`} fill="none" stroke={stroke} strokeWidth={1} />
      <ShapeLabel label={node.label} width={node.width} y={node.height / 2 + 4} />
    </g>
  );
}
