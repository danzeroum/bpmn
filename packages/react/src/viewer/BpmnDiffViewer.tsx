import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  diffDiagrams,
  type BpmnDiagram,
  type BpmnEdge,
  type BpmnNode,
  type DiffEntry,
  type DiffKind,
  type Point,
} from '@buildtovalue/core';
import { EditorConfigProvider, useEditorConfig } from '../contexts/EditorConfigContext.js';
import { DiagramProvider } from '../contexts/DiagramContext.js';
import { CanvasProvider, useCanvasStore } from '../contexts/CanvasContext.js';
import { panViewportTo, reducedMotion } from '../canvas/viewport.js';
import { I18nProvider, useT } from '../i18n/I18nContext.js';
import type { Messages } from '../i18n/messages.js';
import type { BpmnPlugin } from '../plugins/types.js';
import { ViewerCanvas, type DiffPaintKind } from './ViewerCanvas.js';

/**
 * Review diff surface (Handoff 15 §2a + §2b, V-2/V-3): the TARGET diagram on
 * the read-only viewer (N-7) with the semantic diff painted over it and the
 * change-by-change navigation bar on top.
 *
 * §2a binding semantics (V-2): unchanged dims to 45% (never hidden); removed
 * = dashed ghost AT the v-base position (−REM); moved = ghost at the origin +
 * arrow (→MOV); added = halo (+ADD); changed = dashed halo + clickable ΔN
 * badge → before→after popover; rerouted paints the ROUTE (↷ROTA), never the
 * nodes, never Δ. Tokens per the V-0 decision; glyph+text always.
 *
 * §2b navigation (V-3): the bar consumes the SAME topologically-ordered list
 * `diffDiagrams` returns — the UI NEVER reorders. F7/Shift+F7 (and ←/→) walk
 * with wrap, each step pans with the U-4 `panViewportTo` and plays two halo
 * pulses (reduced-motion → instant pan, zero pulses). Category chips filter
 * (combinable, counts per kind); filtering recomputes M and repositions N
 * without losing the current item when it survives. The synced side list
 * navigates on click. Removed entries are navigable — the pan goes to the
 * GHOST at the v-base position.
 *
 * Esc (V-2 decision, standalone surface): one local handler — popover first,
 * then `onClose` when the host provided it. The Studio embed (V-5) joins the
 * editor's single dismissal stack instead.
 *
 * READ-ONLY by construction (cerca §1.1); nothing here touches the diagram
 * objects (§1.2). Every SVG artifact of the surface lives under
 * `[data-diff-overlay]` / `data-diff-state` (TRANSIENT_*) — exports stay
 * clean mid-diff and mid-navigation; the bar/list/legend are HTML outside
 * the SVG and can never leak into an export by construction.
 */
export interface BpmnDiffViewerProps {
  /** The v-base (e.g. the currently ACTIVE version). */
  base: BpmnDiagram;
  /** The v-target being reviewed (e.g. the CANDIDATE). Rendered diagram. */
  target: BpmnDiagram;
  plugins?: BpmnPlugin[];
  messages?: Messages;
  /** Host-owned "close diff mode" (Esc reaches it after the popover). */
  onClose?: () => void;
}

interface PopoverState {
  entry: DiffEntry;
  x: number;
  y: number;
}

interface PulseState {
  point: Point;
  token: number;
}

export function BpmnDiffViewer({ base, target, plugins, messages, onClose }: BpmnDiffViewerProps) {
  const body = (
    <EditorConfigProvider plugins={plugins}>
      <DiagramShell base={base} target={target} onClose={onClose} />
    </EditorConfigProvider>
  );
  // Compose, don't shadow (N-6) — same discipline as BpmnViewer.
  return messages !== undefined ? <I18nProvider messages={messages}>{body}</I18nProvider> : body;
}

function DiagramShell({ base, target, onClose }: Omit<BpmnDiffViewerProps, 'plugins' | 'messages'>) {
  const config = useEditorConfig();
  return (
    <DiagramProvider
      diagram={target}
      ruleEngine={config.ruleEngine}
      edgeRouter={config.edgeRouter}
      emitEditorEvent={config.emitEditorEvent}
    >
      {/* Read-only from birth — no gesture can mutate the diagram (N-7). */}
      <CanvasProvider initial={{ readOnly: true }}>
        <DiffViewerBody base={base} target={target} onClose={onClose} />
      </CanvasProvider>
    </DiagramProvider>
  );
}

/** World-space focus point of an entry — removed entries aim at the GHOST. */
function focusPointOf(entry: DiffEntry, base: BpmnDiagram, target: BpmnDiagram): Point | null {
  if (entry.elementKind === 'node') {
    const node = entry.kind === 'removed' ? base.nodes[entry.elementId] : target.nodes[entry.elementId];
    if (!node) return null;
    const at = entry.kind === 'removed' ? (entry.from ?? node) : node;
    return { x: at.x + node.width / 2, y: at.y + node.height / 2 };
  }
  const diagram = entry.kind === 'removed' ? base : target;
  const route = edgeRoute(diagram, diagram.edges[entry.elementId]);
  if (route.length < 2) return null;
  const mid = route[Math.floor(route.length / 2) - 1];
  const next = route[Math.floor(route.length / 2)];
  return { x: (mid.x + next.x) / 2, y: (mid.y + next.y) / 2 };
}

const ALL_KINDS: DiffKind[] = ['added', 'removed', 'moved', 'changed', 'rerouted'];

function DiffViewerBody({ base, target, onClose }: Omit<BpmnDiffViewerProps, 'plugins' | 'messages'>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const store = useCanvasStore();
  const t = useT();
  const panRaf = useRef<number | null>(null);
  const entries = useMemo(() => diffDiagrams(base, target), [base, target]);
  const diffStates = useMemo(() => {
    const map: Record<string, DiffPaintKind> = {};
    for (const entry of entries) {
      if (entry.kind !== 'removed') map[entry.elementId] = entry.kind;
    }
    return map;
  }, [entries]);

  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [pulse, setPulse] = useState<PulseState | null>(null);
  // Combinable category filters — empty set = show everything (§2b).
  const [filters, setFilters] = useState<ReadonlySet<DiffKind>>(new Set());
  // Active position INSIDE the filtered list, plus a visited flag so the
  // first step lands on the current item (same discipline as the U-4 search).
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState(false);

  // The V-1 order IS the navigation order — filtering only subsets it.
  const filtered = useMemo(
    () => (filters.size === 0 ? entries : entries.filter((e) => filters.has(e.kind))),
    [entries, filters],
  );

  const goTo = useCallback(
    (position: number) => {
      if (filtered.length === 0) return;
      const wrapped = ((position % filtered.length) + filtered.length) % filtered.length;
      setIndex(wrapped);
      setVisited(true);
      const entry = filtered[wrapped];
      const point = focusPointOf(entry, base, target);
      if (!point) return;
      const { viewport } = store.getState();
      panViewportTo(store, point.x - viewport.width / 2, point.y - viewport.height / 2, panRaf);
      // Two halo pulses at the focus point (U-4 pattern); zero under
      // reduced motion — the pan above is already instant there.
      setPulse(reducedMotion() ? null : { point, token: Date.now() });
    },
    [filtered, base, target, store],
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      if (direction === 1) goTo(visited ? index + 1 : index);
      else goTo(index - 1);
    },
    [goTo, visited, index],
  );

  // Toggling a chip recomputes M and repositions N: the current item keeps
  // its place when it survives the filter; otherwise navigation restarts.
  const toggleFilter = (kind: DiffKind) => {
    const current = filtered[index];
    const next = new Set(filters);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    setFilters(next);
    const list = next.size === 0 ? entries : entries.filter((e) => next.has(e.kind));
    const survivor = current
      ? list.findIndex(
          (e) => e.elementId === current.elementId && e.elementKind === current.elementKind,
        )
      : -1;
    setIndex(survivor >= 0 ? survivor : 0);
    if (survivor < 0) setVisited(false);
  };

  // Standalone-surface keyboard (V-2 decision): F7 / Shift+F7 navigate; Esc
  // closes the popover first, then hands off to the host's onClose.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F7') {
        event.preventDefault();
        step(event.shiftKey ? -1 : 1);
      }
      if (event.key === 'Escape') {
        setPopover((open) => {
          if (open) return null;
          onClose?.();
          return open;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, onClose]);

  const openPopover = (entry: DiffEntry, event: MouseEvent) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    setPopover({
      entry,
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
    });
  };

  const countOf = (kind: DiffKind) => entries.filter((e) => e.kind === kind).length;

  return (
    <div
      ref={wrapperRef}
      className="bpmnr-diff-viewer"
      data-testid="diff-viewer"
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <ViewerCanvas
        diffStates={diffStates}
        overlay={
          <>
            <DiffGhosts base={base} target={target} entries={entries} onBadgeClick={openPopover} />
            {pulse && (
              <g data-diff-overlay pointerEvents="none" key={pulse.token}>
                <circle
                  className="bpmnr-search-pulse"
                  cx={pulse.point.x}
                  cy={pulse.point.y}
                  r={40}
                />
                <circle
                  className="bpmnr-search-pulse bpmnr-search-pulse-late"
                  cx={pulse.point.x}
                  cy={pulse.point.y}
                  r={40}
                  onAnimationEnd={() => setPulse((p) => (p?.token === pulse.token ? null : p))}
                />
              </g>
            )}
          </>
        }
      />
      {/* §2b — navigation bar. Sequence = the V-1 list, subset by chips. */}
      <div className="bpmnr-diff-nav" data-testid="diff-nav" role="navigation" aria-label={t('review.nav.aria')}>
        <span className="bpmnr-diff-nav-title">
          {/* i18n-exempt — DIFF is a notation code */}
          DIFF {base.version.semanticVersion} → {target.version.semanticVersion}
        </span>
        <span className="bpmnr-diff-nav-counter" data-testid="diff-nav-counter" aria-live="polite">
          {t('review.nav.counter', {
            current: filtered.length === 0 ? 0 : index + 1,
            total: filtered.length,
          })}
        </span>
        <button type="button" onClick={() => step(-1)} disabled={filtered.length === 0} aria-label={t('review.nav.previous')}>
          ←
        </button>
        <button type="button" onClick={() => step(1)} disabled={filtered.length === 0} aria-label={t('review.nav.next')}>
          →
        </button>
        <span className="bpmnr-diff-nav-keys">{/* i18n-exempt — key names */}F7 / Shift+F7</span>
        <span className="bpmnr-diff-nav-chips" role="group" aria-label={t('review.nav.filtersAria')}>
          {ALL_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              data-diff-chip={kind}
              aria-pressed={filters.has(kind)}
              onClick={() => toggleFilter(kind)}
            >
              {/* i18n-exempt — category glyphs */}
              {{ added: '+', removed: '−', moved: '→', changed: 'Δ', rerouted: '↷' }[kind]}
              {countOf(kind)} {t(`review.legend.${kind}`)}
            </button>
          ))}
        </span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={t('review.nav.close')}>
            ✕
          </button>
        )}
      </div>
      {/* §2b — synced change list: click navigates, active follows. */}
      <ul className="bpmnr-diff-list" data-testid="diff-list" role="listbox" aria-label={t('review.list.aria')}>
        {filtered.map((entry, i) => (
          <li
            key={`${entry.elementKind}:${entry.elementId}`}
            role="option"
            aria-selected={visited && i === index}
            data-diff-item={entry.elementId}
            data-diff-item-kind={entry.kind}
            className={visited && i === index ? 'bpmnr-diff-list-active' : undefined}
            onClick={() => goTo(i)}
          >
            {/* i18n-exempt — notation codes */}
            <span className="bpmnr-diff-list-code" data-kind={entry.kind}>
              {TAG_TEXT[entry.kind] ?? `Δ${Object.keys(entry.changes ?? {}).length}`}
            </span>
            <span className="bpmnr-diff-list-label">{entry.label ?? entry.elementId}</span>
            {entry.changes && (
              <span className="bpmnr-diff-list-fields">{Object.keys(entry.changes).join(' · ')}</span>
            )}
          </li>
        ))}
      </ul>
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
        return null; // changed edges (label/supersede) surface via the list
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
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = 9;
  const left = {
    x: end.x - head * Math.cos(angle - Math.PI / 6),
    y: end.y - head * Math.sin(angle - Math.PI / 6),
  };
  const right = {
    x: end.x - head * Math.cos(angle + Math.PI / 6),
    y: end.y - head * Math.sin(angle + Math.PI / 6),
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
        points={`${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`}
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
