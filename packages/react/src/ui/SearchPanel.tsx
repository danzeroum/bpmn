import { useEffect, useMemo, useRef, useState } from 'react';
import { activeEdges, activeNodes, nodeParentId, type BpmnDiagram } from '@buildtovalue/core';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useDismissal } from '../gestures/useDismissal.js';
import { useT } from '../i18n/I18nContext.js';

/**
 * Diagram search (referência item 4): Ctrl/Cmd+F opens a find bar; matches on
 * label, id and type (case-insensitive substring); Enter/Shift+Enter (or the
 * arrows) walk the matches — each hit is selected and centered at the current
 * zoom, drilling into the right sub-process scope when needed. Esc closes via
 * the single dismissal stack.
 */

export interface SearchMatch {
  id: string;
  kind: 'node' | 'edge';
  label: string;
  type: string;
}

export function searchElements(diagram: BpmnDiagram, query: string): SearchMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];
  const matches: SearchMatch[] = [];
  for (const node of activeNodes(diagram)) {
    const label = node.label ?? '';
    if (
      label.toLowerCase().includes(needle) ||
      node.id.toLowerCase().includes(needle) ||
      node.type.toLowerCase().includes(needle)
    ) {
      matches.push({ id: node.id, kind: 'node', label, type: node.type });
    }
  }
  for (const edge of activeEdges(diagram)) {
    const label = edge.label ?? '';
    if (
      (label && label.toLowerCase().includes(needle)) ||
      edge.id.toLowerCase().includes(needle)
    ) {
      matches.push({ id: edge.id, kind: 'edge', label, type: edge.type });
    }
  }
  return matches;
}

export function SearchPanel() {
  const { diagram } = useDiagram();
  const store = useCanvasStore();
  const open = useCanvasState((s) => s.searchOpen);
  const t = useT();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const close = () => store.setState({ searchOpen: false });
  useDismissal('search', open, close);

  const matches = useMemo(() => searchElements(diagram, query), [diagram, query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
  }, [open]);
  useEffect(() => {
    setIndex(0);
    setVisited(false);
  }, [query]);

  if (!open) return null;

  const goTo = (target: number) => {
    if (matches.length === 0) return;
    const wrapped = ((target % matches.length) + matches.length) % matches.length;
    setIndex(wrapped);
    setVisited(true);
    const match = matches[wrapped];
    const state = store.getState();
    if (match.kind === 'node') {
      const node = diagram.nodes[match.id];
      if (!node) return;
      // Land in the right drill scope: the node's parent chain, or top level.
      const scope = nodeParentId(node) ?? null;
      const { viewport } = state;
      store.setState({
        selectedIds: [match.id],
        focusedElementId: match.id,
        ...(state.drillId !== scope ? { drillId: scope } : {}),
        viewport: {
          ...viewport,
          x: node.x + node.width / 2 - viewport.width / 2,
          y: node.y + node.height / 2 - viewport.height / 2,
        },
      });
    } else {
      const edge = diagram.edges[match.id];
      const source = edge ? diagram.nodes[edge.sourceId] : undefined;
      store.setState({
        selectedIds: [match.id],
        ...(source
          ? {
              viewport: {
                ...state.viewport,
                x: source.x - state.viewport.width / 2,
                y: source.y - state.viewport.height / 2,
              },
            }
          : {}),
      });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      // First Enter lands on the current match; the following ones walk.
      if (event.shiftKey) goTo(index - 1);
      else goTo(visited ? index + 1 : index);
    }
    // Esc is handled by the dismissal stack (window listener).
  };

  return (
    <div className="bpmnr-search" role="search" aria-label={t('search.aria')}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={t('search.placeholder')}
        aria-label={t('search.inputAria')}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <span className="bpmnr-search-count" aria-live="polite">
        {query === ''
          ? ''
          : t('search.count', { current: matches.length === 0 ? 0 : index + 1, total: matches.length })}
      </span>
      <button
        type="button"
        onClick={() => goTo(index - 1)}
        disabled={matches.length === 0}
        aria-label={t('search.previous')}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => goTo(index + 1)}
        disabled={matches.length === 0}
        aria-label={t('search.next')}
      >
        ↓
      </button>
      <button type="button" onClick={close} aria-label={t('search.close')}>
        ✕
      </button>
    </div>
  );
}
