import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from 'react';
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
import { useDismissal } from '../gestures/useDismissal.js';
import { panViewportTo, reducedMotion } from '../canvas/viewport.js';
import { I18nProvider, useT } from '../i18n/I18nContext.js';
import type { Messages } from '../i18n/messages.js';
import type { BpmnPlugin } from '../plugins/types.js';
import type { ReviewStore, ReviewThread } from '../review/ReviewStore.js';
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
  /** Host-owned "close diff mode" (Esc reaches it after the popovers). */
  onClose?: () => void;
  /**
   * Host-injected comment store (Handoff 15 §2c). Absent → the review
   * surface (pins, threads, orphan notice) does not exist — declared
   * degradation, cerca §1.5; the diff surface is untouched.
   */
  reviewStore?: ReviewStore;
  /** Author recorded on comments written here (e.g. "ana.ruiz"). */
  author?: string;
  /**
   * Studio embed mode (§2d): the side list becomes the Threads/Mudanças tab
   * pair, the "⚑ Aprovação bloqueada" banner appears while open threads
   * block, and dismissals become available (justified, audited via
   * `onDismissThread`).
   */
  threadsTab?: boolean;
  /**
   * Called AFTER a justified dismissal so the host records the audit entry
   * (`reviewThreadDismissedEntry`) — a dismissal is never silent (§2d).
   */
  onDismissThread?: (thread: ReviewThread, justification: string) => void;
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

export function BpmnDiffViewer({
  base,
  target,
  plugins,
  messages,
  onClose,
  reviewStore,
  author,
  threadsTab,
  onDismissThread,
}: BpmnDiffViewerProps) {
  const body = (
    <EditorConfigProvider plugins={plugins}>
      <DiagramShell
        base={base}
        target={target}
        onClose={onClose}
        reviewStore={reviewStore}
        author={author}
        threadsTab={threadsTab}
        onDismissThread={onDismissThread}
      />
    </EditorConfigProvider>
  );
  // Compose, don't shadow (N-6) — same discipline as BpmnViewer.
  return messages !== undefined ? <I18nProvider messages={messages}>{body}</I18nProvider> : body;
}

function DiagramShell({
  base,
  target,
  onClose,
  reviewStore,
  author,
  threadsTab,
  onDismissThread,
}: Omit<BpmnDiffViewerProps, 'plugins' | 'messages'>) {
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
        <DiffViewerBody
          base={base}
          target={target}
          onClose={onClose}
          reviewStore={reviewStore}
          author={author}
          threadsTab={threadsTab}
          onDismissThread={onDismissThread}
        />
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

const EMPTY_THREADS: readonly ReviewThread[] = [];
const NO_SUBSCRIBE = () => () => {};

interface ThreadPopoverState {
  elementId: string;
  x: number;
  y: number;
}

function DiffViewerBody({
  base,
  target,
  onClose,
  reviewStore,
  author = 'anônimo',
  threadsTab,
  onDismissThread,
}: Omit<BpmnDiffViewerProps, 'plugins' | 'messages'>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const store = useCanvasStore();
  const config = useEditorConfig();
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
  const [threadPopover, setThreadPopover] = useState<ThreadPopoverState | null>(null);
  const [pulse, setPulse] = useState<PulseState | null>(null);

  // §2c — threads read through the injected contract (stable snapshot).
  const subscribeThreads = useCallback(
    (cb: () => void) => reviewStore?.subscribe?.(cb) ?? NO_SUBSCRIBE(),
    [reviewStore],
  );
  const threads = useSyncExternalStore(subscribeThreads, () =>
    reviewStore ? reviewStore.list() : EMPTY_THREADS,
  );
  const threadsByElement = useMemo(() => {
    const map = new Map<string, ReviewThread[]>();
    for (const thread of threads) {
      const bucket = map.get(thread.elementId) ?? [];
      bucket.push(thread);
      map.set(thread.elementId, bucket);
    }
    return map;
  }, [threads]);
  // Orphans (§2c): the anchor left the TARGET diagram — the thread is never
  // dropped; it lists with a warning and stays navigable via the v-base ghost.
  const orphans = useMemo(
    () =>
      threads.filter(
        (thread) => !target.nodes[thread.elementId] && !target.edges[thread.elementId],
      ),
    [threads, target],
  );
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

  // V-5: Esc rides the SINGLE dismissal stack (the debt declared in
  // V-2/V-3/V-4 closes here — standalone AND embedded). Registration order
  // fixes the pop order: diff mode (bottom) → ΔN popover → thread popover
  // (top). One listener pops the top; never independent Esc handlers.
  useDismissal('diff-mode', Boolean(onClose), () => onClose?.());
  useDismissal('diff-popover', popover !== null, () => setPopover(null));
  useDismissal('review-thread', threadPopover !== null, () => setThreadPopover(null));
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F7') {
        event.preventDefault();
        step(event.shiftKey ? -1 : 1);
      }
      if (event.key === 'Escape') {
        const stack = store.getState().dismissals;
        stack[stack.length - 1]?.close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, store]);

  const wrapperPointOf = (event: MouseEvent) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    return { x: event.clientX - (bounds?.left ?? 0), y: event.clientY - (bounds?.top ?? 0) };
  };

  const openThreadPopover = (elementId: string, event: MouseEvent) => {
    setThreadPopover({ elementId, ...wrapperPointOf(event) });
  };

  // §2d — the same "blocking" definition as reviewThreadsRule: open, not
  // dismissed, anchor still in the target. Counters stay consistent with the
  // gate by construction.
  const blockingThreads = useMemo(
    () =>
      threads.filter(
        (thread) =>
          !thread.resolved &&
          !thread.dismissed &&
          (thread.elementId in target.nodes || thread.elementId in target.edges),
      ),
    [threads, target],
  );
  const [sideTab, setSideTab] = useState<'threads' | 'changes'>('changes');

  /** Pan to a thread's anchor (pin, or the v-base ghost for orphans) and
   * open its popover — the Threads tab / banner navigation (§2d). */
  const goToThread = (thread: ReviewThread) => {
    const inTarget = target.nodes[thread.elementId] || target.edges[thread.elementId];
    if (inTarget) {
      const node = target.nodes[thread.elementId];
      const point = node
        ? { x: node.x + node.width / 2, y: node.y + node.height / 2 }
        : (() => {
            const route = edgeRoute(target, target.edges[thread.elementId]);
            return route.length >= 2 ? route[Math.floor(route.length / 2) - 1] : null;
          })();
      if (!point) return;
      const { viewport } = store.getState();
      panViewportTo(store, point.x - viewport.width / 2, point.y - viewport.height / 2, panRaf);
      setPulse(reducedMotion() ? null : { point, token: Date.now() });
      setThreadPopover({ elementId: thread.elementId, x: 24, y: 72 });
    } else {
      goToOrphan(thread);
    }
  };

  const dismissThread = (thread: ReviewThread, justification: string) => {
    if (!reviewStore?.dismiss) return;
    const updated = reviewStore.dismiss(thread.id, author, justification);
    onDismissThread?.(updated, justification);
  };

  const onOpenThread = (elementId: string, text: string, aiAssisted?: boolean) => {
    if (!reviewStore) return;
    const thread = reviewStore.open(elementId, { author, text, ...(aiAssisted ? { aiAssisted } : {}) });
    config.emitEditorEvent('review.thread.opened', { threadId: thread.id, elementId });
  };

  const onResolveThread = (threadId: string) => {
    if (!reviewStore) return;
    reviewStore.resolve(threadId);
    config.emitEditorEvent('review.thread.resolved', { threadId });
  };

  const goToOrphan = (thread: ReviewThread) => {
    // Last known anchor: the v-base geometry (the removed ghost's home).
    const node = base.nodes[thread.elementId];
    const edge = base.edges[thread.elementId];
    const point = node
      ? { x: node.x + node.width / 2, y: node.y + node.height / 2 }
      : edge
        ? (() => {
            const route = edgeRoute(base, edge);
            return route.length >= 2 ? route[Math.floor(route.length / 2) - 1] : null;
          })()
        : null;
    if (!point) return;
    const { viewport } = store.getState();
    panViewportTo(store, point.x - viewport.width / 2, point.y - viewport.height / 2, panRaf);
    setPulse(reducedMotion() ? null : { point, token: Date.now() });
  };

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
            {reviewStore && (
              <ReviewPins
                target={target}
                threadsByElement={threadsByElement}
                onPinClick={openThreadPopover}
                pinAria={(count) => t('review.pin.aria', { count })}
              />
            )}
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
      {/* §2d — approval-gate banner: same blocking definition as the rule. */}
      {threadsTab && reviewStore && blockingThreads.length > 0 && (
        <div className="bpmnr-review-gate" data-testid="review-gate-banner" role="alert">
          {/* i18n-exempt — blocked flag glyph */}
          <strong>⚑ {t('review.gate.blocked')}</strong>{' '}
          {t('review.gate.count', { count: blockingThreads.length })}
          <button
            type="button"
            data-testid="review-gate-goto"
            onClick={() => goToThread(blockingThreads[0])}
          >
            {t('review.gate.goto')}
          </button>
        </div>
      )}
      {/* Side panel: plain change list (V-3), or the Threads/Mudanças tab
          pair in the Studio embed (§2d) — SAME sources, no re-derivation. */}
      <div className="bpmnr-diff-side">
        {threadsTab && reviewStore && (
          <div className="bpmnr-diff-side-tabs" role="tablist" aria-label={t('review.tabs.aria')}>
            <button
              type="button"
              role="tab"
              aria-selected={sideTab === 'threads'}
              data-review-tab="threads"
              onClick={() => setSideTab('threads')}
            >
              {t('review.tabs.threads', { count: threads.length })}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sideTab === 'changes'}
              data-review-tab="changes"
              onClick={() => setSideTab('changes')}
            >
              {t('review.tabs.changes', { count: filtered.length })}
            </button>
          </div>
        )}
        {threadsTab && reviewStore && sideTab === 'threads' ? (
          <ul className="bpmnr-diff-list" data-testid="review-threads-list" role="listbox" aria-label={t('review.tabs.threadsAria')}>
            {threads.map((thread) => {
              const orphaned =
                !target.nodes[thread.elementId] && !target.edges[thread.elementId];
              const state = thread.resolved
                ? 'resolved'
                : thread.dismissed
                  ? 'dismissed'
                  : orphaned
                    ? 'orphan'
                    : 'open';
              const label =
                target.nodes[thread.elementId]?.label ??
                target.edges[thread.elementId]?.label ??
                base.nodes[thread.elementId]?.label ??
                base.edges[thread.elementId]?.label ??
                thread.elementId;
              return (
                <li
                  key={thread.id}
                  role="option"
                  aria-selected={false}
                  data-review-thread-item={thread.id}
                  data-review-thread-state={state}
                >
                  <button type="button" className="bpmnr-diff-list-row" onClick={() => goToThread(thread)}>
                    {/* i18n-exempt — state glyphs */}
                    <span className="bpmnr-diff-list-code" data-kind={state}>
                      {state === 'resolved' ? '✓' : state === 'orphan' ? '⚠' : state === 'dismissed' ? '◌' : '🟡'}
                    </span>
                    <span className="bpmnr-diff-list-label">{label}</span>
                    <span className="bpmnr-diff-list-fields">
                      {state === 'open'
                        ? t('review.threadState.open', { count: thread.messages.length })
                        : state === 'resolved'
                          ? t('review.threadState.resolved')
                          : state === 'dismissed'
                            ? t('review.threadState.dismissed')
                            : t('review.threadState.orphan')}
                    </span>
                  </button>
                  {state === 'open' && reviewStore.dismiss && (
                    <DismissControl
                      onDismiss={(justification) => dismissThread(thread, justification)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
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
        )}
      </div>
      {/* §2c — orphan notice: never silent, never dropped, navigable. */}
      {reviewStore && orphans.length > 0 && (
        <div className="bpmnr-review-orphans" data-testid="review-orphans" role="status">
          {/* i18n-exempt — warning glyph */}
          <span aria-hidden="true">⚠</span> {t('review.orphans.notice', { count: orphans.length })}
          {orphans.map((thread) => (
            <button
              key={thread.id}
              type="button"
              data-review-orphan={thread.id}
              onClick={() => goToOrphan(thread)}
            >
              {base.nodes[thread.elementId]?.label ??
                base.edges[thread.elementId]?.label ??
                thread.elementId}
            </button>
          ))}
        </div>
      )}
      <DiffLegend entries={entries} />
      {popover && <DiffPopover popover={popover} onClose={() => setPopover(null)} />}
      {threadPopover && reviewStore && (
        <ThreadPopover
          state={threadPopover}
          threads={threadsByElement.get(threadPopover.elementId) ?? []}
          elementLabel={
            target.nodes[threadPopover.elementId]?.label ??
            target.edges[threadPopover.elementId]?.label ??
            threadPopover.elementId
          }
          author={author}
          onOpen={(text) => onOpenThread(threadPopover.elementId, text)}
          onReply={(threadId, text) => reviewStore.reply(threadId, { author, text })}
          onResolve={onResolveThread}
          onClose={() => setThreadPopover(null)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------- review pins

/** ✦ mixed-authorship seal (C4 discipline) for AI-assisted messages. */
function isAiAuthored(message: { author: string; aiAssisted?: boolean }): boolean {
  return message.aiAssisted === true || message.author.startsWith('ia.copilot@');
}

function ReviewPins({
  target,
  threadsByElement,
  onPinClick,
  pinAria,
}: {
  target: BpmnDiagram;
  threadsByElement: Map<string, ReviewThread[]>;
  onPinClick: (elementId: string, event: MouseEvent) => void;
  pinAria: (count: number) => string;
}) {
  return (
    <g data-review-pins pointerEvents="none">
      {/* Comment affordance: double-click an element to open its thread
          popover (composer when empty). Transparent hits BUBBLE pointerdown,
          so pan still works — dblclick is the only capture. */}
      {Object.values(target.nodes).map((node) => (
        <rect
          key={`hit:${node.id}`}
          data-review-hit={node.id}
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          fill="transparent"
          pointerEvents="all"
          onDoubleClick={(event) => onPinClick(node.id, event)}
        />
      ))}
      {[...threadsByElement.entries()].map(([elementId, elementThreads]) => {
        // Anchor by id — the pin reads the CURRENT node geometry, so it
        // follows moves/layout for free (issueBadges pattern).
        const node = target.nodes[elementId];
        if (!node) return null; // orphaned anchors surface in the notice bar
        const open = elementThreads.filter((thread) => !thread.resolved);
        const messageCount = open.reduce((sum, thread) => sum + thread.messages.length, 0);
        const resolvedOnly = open.length === 0;
        const cx = node.x + node.width;
        const cy = node.y;
        return (
          <g
            key={elementId}
            className="bpmnr-review-pin"
            data-review-pin={elementId}
            data-review-pin-state={resolvedOnly ? 'resolved' : 'open'}
            role="button"
            aria-label={pinAria(messageCount)}
            pointerEvents="all"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onPinClick(elementId, event);
            }}
          >
            {/* Generous invisible hit — ≥44px on coarse via CSS scale. */}
            <circle className="bpmnr-review-pin-hit" cx={cx} cy={cy} r={22} />
            <circle
              className={
                resolvedOnly ? 'bpmnr-review-pin-face-resolved' : 'bpmnr-review-pin-face'
              }
              cx={cx}
              cy={cy}
              r={11}
            />
            <text className="bpmnr-review-pin-text" x={cx} y={cy + 4}>
              {/* i18n-exempt — glyph+número, nunca só cor */}
              {resolvedOnly ? '✓' : `💬${messageCount}`}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ThreadPopover({
  state,
  threads,
  elementLabel,
  author,
  onOpen,
  onReply,
  onResolve,
  onClose,
}: {
  state: ThreadPopoverState;
  threads: ReviewThread[];
  elementLabel: string;
  author: string;
  onOpen: (text: string) => void;
  onReply: (threadId: string, text: string) => void;
  onResolve: (threadId: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const submit = () => {
    const text = draft.trim();
    if (text === '') return;
    if (threads.length === 0) onOpen(text);
    else onReply(threads[threads.length - 1].id, text);
    setDraft('');
  };
  return (
    <div
      className="bpmnr-review-thread"
      data-testid="review-thread"
      role="dialog"
      aria-label={t('review.thread.aria')}
      style={{ left: state.x, top: state.y }}
    >
      <header>
        <strong>{elementLabel}</strong>
        <button type="button" onClick={onClose} aria-label={t('review.thread.close')}>
          ✕
        </button>
      </header>
      {threads.map((thread) => (
        <div key={thread.id} data-review-thread={thread.id} data-resolved={thread.resolved}>
          {thread.messages.map((message) => (
            <p key={message.id} className="bpmnr-review-msg">
              <span className="bpmnr-review-msg-author">
                {isAiAuthored(message) && (
                  <span className="bpmnr-review-msg-ai" data-review-ai aria-hidden="true">
                    {/* i18n-exempt — mixed-authorship seal glyph */}✦{' '}
                  </span>
                )}
                {message.author}
              </span>
              {message.text}
            </p>
          ))}
          {thread.resolved ? (
            <span className="bpmnr-review-resolved" data-testid="review-resolved">
              {/* i18n-exempt — check glyph */}✓ {t('review.thread.resolved')}
            </span>
          ) : (
            <button
              type="button"
              data-review-resolve={thread.id}
              onClick={() => onResolve(thread.id)}
            >
              {/* i18n-exempt — check glyph */}✓ {t('review.thread.resolve')}
            </button>
          )}
        </div>
      ))}
      <div className="bpmnr-review-compose">
        <textarea
          value={draft}
          placeholder={t('review.thread.placeholder')}
          aria-label={t('review.thread.inputAria')}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="button" data-testid="review-send" disabled={draft.trim() === ''} onClick={submit}>
          {threads.length === 0 ? t('review.thread.open') : t('review.thread.reply')}
        </button>
      </div>
      <span className="bpmnr-review-author">{author}</span>
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

/** Justified dismissal control (§2d): never silent — the confirm button only
 * enables at MIN_DISMISS_JUSTIFICATION characters; the host records the
 * ledger entry through `onDismissThread`. */
function DismissControl({ onDismiss }: { onDismiss: (justification: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [justification, setJustification] = useState('');
  if (!open) {
    return (
      <button
        type="button"
        className="bpmnr-review-dismiss-toggle"
        data-review-dismiss-toggle
        onClick={() => setOpen(true)}
      >
        {t('review.dismiss.action')}
      </button>
    );
  }
  const valid = justification.trim().length >= 10;
  return (
    <div className="bpmnr-review-dismiss" data-review-dismiss>
      <textarea
        value={justification}
        placeholder={t('review.dismiss.placeholder')}
        aria-label={t('review.dismiss.inputAria')}
        onChange={(event) => setJustification(event.target.value)}
      />
      <button
        type="button"
        data-review-dismiss-confirm
        disabled={!valid}
        onClick={() => {
          onDismiss(justification.trim());
          setOpen(false);
          setJustification('');
        }}
      >
        {t('review.dismiss.confirm')}
      </button>
    </div>
  );
}
