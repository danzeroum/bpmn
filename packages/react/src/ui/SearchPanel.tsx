import { useEffect, useMemo, useRef, useState } from 'react';
import {
  activeEdges,
  activeNodes,
  laneFlowNodeRefs,
  nodeParentId,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { panViewportTo, reducedMotion } from '../canvas/viewport.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useDismissal } from '../gestures/useDismissal.js';
import { useT } from '../i18n/I18nContext.js';

/**
 * Diagram search (Handoff 14 §1c): Ctrl/Cmd+F opens a find bar with a RESULT
 * LIST (icon + lane + type per row); matches cover label, id, type AND
 * property/reference values (`decisionRef`, `agnt-rsch@…`, engine job types —
 * the differential). Enter/↑↓ walk the matches: each hit is selected, the
 * viewport pans ANIMATED to it and the target plays two halo pulses
 * (`prefers-reduced-motion` → instant pan, zero pulses). Esc closes via the
 * single dismissal stack; selection flows through the normal
 * `selection.changed` path.
 */

export interface SearchMatch {
  id: string;
  kind: 'node' | 'edge';
  label: string;
  type: string;
  matchedIn: 'label' | 'id' | 'type' | 'property';
  /** Property key/value when the hit came from properties/refs. */
  propertyKey?: string;
  propertyValue?: string;
}

/** Property values worth searching: primitives and arrays of primitives. */
function searchableValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return value.join(' ');
  return null;
}

export function searchElements(diagram: BpmnDiagram, query: string): SearchMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];
  const matches: SearchMatch[] = [];

  const scanProperties = (
    properties: Record<string, unknown>,
  ): { key: string; value: string } | null => {
    for (const [key, raw] of Object.entries(properties)) {
      if (key === 'parentId' || key === 'flowNodeRefs') continue; // structural, not content
      const value = searchableValue(raw);
      if (value === null) continue;
      if (key.toLowerCase().includes(needle) || value.toLowerCase().includes(needle)) {
        return { key, value };
      }
    }
    return null;
  };

  for (const node of activeNodes(diagram)) {
    const label = node.label ?? '';
    if (label.toLowerCase().includes(needle)) {
      matches.push({ id: node.id, kind: 'node', label, type: node.type, matchedIn: 'label' });
      continue;
    }
    if (node.id.toLowerCase().includes(needle)) {
      matches.push({ id: node.id, kind: 'node', label, type: node.type, matchedIn: 'id' });
      continue;
    }
    if (node.type.toLowerCase().includes(needle)) {
      matches.push({ id: node.id, kind: 'node', label, type: node.type, matchedIn: 'type' });
      continue;
    }
    const property = scanProperties(node.properties);
    if (property) {
      matches.push({
        id: node.id,
        kind: 'node',
        label,
        type: node.type,
        matchedIn: 'property',
        propertyKey: property.key,
        propertyValue: property.value,
      });
    }
  }
  for (const edge of activeEdges(diagram)) {
    const label = edge.label ?? '';
    if (label && label.toLowerCase().includes(needle)) {
      matches.push({ id: edge.id, kind: 'edge', label, type: edge.type, matchedIn: 'label' });
      continue;
    }
    if (edge.id.toLowerCase().includes(needle)) {
      matches.push({ id: edge.id, kind: 'edge', label, type: edge.type, matchedIn: 'id' });
      continue;
    }
    const property = scanProperties(edge.properties);
    if (property) {
      matches.push({
        id: edge.id,
        kind: 'edge',
        label,
        type: edge.type,
        matchedIn: 'property',
        propertyKey: property.key,
        propertyValue: property.value,
      });
    }
  }
  return matches;
}

/** Label of the lane whose flowNodeRefs contain the element, if any. */
export function laneLabelOf(diagram: BpmnDiagram, elementId: string): string | null {
  for (const node of activeNodes(diagram)) {
    if (node.type !== 'lane') continue;
    if (laneFlowNodeRefs(node).includes(elementId)) return node.label || node.id;
  }
  return null;
}

const CATEGORY_GLYPH: Record<string, string> = {
  activity: '☰',
  gateway: '◇',
  event: '◉',
  container: '▭',
  artifact: '▤',
};

export function SearchPanel() {
  const { diagram } = useDiagram();
  const store = useCanvasStore();
  const config = useEditorConfig();
  const open = useCanvasState((s) => s.searchOpen);
  const t = useT();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panRaf = useRef<number | null>(null);

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
      store.setState({
        selectedIds: [match.id],
        focusedElementId: match.id,
        ...(state.drillId !== scope ? { drillId: scope } : {}),
        // 2 halo pulses on the target (0 under reduced motion). The token
        // makes consecutive hits on the same node re-trigger the animation.
        searchPulse: reducedMotion() ? null : { elementId: match.id, token: Date.now() },
      });
      const { viewport } = store.getState();
      panViewportTo(
        store,
        node.x + node.width / 2 - viewport.width / 2,
        node.y + node.height / 2 - viewport.height / 2,
        panRaf,
      );
    } else {
      const edge = diagram.edges[match.id];
      const source = edge ? diagram.nodes[edge.sourceId] : undefined;
      store.setState({ selectedIds: [match.id] });
      if (source) {
        const { viewport } = store.getState();
        panViewportTo(
          store,
          source.x - viewport.width / 2,
          source.y - viewport.height / 2,
          panRaf,
        );
      }
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) goTo(index - 1);
      else goTo(visited ? index + 1 : index);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      goTo(visited ? index + 1 : index);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      goTo(index - 1);
    }
    // Esc is handled by the dismissal stack (window listener).
  };

  const glyphFor = (match: SearchMatch): string => {
    if (match.matchedIn === 'property') return '▤';
    if (match.kind === 'edge') return '→';
    const category = config.registry.has(match.type)
      ? config.registry.get(match.type).category
      : 'artifact';
    return CATEGORY_GLYPH[category] ?? '▤';
  };

  const visible = matches.slice(0, 8);

  return (
    <div className="bpmnr-search" role="search" aria-label={t('search.aria')}>
      <div className="bpmnr-search-bar">
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
            : t('search.count', {
                current: matches.length === 0 ? 0 : index + 1,
                total: matches.length,
              })}
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
          onClick={() => goTo(visited ? index + 1 : index)}
          disabled={matches.length === 0}
          aria-label={t('search.next')}
        >
          ↓
        </button>
        <button type="button" onClick={close} aria-label={t('search.close')}>
          ✕
        </button>
      </div>
      {visible.length > 0 && (
        <ul className="bpmnr-search-results" role="listbox" aria-label={t('search.resultsAria')}>
          {visible.map((match, i) => {
            const lane = laneLabelOf(diagram, match.id);
            return (
              <li
                key={`${match.kind}:${match.id}:${match.matchedIn}`}
                role="option"
                aria-selected={i === index}
                data-search-result={match.id}
                data-search-matched-in={match.matchedIn}
                className={i === index ? 'bpmnr-search-row-active' : undefined}
                onClick={() => goTo(i)}
              >
                {/* i18n-exempt — categorical glyph, not prose */}
                <span className="bpmnr-search-glyph">{glyphFor(match)}</span>
                <span className="bpmnr-search-label">
                  {match.matchedIn === 'property'
                    ? `${match.propertyKey}: ${truncate(match.propertyValue ?? '', 28)}`
                    : match.label || match.id}
                </span>
                <span
                  className="bpmnr-search-meta"
                  data-search-meta={match.matchedIn === 'property' ? 'property' : 'element'}
                >
                  {match.matchedIn === 'property'
                    ? t('search.propertyTag')
                    : `${match.type}${lane ? ` · ${lane}` : ''}`}
                </span>
              </li>
            );
          })}
          {matches.length > visible.length && (
            <li className="bpmnr-search-overflow" aria-hidden="true">
              +{matches.length - visible.length}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
