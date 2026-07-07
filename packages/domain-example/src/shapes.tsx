/**
 * BuildToValue — shapes do domínio btv.
 *
 * Assinatura visual: "chanfro de valor" dourado no canto sup. direito dos
 * cards, tag de tipo em small-caps, traço 1.5 / 2.5 selecionado, glifos
 * desenhados no stroke do próprio tipo. Cores só via var(--btv-*, #hex) com
 * fallback (dark mode sai de graça; o SVG continua correto em export/PNG).
 *
 * Regra de rotulação (AI): só os *cards* levam a tag small-caps
 * (SQUAD/PROMPT/CONNECTOR). Formas geométricas auto-identificáveis — Persona
 * (pílula), Gate (hexágono), Deliverable (flâmula) — dispensam a tag.
 *
 * Requer os tokens de packages/react/styles.css (fallbacks embutidos).
 */
import type { ReactNode } from 'react';
import type { ShapeProps } from '@bpmn-react/react';
import { ShapeLabel, theme } from '@bpmn-react/react';

const sw = (selected: boolean) => (selected ? 2.5 : 1.5);
const GOLD = 'var(--btv-gold, #9a7b1e)';

function TypeTag({ text, x, y, color }: { text: string; x: number; y: number; color: string }) {
  return (
    <text x={x} y={y} fontSize={8} letterSpacing={1.4} fill={color} pointerEvents="none">
      {text}
    </text>
  );
}

/** Card com cantos arredondados e chanfro de valor (canto sup. direito). */
function chamferedCard(w: number, h: number, r: number, c: number): string {
  return `M ${r} 0 H ${w - c} L ${w} ${c} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
}

/** Squad: card índigo com glifo de time. */
export function SquadShape({ node, selected }: ShapeProps) {
  const { width: w, height: h } = node;
  const stroke = selected ? theme.strokeSelected : 'var(--btv-squad-stroke, #5566a6)';
  return (
    <g>
      <path d={chamferedCard(w, h, 12, 14)} fill="var(--btv-squad-fill, #e8ecf7)" stroke={stroke} strokeWidth={sw(selected)} />
      <path d={`M ${w - 14} 0 L ${w} 14`} stroke={GOLD} strokeWidth={2.5} />
      <g transform="translate(12, 10)" fill="none" stroke="var(--btv-squad-stroke, #5566a6)" strokeWidth={1.4}>
        <circle cx={5} cy={4} r={2.6} />
        <circle cx={13} cy={4} r={2.6} />
        <path d="M 0 12 C 0 8.5 10 8.5 10 12 M 8 12 C 8 8.5 18 8.5 18 12" />
      </g>
      <ShapeLabel label={node.label} width={w} y={h / 2 + 4} />
      <TypeTag text="SQUAD" x={12} y={h - 9} color="var(--btv-squad-stroke, #5566a6)" />
    </g>
  );
}

/** Persona: pílula âmbar com avatar e papel (role). */
export function PersonaShape({ node, selected }: ShapeProps) {
  const { width: w, height: h } = node;
  const role = typeof node.properties.role === 'string' ? node.properties.role : '';
  const stroke = selected ? theme.strokeSelected : 'var(--btv-persona-stroke, #b08a47)';
  return (
    <g>
      <rect width={w} height={h} rx={h / 2} fill="var(--btv-persona-fill, #fbf1dc)" stroke={stroke} strokeWidth={sw(selected)} />
      <circle cx={h / 2} cy={h / 2} r={h / 2 - 8} fill="var(--btv-persona-avatar, #f0dfb8)" stroke="var(--btv-persona-stroke, #b08a47)" strokeWidth={1} />
      <g transform={`translate(${h / 2 - 6}, ${h / 2 - 8})`} fill="none" stroke="var(--btv-persona-stroke, #b08a47)" strokeWidth={1.4}>
        <circle cx={6} cy={4.5} r={3} />
        <path d="M 0.5 14 C 0.5 9 11.5 9 11.5 14" />
      </g>
      <text x={h + 4} y={h / 2 - 2} fontSize={12} fontWeight={600} fill={theme.text} pointerEvents="none">
        {node.label}
      </text>
      <text x={h + 4} y={h / 2 + 12} fontSize={10} fill={theme.textMuted} pointerEvents="none">
        {role || 'persona'}
      </text>
    </g>
  );
}

/** Gate: hexágono; pendente (pausa dourada) ou aprovado (check verde). */
export function GateShape({ node, selected }: ShapeProps) {
  const approved = node.properties.approved === true;
  const { width: w, height: h } = node;
  const cx = w / 2;
  const cy = h / 2;
  const stroke = selected
    ? theme.strokeSelected
    : approved
      ? 'var(--btv-gate-approved-stroke, #1a6a54)'
      : 'var(--btv-gate-pending-stroke, #9a7b1e)';
  return (
    <g>
      {/* Recupera o sinal que o ✋/✓ dava agora que os glifos são desenhados. */}
      <title>{approved ? 'aprovado' : 'aguardando aprovação'}</title>
      <polygon
        points={`${w * 0.25},0 ${w * 0.75},0 ${w},${h / 2} ${w * 0.75},${h} ${w * 0.25},${h} 0,${h / 2}`}
        fill={approved ? 'var(--btv-gate-approved, #dff0e6)' : 'var(--btv-gate-pending, #f6edd4)'}
        stroke={stroke}
        strokeWidth={sw(selected)}
      />
      <circle cx={cx} cy={cy} r={11} fill="none" stroke={stroke} strokeWidth={1.6} />
      {approved ? (
        <path d={`M ${cx - 5} ${cy} L ${cx - 1.5} ${cy + 3.5} L ${cx + 5} ${cy - 4}`} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d={`M ${cx - 3} ${cy - 4} V ${cy + 4} M ${cx + 3} ${cy - 4} V ${cy + 4}`} stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      )}
      <ShapeLabel label={node.label} width={w} y={h + 14} fontSize={11} color={theme.textMuted} maxLines={2} />
    </g>
  );
}

/** Prompt: nota ameixa com dobra de papel (a dobra É o chanfro do tipo). */
export function PromptShape({ node, selected }: ShapeProps) {
  const { width: w, height: h } = node;
  const f = 16; // dobra
  const stroke = selected ? theme.strokeSelected : 'var(--btv-prompt-stroke, #9a5580)';
  return (
    <g>
      <path
        d={`M 6 0 H ${w - f} L ${w} ${f} V ${h - 6} Q ${w} ${h} ${w - 6} ${h} H 6 Q 0 ${h} 0 ${h - 6} V 6 Q 0 0 6 0 Z`}
        fill="var(--btv-prompt-fill, #f5e9f0)"
        stroke={stroke}
        strokeWidth={sw(selected)}
      />
      <path d={`M ${w - f} 0 V ${f} H ${w}`} fill="none" stroke={stroke} strokeWidth={1} />
      <g stroke={stroke} strokeWidth={1} opacity={0.5}>
        <line x1={12} y1={14} x2={w - f - 20} y2={14} />
        <line x1={12} y1={22} x2={w - f - 4} y2={22} />
      </g>
      <ShapeLabel label={node.label} width={w} y={h / 2 + 12} />
      <TypeTag text="PROMPT" x={12} y={h - 8} color="var(--btv-prompt-stroke, #9a5580)" />
    </g>
  );
}

/** Connector: card azul de borda tracejada (fronteira externa) com plugue. */
export function ConnectorShape({ node, selected }: ShapeProps) {
  const { width: w, height: h } = node;
  const stroke = selected ? theme.strokeSelected : 'var(--btv-connector-stroke, #2f6e94)';
  return (
    <g>
      <rect width={w} height={h} rx={10} fill="var(--btv-connector-fill, #e3eef6)" stroke={stroke} strokeWidth={sw(selected)} strokeDasharray="6,3" />
      <g transform="translate(12, 10)" fill="none" stroke="var(--btv-connector-stroke, #2f6e94)" strokeWidth={1.4}>
        <path d="M 3 0 v 5 M 9 0 v 5" />
        <path d="M 1 5 h 10 v 3 a 5 5 0 0 1 -10 0 z" />
        <path d="M 6 13 v 4" />
      </g>
      <ShapeLabel label={node.label} width={w} y={h / 2 + 8} />
      <TypeTag text="CONNECTOR" x={12} y={h - 8} color="var(--btv-connector-stroke, #2f6e94)" />
    </g>
  );
}

/**
 * Ícones de linha da paleta (§5.5, folha 07) — substituem os emojis.
 * Grade 20px, traço 1.5, stroke na cor do próprio tipo via var(--btv-*)
 * com fallback. `PaletteItem.icon` é `ReactNode`, então entram como SVG.
 * Chaveados por nodeType para o plugin em index.ts consumir sem JSX.
 */
export const BTV_PALETTE_ICONS: Record<string, ReactNode> = {
  'btv:squad': (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="var(--btv-squad-stroke, #5566a6)" strokeWidth={1.5}>
      <circle cx={7} cy={8} r={2.2} />
      <circle cx={13} cy={8} r={2.2} />
      <path d="M 4 14.5 C 4 11.5 10 11.5 10 14.5 M 10 14.5 C 10 11.5 16 11.5 16 14.5" />
    </svg>
  ),
  'btv:persona': (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="var(--btv-persona-stroke, #b08a47)" strokeWidth={1.5}>
      <rect x={2.5} y={6} width={15} height={8} rx={4} />
      <circle cx={6.5} cy={10} r={2.2} />
    </svg>
  ),
  'btv:gate': (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="var(--btv-gate-pending-stroke, #9a7b1e)" strokeWidth={1.5}>
      <polygon points="6.5,3.5 13.5,3.5 17.5,10 13.5,16.5 6.5,16.5 2.5,10" />
      <path d="M 8.5 8 V 12 M 11.5 8 V 12" strokeLinecap="round" />
    </svg>
  ),
  'btv:prompt': (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="var(--btv-prompt-stroke, #9a5580)" strokeWidth={1.5}>
      <path d="M 4 3 H 13 L 16.5 6.5 V 17 H 4 Z" />
      <path d="M 13 3 V 6.5 H 16.5" strokeWidth={1} />
      <path d="M 6.5 10 H 13" strokeWidth={1} />
    </svg>
  ),
  'btv:connector': (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="var(--btv-connector-stroke, #2f6e94)" strokeWidth={1.5}>
      <path d="M 8 3.5 v 3 M 12 3.5 v 3" />
      <path d="M 6.5 6.5 h 7 v 2.5 a 3.5 3.5 0 0 1 -7 0 z" />
      <path d="M 10 13 v 3.5" />
    </svg>
  ),
  'btv:deliverable': (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="var(--btv-deliverable-stroke, #3b7d4f)" strokeWidth={1.5}>
      <path d="M 4 3.5 H 16 V 12 L 10 16.5 L 4 12 Z" />
    </svg>
  ),
};

/** Deliverable: flâmula verde com filete interno (valor embalado). */
export function DeliverableShape({ node, selected }: ShapeProps) {
  const { width: w, height: h } = node;
  const stroke = selected ? theme.strokeSelected : 'var(--btv-deliverable-stroke, #3b7d4f)';
  return (
    <g>
      <path
        d={`M 0 0 H ${w} V ${h * 0.72} L ${w / 2} ${h} L 0 ${h * 0.72} Z`}
        fill="var(--btv-deliverable-fill, #e3efe4)"
        stroke={stroke}
        strokeWidth={sw(selected)}
      />
      <path
        d={`M 5 5 H ${w - 5} V ${h * 0.72 - 2.5} L ${w / 2} ${h - 6.5} L 5 ${h * 0.72 - 2.5} Z`}
        fill="none"
        stroke={stroke}
        strokeWidth={1}
        opacity={0.35}
      />
      <ShapeLabel label={node.label} width={w} y={h / 2 - 2} />
    </g>
  );
}
