import { useMemo, useState } from 'react';
import {
  edgeVersionDiff,
  getEdgeChain,
  straightConnection,
  type BpmnDiff,
  type BpmnEdge,
  type BpmnNode,
} from '@buildtovalue/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useDismissal } from '../gestures/useDismissal.js';
import { DefaultShape } from '../shapes/index.js';
import { DiffView } from './DiffView.js';
import { SEAL_LABELS } from './StatusBadge.js';

export interface EdgePedigreeStripProps {
  /** Any edge of the chain — the strip walks to the root and forward. */
  edgeId: string;
  /** Host close hook; when present the strip joins the Esc dismissal stack. */
  onClose?: () => void;
  /** Resolves the ledger hash shown on card hover (§5: hover = hash). */
  ledgerHash?: (edge: BpmnEdge) => string | undefined;
}

/** Hatch pattern local to the strip (cards are their own small SVGs). */
const STRIP_HATCH_ID = 'bpmnr-pedigree-hatch';
const CARD_W = 70;
const CARD_H = 48;

/**
 * Edge pedigree strip (Handoff 5 §5, escolha 4b — pedigree é de EDGE):
 * a 180px bottom band over `getEdgeChain`, time flowing → along the
 * 1.5px rail. Each 70×48 card is a real miniature of that edge version —
 * the REGISTERED plugin shapes render the endpoints (aceite 10.5.7) —
 * closed versions hatched, the current one gold-bordered with the vigência
 * badge. "supersede ▸" in gold between cards; clicking a card opens the
 * DiffView of the two adjacent versions; hover surfaces the ledger hash.
 */
export function EdgePedigreeStrip({ edgeId, onClose, ledgerHash }: EdgePedigreeStripProps) {
  const { diagram } = useDiagram();
  const chain = useMemo(() => getEdgeChain(diagram, edgeId), [diagram, edgeId]);
  const [diffIndex, setDiffIndex] = useState<number | null>(null);

  // §11.1: the adjacent-versions diff closes before the strip itself.
  useDismissal('pedigree-diff', diffIndex !== null, () => setDiffIndex(null));
  useDismissal('pedigree-strip', Boolean(onClose), () => onClose?.());

  if (chain.length === 0) return null;

  const versionTag = (edge: BpmnEdge) =>
    edge.createdInVersion === diagram.version.id
      ? `v${diagram.version.semanticVersion}`
      : `#${edge.createdInVersion.slice(0, 7)}`;

  const diff: BpmnDiff | null =
    diffIndex !== null && diffIndex > 0 && chain[diffIndex]
      ? edgeVersionDiff(chain[diffIndex - 1], chain[diffIndex])
      : null;

  return (
    <aside className="bpmnr-pedigree" aria-label="Edge pedigree" data-edge-pedigree={edgeId}>
      <header className="bpmnr-pedigree-head">
        <span className="bpmnr-pedigree-kicker">PEDIGREE · CADEIA DE SUPERSESSÃO</span>
        {onClose && (
          <button type="button" aria-label="Fechar pedigree" onClick={onClose}>
            ✕
          </button>
        )}
      </header>
      <div className="bpmnr-pedigree-band">
        {/* ONE hatch def for the whole strip — the card SVGs reference it
            through the document (same 1 def / N uses budget as the canvas). */}
        <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden focusable="false">
          <defs>
            <pattern
              id={STRIP_HATCH_ID}
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke="var(--btv-closed-hatch, #a49c8f)"
                strokeWidth={1}
              />
            </pattern>
          </defs>
        </svg>
        <span className="bpmnr-pedigree-rail" aria-hidden />
        <ol className="bpmnr-pedigree-chain">
          {chain.map((edge, index) => {
            const closed = edge.removedInVersion !== undefined;
            const current = !closed && index === chain.length - 1;
            const hash = ledgerHash?.(edge);
            return (
              <li key={edge.id} className="bpmnr-pedigree-step">
                {index > 0 && (
                  <span className="bpmnr-pedigree-supersede" aria-hidden>
                    supersede ▸
                  </span>
                )}
                <span className="bpmnr-pedigree-entry">
                  <button
                    type="button"
                    className="bpmnr-pedigree-card"
                    data-pedigree-card={edge.id}
                    data-pedigree-closed={closed || undefined}
                    data-pedigree-current={current || undefined}
                    title={hash ? `ledger #${hash.slice(0, 7)}` : undefined}
                    aria-label={`Versão ${versionTag(edge)} da conexão`}
                    disabled={index === 0}
                    onClick={() => index > 0 && setDiffIndex(index)}
                  >
                    <CardSnapshot edge={edge} closed={closed} diagramNodes={diagram.nodes} />
                    {current && (
                      <span className="bpmnr-pedigree-badge" data-status={diagram.version.status}>
                        {SEAL_LABELS[diagram.version.status]}
                      </span>
                    )}
                  </button>
                  <span className="bpmnr-pedigree-label">
                    {edge.label ?? edge.purpose ?? edge.id}
                    <br />
                    {versionTag(edge)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        {diff && diffIndex !== null && (
          <div className="bpmnr-pedigree-diff" data-pedigree-diff role="dialog" aria-label="Diff">
            <header>
              <strong>
                {versionTag(chain[diffIndex - 1])} ⇄ {versionTag(chain[diffIndex])}
              </strong>
              <button type="button" aria-label="Fechar diff" onClick={() => setDiffIndex(null)}>
                ✕
              </button>
            </header>
            <DiffView diff={diff} diagram={diagram} />
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * 70×48 miniature of one edge version, drawn with the REAL registered
 * shapes of its endpoints (aceite 10.5.7) and the border-anchored straight
 * segment between them.
 */
function CardSnapshot({
  edge,
  closed,
  diagramNodes,
}: {
  edge: BpmnEdge;
  closed: boolean;
  diagramNodes: Record<string, BpmnNode>;
}) {
  const config = useEditorConfig();
  const source = diagramNodes[edge.sourceId];
  const target = diagramNodes[edge.targetId];
  if (!source || !target) {
    return <svg width={CARD_W} height={CARD_H} aria-hidden />;
  }
  const pad = 14;
  const minX = Math.min(source.x, target.x) - pad;
  const minY = Math.min(source.y, target.y) - pad;
  const maxX = Math.max(source.x + source.width, target.x + target.width) + pad;
  const maxY = Math.max(source.y + source.height, target.y + target.height) + pad;
  const geometry = straightConnection(source, target);
  const Source = config.shapes[source.type] ?? DefaultShape;
  const Target = config.shapes[target.type] ?? DefaultShape;
  return (
    <svg
      width={CARD_W}
      height={CARD_H}
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      focusable="false"
    >
      <g opacity={closed ? 0.75 : 1}>
        <path
          d={geometry.path}
          fill="none"
          stroke="var(--btv-pedigree-line, #a49c8f)"
          strokeWidth={4}
        />
        <g transform={`translate(${source.x}, ${source.y})`}>
          <Source node={source} selected={false} />
        </g>
        <g transform={`translate(${target.x}, ${target.y})`}>
          <Target node={target} selected={false} />
        </g>
        {closed && (
          <rect
            x={minX}
            y={minY}
            width={maxX - minX}
            height={maxY - minY}
            fill={`url(#${STRIP_HATCH_ID})`}
            data-pedigree-hatch
          />
        )}
      </g>
    </svg>
  );
}
