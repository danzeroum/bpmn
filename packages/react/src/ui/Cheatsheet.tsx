import { useMemo } from 'react';
import { rectCenter } from '@buildtovalue/core';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useDismissal } from '../gestures/useDismissal.js';
import { KEYBOARD_SHORTCUT_CATALOG } from '../gestures/useKeyboardShortcuts.js';
import { useT } from '../i18n/I18nContext.js';
import { paletteEntries } from './CommandPalette.js';
import type { MenuTarget } from '../plugins/types.js';

/**
 * "?" cheatsheet (Handoff 15 §2f) — generated, never written by hand:
 * shortcuts come from `KEYBOARD_SHORTCUT_CATALOG` (declared beside the very
 * handler that binds them; the sweep test fails on any undeclared key) and
 * the command list is `paletteEntries` — the SAME aggregate the Ctrl/Cmd+K
 * palette renders. Anti-drift by construction: there is no third list.
 */
export function Cheatsheet() {
  const store = useCanvasStore();
  const open = useCanvasState((s) => s.cheatsheetOpen);
  const { diagram, execute, undo, redo, canUndo, canRedo } = useDiagram();
  const config = useEditorConfig();
  const t = useT();

  const close = () => store.setState({ cheatsheetOpen: false });
  useDismissal('cheatsheet', open, close);

  const commands = useMemo(() => {
    if (!open) return [];
    const state = store.getState();
    const selectedIds = state.selectedIds;
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

  if (!open) return null;

  return (
    <div
      className="bpmnr-cheatsheet"
      data-testid="cheatsheet"
      role="dialog"
      aria-label={t('cheatsheet.aria')}
    >
      <div className="bpmnr-cheatsheet-panel">
        <header>
          <strong>{t('cheatsheet.title')}</strong>
          <button type="button" onClick={close} aria-label={t('cheatsheet.close')}>
            ✕
          </button>
        </header>
        <div className="bpmnr-cheatsheet-columns">
          <section aria-label={t('cheatsheet.shortcuts')}>
            <h4>{t('cheatsheet.shortcuts')}</h4>
            <ul data-testid="cheatsheet-shortcuts">
              {KEYBOARD_SHORTCUT_CATALOG.map((entry) => (
                <li key={entry.id} data-shortcut={entry.id}>
                  <kbd>{entry.keys}</kbd>
                  <span>{t(entry.labelKey)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label={t('cheatsheet.commands')}>
            <h4>{t('cheatsheet.commands')}</h4>
            <ul data-testid="cheatsheet-commands">
              {commands.map((entry) => (
                <li key={entry.id} data-command={entry.id}>
                  <span>{entry.label}</span>
                  {entry.shortcut && <kbd>{entry.shortcut}</kbd>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
