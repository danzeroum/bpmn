import { useEffect, useMemo, useRef, useState } from 'react';
import { rectCenter } from '@buildtovalue/core';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useDismissal } from '../gestures/useDismissal.js';
import { useT } from '../i18n/I18nContext.js';
import {
  builtinMenuItems,
  pluginMenuItems,
  pluginPadItems,
  type RegisteredMenuItem,
} from '../commands/menuRegistry.js';
import { builtinGlobalCommands, type RegisteredGlobalCommand } from '../commands/globalCommands.js';
import type { MenuTarget } from '../plugins/types.js';

/**
 * Ctrl/Cmd+K command palette (Handoff 15 §2f). The palette has NO list of its
 * own — every row comes from the registries that already exist: the extracted
 * `builtinMenuItems` (equivalence-tested against the ContextMenu), the plugin
 * `contextMenuItems`/`contextPadItems` contracts (respecting `when()` against
 * the REAL selection context) and `builtinGlobalCommands` (toolbar-level
 * actions). Anti-drift by construction: `paletteEntries` below is exported and
 * the sweep test asserts the rendered rows equal the aggregate of the sources
 * — in both directions. Execution is ALWAYS via `run()` → `execute` commands.
 */
export function paletteEntries(
  target: MenuTarget,
  ctx: Parameters<typeof builtinGlobalCommands>[0],
): RegisteredGlobalCommand[] {
  const seen = new Set<string>();
  const rows: RegisteredGlobalCommand[] = [];
  const push = (items: RegisteredMenuItem[]) => {
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      rows.push(item);
    }
  };
  // Selection-scoped commands first (they are what the user is acting on),
  // then plugin sections, then the global block.
  push(builtinMenuItems(target, ctx));
  push(pluginMenuItems(target, ctx));
  push(pluginPadItems(target, ctx));
  push(builtinGlobalCommands(ctx));
  return rows;
}

/** Substring beats subsequence; either must hold, case-insensitive. */
export function fuzzyScore(label: string, query: string): number | null {
  const haystack = label.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (needle === '') return 0;
  const at = haystack.indexOf(needle);
  if (at >= 0) return 100 - at;
  let i = 0;
  for (const char of haystack) {
    if (char === needle[i]) i++;
    if (i === needle.length) return 10;
  }
  return null;
}

export function CommandPalette() {
  const store = useCanvasStore();
  const open = useCanvasState((s) => s.paletteOpen);
  const { diagram, execute, undo, redo, canUndo, canRedo } = useDiagram();
  const config = useEditorConfig();
  const t = useT();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const close = () => store.setState({ paletteOpen: false });
  // §2f: Esc rides the SINGLE dismissal stack — palette on top while open.
  useDismissal('command-palette', open, close);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      setQuery('');
      setIndex(0);
    }
  }, [open]);

  const entries = useMemo(() => {
    if (!open) return [];
    const state = store.getState();
    const selectedIds = state.selectedIds;
    // The REAL context (§2f): a single selected element scopes the target the
    // same way the context menu would; anything else is a canvas target at
    // the viewport center.
    const single = selectedIds.length >= 1 ? selectedIds[0] : undefined;
    const node = single ? diagram.nodes[single] : undefined;
    const edge = single && !node ? diagram.edges[single] : undefined;
    const center = {
      x: state.viewport.x + state.viewport.width / 2,
      y: state.viewport.y + state.viewport.height / 2,
    };
    const target: MenuTarget = node
      ? { kind: 'node', id: node.id, point: rectCenter(node), diagram, selectedIds }
      : edge
        ? { kind: 'edge', id: edge.id, point: center, diagram, selectedIds }
        : { kind: 'canvas', point: center, diagram, selectedIds };
    return paletteEntries(target, {
      execute,
      store,
      config,
      t,
      diagram,
      undo,
      redo,
      canUndo,
      canRedo,
    });
  }, [open, diagram, execute, store, config, t, undo, redo, canUndo, canRedo]);

  const filtered = useMemo(() => {
    return entries
      .map((entry) => ({ entry, score: fuzzyScore(entry.label, query) }))
      .filter((row): row is { entry: RegisteredGlobalCommand; score: number } => row.score !== null)
      .sort((a, b) => b.score - a.score)
      .map((row) => row.entry);
  }, [entries, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  const runEntry = (entry: RegisteredGlobalCommand) => {
    close();
    entry.run();
  };

  let lastSection: string | undefined;
  return (
    <div className="bpmnr-cmdk" data-testid="command-palette" role="dialog" aria-label={t('cmdk.aria')}>
      <div className="bpmnr-cmdk-panel">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={t('cmdk.placeholder')}
          aria-label={t('cmdk.inputAria')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setIndex((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setIndex((i) =>
                filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length,
              );
            } else if (event.key === 'Enter' && filtered[index]) {
              event.preventDefault();
              runEntry(filtered[index]);
            } else if (event.key === 'Escape') {
              // Focus lives in this input, so the global shortcut handler
              // (which ignores editing targets) never sees the key. Delegate
              // to the SAME single dismissal stack — pop the top, no
              // independent close path.
              event.preventDefault();
              event.stopPropagation();
              const { dismissals } = store.getState();
              const top = dismissals[dismissals.length - 1];
              if (top) {
                store.setState({ dismissals: dismissals.slice(0, -1) });
                top.close();
              }
            }
          }}
        />
        <span className="bpmnr-cmdk-count" aria-live="polite">
          {t('cmdk.count', { count: filtered.length })}
        </span>
        {filtered.length === 0 ? (
          <p className="bpmnr-cmdk-empty">{t('cmdk.empty')}</p>
        ) : (
          <ul className="bpmnr-cmdk-list" role="listbox" aria-label={t('cmdk.aria')}>
            {filtered.map((entry, i) => {
              const kicker =
                entry.section !== lastSection && entry.section !== undefined
                  ? entry.section
                  : undefined;
              lastSection = entry.section;
              return (
                <li key={entry.id}>
                  {kicker && <div className="bpmnr-cmdk-kicker">{kicker}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === index}
                    data-cmdk-item={entry.id}
                    data-active={i === index || undefined}
                    tabIndex={-1}
                    onPointerEnter={() => setIndex(i)}
                    onClick={() => runEntry(entry)}
                  >
                    <span className="bpmnr-cmdk-label">{entry.label}</span>
                    {entry.shortcut && <kbd className="bpmnr-cmdk-keys">{entry.shortcut}</kbd>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <footer className="bpmnr-cmdk-hint">{t('cmdk.hint')}</footer>
      </div>
    </div>
  );
}
