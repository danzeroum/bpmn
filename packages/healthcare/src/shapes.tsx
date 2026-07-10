import { ShapeLabel, theme, type ShapeProps } from '@buildtovalue/react';

/**
 * Healthcare shapes (Handoff 5 §6) — 305° clinical violet family. Plugin
 * signature shared with the btv pack (§7 family grammar): gold value
 * chamfer (14px) on the top-right of cards + small-caps 8px type tag;
 * 1.5 ink stroke, 2.5 selected. Shapes stay pure (no hooks, no handlers).
 */
const HC_STROKE = 'var(--btv-hc-stroke, #7d5a9e)';
const HC_FILL = 'var(--btv-hc-fill, #f2e9f6)';
const GOLD = 'var(--btv-gold, #9a7b1e)';

const sw = (selected: boolean) => (selected ? 2.5 : 1.5);
const stroke = (selected: boolean) => (selected ? theme.strokeSelected : HC_STROKE);

/** Rounded card with the gold value chamfer on the top-right corner. */
function chamferedCard(w: number, h: number, r: number, c: number): string {
  return `M ${r} 0 H ${w - c} L ${w} ${c} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
}

function TypeTag({ text, x, y }: { text: string; x: number; y: number }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={8}
      letterSpacing={1.4}
      fill={HC_STROKE}
      pointerEvents="none"
      data-shape-tag
    >
      {text}
    </text>
  );
}

function GoldChamfer({ w }: { w: number }) {
  return <path d={`M ${w - 14} 0 L ${w} 14`} stroke={GOLD} strokeWidth={2.5} />;
}

/** Clinical task: violet card with a caregiver glyph. */
export function ClinicalTaskShape({ node, selected }: ShapeProps) {
  const { width: w, height: h } = node;
  return (
    <g>
      <path d={chamferedCard(w, h, 10, 14)} fill={HC_FILL} stroke={stroke(selected)} strokeWidth={sw(selected)} />
      <GoldChamfer w={w} />
      <g transform="translate(9, 8)" fill="none" stroke={HC_STROKE} strokeWidth={1.4}>
        <circle cx={5} cy={4} r={2.8} />
        <path d="M 0 13 C 0 8.5 10 8.5 10 13 M 12 4 H 17 M 14.5 1.5 V 6.5" />
      </g>
      <ShapeLabel label={node.label} width={w} y={h / 2 + 4} />
      <TypeTag text="CLINICAL TASK" x={9} y={h - 8} />
    </g>
  );
}

/**
 * Clinical decision: violet card + table glyph. Visible validation (§6):
 * without a linked DMN table the badge slot (top-right, the SAME slot as
 * the businessRuleTask link badge) shows the amber "▲ sem tabela DMN
 * vinculada" chip; with a decisionRef it shows the gold link badge.
 */
export function ClinicalDecisionShape({ node, selected }: ShapeProps) {
  const { width: w, height: h } = node;
  const decisionRef =
    typeof node.properties.decisionRef === 'string' ? node.properties.decisionRef : undefined;
  return (
    <g>
      <path d={chamferedCard(w, h, 10, 14)} fill={HC_FILL} stroke={stroke(selected)} strokeWidth={sw(selected)} />
      <GoldChamfer w={w} />
      <g transform="translate(9, 8)" fill="none" stroke={HC_STROKE} strokeWidth={1.3}>
        <rect width={16} height={12} rx={1} />
        <path d="M 0 4 H 16 M 5.5 4 V 12 M 10.5 4 V 12" />
      </g>
      <ShapeLabel label={node.label} width={w} y={h / 2 + 4} />
      <TypeTag text="CLINICAL DECISION" x={9} y={h - 8} />
      {decisionRef ? (
        <g data-decision-link transform={`translate(${w - 36}, -8)`} style={{ cursor: 'default' }}>
          <title>{`Decisão vinculada: ${decisionRef}`}</title>
          <rect width={30} height={16} rx={8} fill="var(--btv-dmn-link-badge-bg, #f6edd4)" stroke="var(--btv-dmn-link-badge-stroke, #9a7b1e)" strokeWidth={1} />
          <text x={15} y={8} textAnchor="middle" dominantBaseline="central" fontSize={8} letterSpacing={0.5} fill="var(--btv-dmn-link-badge-stroke, #9a7b1e)" pointerEvents="none">
            DMN
          </text>
        </g>
      ) : (
        <g data-hc-warning transform={`translate(${w - 36}, -8)`} style={{ cursor: 'default' }}>
          <title>sem tabela DMN vinculada</title>
          <rect width={30} height={16} rx={8} fill="var(--btv-hc-warning-bg, #fdf6e8)" stroke="var(--btv-hc-warning-stroke, #b8871f)" strokeWidth={1} />
          <text x={15} y={8} textAnchor="middle" dominantBaseline="central" fontSize={9} fill="var(--btv-hc-warning-stroke, #b8871f)" pointerEvents="none">
            ▲
          </text>
        </g>
      )}
    </g>
  );
}

/** Guideline: document card (folded corner) referencing clinical evidence. */
export function GuidelineShape({ node, selected }: ShapeProps) {
  const { width: w, height: h } = node;
  const fold = 14;
  return (
    <g>
      <path
        d={`M 0 0 H ${w - fold} L ${w} ${fold} V ${h} H 0 Z`}
        fill="var(--bpmnr-node-fill, #ffffff)"
        stroke={stroke(selected)}
        strokeWidth={sw(selected)}
      />
      <path d={`M ${w - fold} 0 V ${fold} H ${w}`} fill="none" stroke={HC_STROKE} strokeWidth={1.2} />
      <g stroke={HC_STROKE} strokeWidth={1.1}>
        <line x1={10} y1={18} x2={w - 22} y2={18} />
        <line x1={10} y1={26} x2={w - 14} y2={26} />
        <line x1={10} y1={34} x2={w - 18} y2={34} />
      </g>
      <ShapeLabel label={node.label} width={w} y={h - 14} />
      <TypeTag text="GUIDELINE" x={10} y={h - 4} />
    </g>
  );
}

/** Pathway gate: diamond with the branching-pathway glyph. */
export function PathwayGateShape({ node, selected }: ShapeProps) {
  const { width: w, height: h } = node;
  const cx = w / 2;
  const cy = h / 2;
  return (
    <g>
      <polygon
        points={`${cx},0 ${w},${cy} ${cx},${h} 0,${cy}`}
        fill={HC_FILL}
        stroke={stroke(selected)}
        strokeWidth={sw(selected)}
      />
      <g fill="none" stroke={HC_STROKE} strokeWidth={1.6}>
        <path d={`M ${cx} ${cy + 9} V ${cy} M ${cx} ${cy} L ${cx - 8} ${cy - 8} M ${cx} ${cy} L ${cx + 8} ${cy - 8}`} />
      </g>
      <ShapeLabel label={node.label} width={w} y={h + 14} color={theme.textMuted} />
    </g>
  );
}
