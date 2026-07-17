import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  diffDiagrams,
  type BpmnDiagram,
  type BpmnEdge,
  type BpmnNode,
  type DiffEntry,
  type Point,
} from '@buildtovalue/core';
import { BpmnViewer } from './BpmnViewer.js';
import type { DiffPaintKind } from './ViewerCanvas.js';
import { I18nProvider, useT } from '../i18n/I18nContext.js';
import type { Messages } from '../i18n/messages.js';
import type { BpmnPlugin } from '../plugins/types.js';

/**
 * Review diff surface (Handoff 15 §2a, V-2): the TARGET diagram rendered on
 * the read-only viewer (N-7) with the semantic diff painted over it.
 * Binding semantics from the spec mock:
 * - unchanged elements dim to 45% (never hidden — `data-diff-state` + CSS);
 * - removed = dashed ghost AT THE BASE POSITION (−REM);
 * - moved = dashed ghost at the origin + arrow to the destination (→MOV);
 * - changed = dashed halo + clickable ΔN badge → popover with the property
 *   changes before → after;
 * - added = halo + tag on the new element (+ADD);
 * - rerouted paints the ROUTE, never the nodes, and never counts as Δ.
 * Colors come from the EXISTING tokens per the V-0 decision (added
 * `--btv-green`, removed `--btv-error`, moved `--btv-gold`, changed
 * `--btv-ink`), always with glyph + text — never color alone. The whole
 * overlay lives under `[data-diff-overlay]` and the paint under
 * `data-diff-state` — both stripped from exports (TRANSIENT_*).
 *
 * READ-ONLY by construction (cerca §1.1): the substrate is the viewer — no
 * command stack, no gestures, no keyboard editing exists in this tree; the
 * binding test proves no mutation is reachable. Nothing here ever touches the
 * diagram objects (cerca §1.2 — XML round-trip stays byte-identical).
 */
export interface BpmnDiffViewerProps {
  /** The v-base (e.g. the currently ACTIVE version). */
  base: BpmnDiagram;
  /** The v-target being reviewed (e.g. the CANDIDATE). Rendered diagram. */
  target: BpmnDiagram;
  plugins?: BpmnPlugin[];
  messages?: Messages;
}

interface PopoverState {
  entry: DiffEntry;
  /** Wrapper-relative position for the HTML popover. */
  x: number;
  y: number;
}

export function BpmnDiffViewer({ base, target, plugins, messages }: BpmnDiffViewerProps) {
  const body = <DiffViewerBody base={base} target={target} plugins={plugins} />;
  // Compose, don't shadow (N-6) — same discipline as BpmnViewer.
  return messages !== undefined ? <I18nProvider messages={messages}>{body}</I18nProvider> : body;
}

function DiffViewerBody({ base, target, plugins }: Omit<BpmnDiffViewerProps, 'messages'>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const entries = useMemo(() => diffDiagrams(base, target), [base, target]);
  const diffStates = useMemo(() => {
    const map: Record<string, DiffPaintKind> = {};
    for (const entry of entries) {
      if (entry.kind !== 'removed') map[entry.elementId] = entry.kind;
    }
    return map;
  }, [entries]);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  // The popover is this standalone surface's ONLY dismissable: one Esc
  // handler, active only while it is open. (§11.1's single stack is an editor
  // invariant — the Studio embedding, V-5, joins the editor stack there.
  // Decision registered in the V-2 report.)
  useEffect(() => {
    if (!popover) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPopover(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [popover]);

  const openPopover = (entry: DiffEntry, event: MouseEvent) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    setPopover({
      entry,
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
    });
  };

  return (
    <div
      ref={wrapperRef}
      className="bpmnr-diff-viewer"
      data-testid="diff-viewer"
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <BpmnViewer
        diagram={target}
        plugins={plugins}
        diffStates={diffStates}
        overlay={<DiffGhosts base={base} target={target} entries={entries} onBadgeClick={openPopover} />}
      />
      <DiffLegend entries={entries} />
      {popover && <DiffPopover popover={popover} onClose={() => setPopover(null)} />}
    </div>
  );
}

// ------------------------------------------------------------- SVG overlay

function nodeCenterOf(node: BpmnNode | undefined, at?: Point): Point | null {
  if (!node) return null;
  const x = at?.x ?? node.x;
  const y = at?.y ?? node.y;
  return { x: x + node.width / 2, y: y + node.height / 2 };
}

function edgeRoute(diagram: BpmnDiagram, edge: BpmnEdge | undefined): Point[] {
  if (!edge) return [];
  if (edge.waypoints && edge.waypoints.length >= 2) return edge.waypoints;
  const source = nodeCenterOf(diagram.nodes[edge.sourceId]);
  const targetPoint = nodeCenterOf(diagram.nodes[edge.targetId]);
  return source && targetPoint ? [source, targetPoint] : [];
}

const polyline = (points: Point[]) => points.map((p) => `${p.x},${p.y}`).join(' ');

function DiffGhosts({
  base,
  target,
  entries,
  onBadgeClick,
}: {
  base: BpmnDiagram;
  target: BpmnDiagram;
  entries: DiffEntry[];
  onBadgeClick: (entry: DiffEntry, event: MouseEvent) => void;
}) {
  const t = useT();
  return (
    <g data-diff-overlay pointerEvents="none">
      {entries.map((entry) => {
        const key = `${entry.elementKind}:${entry.elementId}`;
        if (entry.elementKind === 'node') {
          const baseNode = base.nodes[entry.elementId];
          const targetNode = target.nodes[entry.elementId];
          if (entry.kind === 'removed' && baseNode) {
            return <RemovedNodeGhost key={key} node={baseNode} at={entry.from} />;
          }
          if (entry.kind === 'moved' && targetNode && entry.from && entry.to) {
            return <MovedNodeGhost key={key} node={targetNode} from={entry.from} to={entry.to} />;
          }
          if (entry.kind === 'added' && targetNode) {
            return <AddedNodeHalo key={key} node={targetNode} />;
          }
          if (entry.kind === 'changed' && targetNode) {
            return (
              <ChangedNodeHalo
                key={key}
                node={targetNode}
                entry={entry}
                badgeAria={t('review.badge.aria', {
                  count: Object.keys(entry.changes ?? {}).length,
                })}
                onBadgeClick={onBadgeClick}
              />
            );
          }
          return null;
        }
        // Edges: paint the ROUTE (never the endpoints).
        if (entry.kind === 'removed') {
          const route = edgeRoute(base, base.edges[entry.elementId]);
          if (route.length < 2) return null;
          return (
            <g key={key} data-diff-ghost="removed-edge">
              <polyline className="bpmnr-diff-edge-removed" points={polyline(route)} />
              <DiffTag point={route[Math.floor(route.length / 2) - 1]} kind="removed" />
            </g>
          );
        }
        if (entry.kind === 'added') {
          const route = edgeRoute(target, target.edges[entry.elementId]);
          if (route.length < 2) return null;
          return (
            <g key={key} data-diff-ghost="added-edge">
              <polyline className="bpmnr-diff-edge-added" points={polyline(route)} />
              <DiffTag point={route[Math.floor(route.length / 2) - 1]} kind="added" />
            </g>
          );
        }
        if (entry.kind === 'rerouted') {
          const route = edgeRoute(target, target.edges[entry.elementId]);
          if (route.length < 2) return null;
          return (
            <g key={key} data-diff-ghost="rerouted-edge">
              <polyline className="bpmnr-diff-edge-rerouted" points={polyline(route)} />
              <DiffTag point={route[Math.floor(route.length / 2) - 1]} kind="rerouted" />
            </g>
          );
        }
        return null; // changed edges (label/supersede) surface via the list (V-3)
      })}
    </g>
  );
}

/** Spec glyph+text codes (§1.3 — never color alone). i18n-exempt: notation
 * codes from the mock, not prose. */
const TAG_TEXT: Record<string, string> = {
  added: '+ADD',
  removed: '−REM',
  moved: '→MOV',
  rerouted: '↷ROTA',
};

function DiffTag({ point, kind, dx = 0, dy = -8 }: { point: Point; kind: string; dx?: number; dy?: number }) {
  return (
    <text className="bpmnr-diff-tag" data-diff-tag={kind} x={point.x + dx} y={point.y + dy}>
      {TAG_TEXT[kind]}
    </text>
  );
}

function RemovedNodeGhost({ node, at }: { node: BpmnNode; at?: Point }) {
  const x = at?.x ?? node.x;
  const y = at?.y ?? node.y;
  return (
    <g data-diff-ghost="removed" transform={`translate(${x}, ${y})`}>
      <rect className="bpmnr-diff-ghost-removed" width={node.width} height={node.height} rx={8} />
      <text className="bpmnr-diff-ghost-label" x={node.width / 2} y={node.height / 2 + 4}>
        {node.label}
      </text>
      <DiffTag point={{ x: 0, y: 0 }} kind="removed" dx={0} dy={-6} />
    </g>
  );
}

function MovedNodeGhost({ node, from, to }: { node: BpmnNode; from: Point; to: Point }) {
  const start = { x: from.x + node.width / 2, y: from.y + node.height / 2 };
  const end = { x: to.x + node.width / 2, y: to.y + node.height / 2 };
  // Short manual arrowhead so the marker keeps the gold stroke.
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = 9;
  const tip = end;
  const left = {
    x: tip.x - head * Math.cos(angle - Math.PI / 6),
    y: tip.y - head * Math.sin(angle - Math.PI / 6),
  };
  const right = {
    x: tip.x - head * Math.cos(angle + Math.PI / 6),
    y: tip.y - head * Math.sin(angle + Math.PI / 6),
  };
  return (
    <g data-diff-ghost="moved">
      <rect
        className="bpmnr-diff-ghost-moved"
        x={from.x}
        y={from.y}
        width={node.width}
        height={node.height}
        rx={8}
      />
      <line className="bpmnr-diff-move-arrow" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
      <polygon
        className="bpmnr-diff-move-head"
        points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`}
      />
      <DiffTag point={{ x: from.x, y: from.y }} kind="moved" dx={0} dy={-6} />
    </g>
  );
}

function AddedNodeHalo({ node }: { node: BpmnNode }) {
  return (
    <g data-diff-ghost="added" transform={`translate(${node.x}, ${node.y})`}>
      <rect
        className="bpmnr-diff-halo-added"
        x={-5}
        y={-5}
        width={node.width + 10}
        height={node.height + 10}
        rx={10}
      />
      <DiffTag point={{ x: 0, y: 0 }} kind="added" dx={0} dy={-6} />
    </g>
  );
}

function ChangedNodeHalo({
  node,
  entry,
  badgeAria,
  onBadgeClick,
}: {
  node: BpmnNode;
  entry: DiffEntry;
  badgeAria: string;
  onBadgeClick: (entry: DiffEntry, event: MouseEvent) => void;
}) {
  const deltaCount = Object.keys(entry.changes ?? {}).length;
  return (
    <g data-diff-ghost="changed" transform={`translate(${node.x}, ${node.y})`}>
      <rect
        className="bpmnr-diff-halo-changed"
        x={-5}
        y={-5}
        width={node.width + 10}
        height={node.height + 10}
        rx={10}
      />
      {entry.moved && entry.from && entry.to && (
        <g transform={`translate(${entry.from.x - node.x}, ${entry.from.y - node.y})`}>
          <rect className="bpmnr-diff-ghost-moved" width={node.width} height={node.height} rx={8} />
        </g>
      )}
      {/* ΔN badge — clickable (popover), generous invisible hit area. */}
      <g
        className="bpmnr-diff-badge"
        data-diff-badge={entry.elementId}
        role="button"
        aria-label={badgeAria}
        pointerEvents="all"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onBadgeClick(entry, event);
        }}
      >
        <circle className="bpmnr-diff-badge-hit" cx={node.width + 5} cy={-5} r={16} />
        <circle className="bpmnr-diff-badge-face" cx={node.width + 5} cy={-5} r={11} />
        <text className="bpmnr-diff-badge-text" x={node.width + 5} y={-1}>
          {/* i18n-exempt — Δ notation code */}Δ{deltaCount}
        </text>
      </g>
    </g>
  );
}

// ------------------------------------------------------------- HTML chrome

function DiffLegend({ entries }: { entries: DiffEntry[] }) {
  const t = useT();
  const count = (kind: DiffEntry['kind']) => entries.filter((e) => e.kind === kind).length;
  const rerouted = count('rerouted');
  return (
    <div className="bpmnr-diff-legend" data-testid="diff-legend" role="status">
      {/* i18n-exempt — the +/−/→/Δ/↷ glyphs are notation, labels are t() */}
      <span data-legend="added">+{count('added')} {t('review.legend.added')}</span>
      <span data-legend="removed">−{count('removed')} {t('review.legend.removed')}</span>
      <span data-legend="moved">→{count('moved')} {t('review.legend.moved')}</span>
      <span data-legend="changed">Δ{count('changed')} {t('review.legend.changed')}</span>
      {rerouted > 0 && (
        <span data-legend="rerouted">↷{rerouted} {t('review.legend.rerouted')}</span>
      )}
      <strong data-legend="total">{t('review.legend.total', { count: entries.length })}</strong>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function DiffPopover({ popover, onClose }: { popover: PopoverState; onClose: () => void }) {
  const t = useT();
  const { entry } = popover;
  return (
    <div
      className="bpmnr-diff-popover"
      data-testid="diff-popover"
      role="dialog"
      aria-label={t('review.popover.aria')}
      style={{ left: popover.x, top: popover.y }}
    >
      <header>
        <strong>{entry.label ?? entry.elementId}</strong>
        <button type="button" onClick={onClose} aria-label={t('review.popover.close')}>
          ✕
        </button>
      </header>
      <dl>
        {Object.entries(entry.changes ?? {}).map(([field, change]) => (
          <div key={field} data-diff-field={field}>
            <dt>{field}</dt>
            <dd>
              <span className="bpmnr-diff-popover-from">{formatValue(change.from)}</span>
              {/* i18n-exempt — arrow glyph */}
              <span aria-hidden="true"> → </span>
              <span className="bpmnr-diff-popover-to">{formatValue(change.to)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
