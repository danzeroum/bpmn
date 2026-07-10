import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { BpmnNode, VersionStatus } from '@buildtovalue/core';
import { SEAL_LABELS, useCanvasState, useDiagram, useDismissal } from '@buildtovalue/react';
import { decisionTableOf, HIT_POLICIES, type DecisionTable } from './decisionTable.js';

/**
 * What the peek/inspector know about a linked decision — resolved by the
 * host (registry lookup) or, by default, from a `dmn:decision` node in the
 * same diagram (whose governance identity is the diagram's version).
 */
export interface DecisionSummary {
  ref: string;
  label: string;
  semanticVersion?: string;
  status?: VersionStatus;
  table?: DecisionTable;
}

export interface DecisionPeekProps {
  /** Resolves a decisionRef; default looks for a dmn:decision in the diagram. */
  resolveDecision?: (ref: string) => DecisionSummary | undefined;
  /** Footer "editar tabela →" — opens the decision's own surface. */
  onOpen?: (ref: string) => void;
}

const PEEK_WIDTH = 300;

/**
 * Read-only decision peek (Handoff 5 §4.3, spec revisada): opens on the
 * SELECTION of a businessRuleTask with a decisionRef — selection is the
 * trigger so touch works without hover. A 300px DOM overlay positioned to
 * the right of the node (flipped when it wouldn't fit), rendered as a child
 * of <BpmnDesigner> — ZERO nodes inserted into the SVG (aceite 10.5.1).
 * Closes via the single Esc dismissal stack (above selection, below
 * popovers — §11.1), on deselection, and on drill-down.
 */
export function DecisionPeek({ resolveDecision, onOpen }: DecisionPeekProps) {
  const { diagram } = useDiagram();
  const selectedIds = useCanvasState((s) => s.selectedIds);
  const viewport = useCanvasState((s) => s.viewport);
  const drillId = useCanvasState((s) => s.drillId);

  const node: BpmnNode | undefined =
    selectedIds.length === 1 ? diagram.nodes[selectedIds[0]] : undefined;
  const ref =
    node && node.type === 'businessRuleTask' && typeof node.properties.decisionRef === 'string'
      ? node.properties.decisionRef
      : undefined;

  // Esc closes the peek but keeps the selection (§11.1): remember which node
  // dismissed it while it STAYS selected — any selection change re-arms, so
  // re-selecting opens again in the same frame (aceite 10.5.1).
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const selectionKey = node && ref ? node.id : null;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setDismissedFor(null);
  }
  const open = Boolean(node && ref) && dismissedFor !== node?.id && drillId === null;
  const close = useCallback(() => setDismissedFor(node?.id ?? null), [node?.id]);
  useDismissal('dmn-peek', open, close);

  const elementRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 8, top: 8 });
  useLayoutEffect(() => {
    if (!open || !node) return;
    const host = elementRef.current?.closest('.bpmnr-designer') as HTMLElement | null;
    const svg = host?.querySelector('svg.bpmnr-canvas');
    if (!host || !svg) return;
    const hostRect = host.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    if (viewport.width <= 0 || viewport.height <= 0) return;
    // viewBox with default xMidYMid meet: uniform scale + centering offsets.
    const scale = Math.min(svgRect.width / viewport.width, svgRect.height / viewport.height);
    const toScreen = (wx: number, wy: number) => ({
      x:
        svgRect.left -
        hostRect.left +
        (svgRect.width - viewport.width * scale) / 2 +
        (wx - viewport.x) * scale,
      y:
        svgRect.top -
        hostRect.top +
        (svgRect.height - viewport.height * scale) / 2 +
        (wy - viewport.y) * scale,
    });
    const right = toScreen(node.x + node.width, node.y);
    let left = right.x + 12;
    if (left + PEEK_WIDTH > hostRect.width) {
      left = toScreen(node.x, node.y).x - 12 - PEEK_WIDTH; // flip to the left
    }
    setPos({ left: Math.max(8, left), top: Math.max(8, right.y) });
  }, [open, node, viewport]);

  if (!open || !node || !ref) return null;

  const fallback = (): DecisionSummary | undefined => {
    const decision = diagram.nodes[ref];
    if (!decision || decision.type !== 'dmn:decision') return undefined;
    return {
      ref,
      label: decision.label,
      semanticVersion: diagram.version.semanticVersion,
      status: diagram.version.status,
      table: decisionTableOf(decision),
    };
  };
  const summary = resolveDecision?.(ref) ?? fallback();

  const table = summary?.table;
  const policyPhrase = table ? HIT_POLICIES[table.hitPolicy] : undefined;
  const policyWord = policyPhrase ? policyPhrase.split(' — ')[0] : undefined;
  const extraRules = table ? Math.max(0, table.rules.length - 2) : 0;

  return (
    <div
      ref={elementRef}
      className="btv-dmn-peek"
      data-decision-peek={ref}
      role="dialog"
      aria-label={`Decisão ${summary?.label ?? ref}`}
      style={{ left: pos.left, top: pos.top, width: PEEK_WIDTH }}
    >
      <header className="btv-dmn-peek-head">
        <strong>{summary?.label ?? ref}</strong>
        {summary?.status && (
          <span className="bpmnr-breadcrumb-seal" data-status={summary.status}>
            {SEAL_LABELS[summary.status]}
          </span>
        )}
        {summary?.semanticVersion && (
          <span className="btv-dmn-peek-semver">v{summary.semanticVersion}</span>
        )}
      </header>
      {table ? (
        <>
          <p className="btv-dmn-peek-summary">
            <span className="btv-dmn-peek-hit" aria-label="Hit policy">
              {table.hitPolicy}
            </span>
            {policyWord} · {table.rules.length}{' '}
            {table.rules.length === 1 ? 'regra' : 'regras'} · {table.inputs.length}→
            {table.outputs.length}
          </p>
          <ol className="btv-dmn-peek-rules">
            {table.rules.slice(0, 2).map((rule) => (
              <li key={rule.id}>
                <span>{rule.inputEntries.join(' · ')}</span>
                <span aria-hidden> → </span>
                <span>{rule.outputEntries.join(' · ')}</span>
              </li>
            ))}
          </ol>
          {extraRules > 0 && <p className="btv-dmn-peek-more">+{extraRules} regras…</p>}
        </>
      ) : (
        <p className="btv-dmn-peek-summary">Decisão sem tabela resolvida neste diagrama.</p>
      )}
      {onOpen && (
        <button type="button" className="btv-dmn-peek-open" onClick={() => onOpen(ref)}>
          editar tabela →
        </button>
      )}
    </div>
  );
}
