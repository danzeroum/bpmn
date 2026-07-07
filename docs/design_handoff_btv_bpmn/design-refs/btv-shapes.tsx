/**
 * BuildToValue — shapes do domínio btv (substitui packages/domain-example/src/shapes.tsx).
 * Assinatura visual: "chanfro de valor" dourado no canto sup. direito dos cards,
 * tag de tipo em small-caps, traço 1.5 / 2.5 selecionado, glifos no stroke do tipo.
 * Requer btv-tokens.css (fallbacks embutidos).
 */
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

/**
 * Paleta sem emojis — ícones unicode neutros (PaletteItem.icon é string hoje).
 * Para os ícones SVG desenhados (ver folha de notação), amplie o tipo para
 * `icon?: string | ReactNode` em plugins/types.ts e troque pelos componentes.
 */
export const BTV_PALETTE = [
  { id: 'btv-squad', label: 'Squad', nodeType: 'btv:squad', icon: '⬡' },
  { id: 'btv-persona', label: 'Persona', nodeType: 'btv:persona', icon: '◔', defaultProperties: { role: '' } },
  { id: 'btv-gate', label: 'Approval Gate', nodeType: 'btv:gate', icon: '⬢', defaultProperties: { approved: false } },
  { id: 'btv-prompt', label: 'Prompt', nodeType: 'btv:prompt', icon: '▤' },
  { id: 'btv-connector', label: 'Connector', nodeType: 'btv:connector', icon: '⌁' },
  { id: 'btv-deliverable', label: 'Deliverable', nodeType: 'btv:deliverable', icon: '⚑' },
] as const;

/**
 * Estilo dos edges do domínio (aplicar no EdgeRenderer / CSS):
 * handoff    — sólido 1.5, seta cheia, chip de purpose obrigatório (dourado)
 * approval   — sólido 2, verde, disco-check no ponto médio
 * feedback   — tracejado 5/4, ameixa, seta aberta
 * escalation — sólido 1.5, vermelho, seta dupla (chevron duplo)
 */
export const BTV_EDGE_STYLES = {
  handoff: { stroke: 'var(--btv-edge-handoff, #44403a)', strokeWidth: 1.5, dash: undefined, marker: 'filled' },
  approval: { stroke: 'var(--btv-edge-approval, #1a6a54)', strokeWidth: 2, dash: undefined, marker: 'filled+check' },
  feedback: { stroke: 'var(--btv-edge-feedback, #9a5580)', strokeWidth: 1.5, dash: '5,4', marker: 'open' },
  escalation: { stroke: 'var(--btv-edge-escalation, #b3372f)', strokeWidth: 1.5, dash: undefined, marker: 'double-chevron' },
} as const;
