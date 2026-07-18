import { useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasStore, useCanvasState } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useDismissal } from '../gestures/useDismissal.js';
import { useT } from '../i18n/I18nContext.js';
import {
  builtinMenuItems,
  pluginMenuItems,
  type RegisteredMenuItem,
} from '../commands/menuRegistry.js';
import type { MenuTarget } from '../plugins/types.js';

/**
 * Pluggable context menu (Handoff 11 N-5, protótipo aba 2): conditional
 * built-ins per target kind + one section per plugin (kicker = plugin id)
 * through the `contextMenuItems` contract. Since Handoff 15 §2f the items
 * come from the extracted command registry (`commands/menuRegistry.ts`,
 * equivalence-tested) — the SAME source the Ctrl/Cmd+K palette and the "?"
 * cheatsheet consume. Rules:
 *
 * - Actions dispatch COMMANDS — the menu never mutates diagram state
 *   directly (plugin `run` receives only `execute`).
 * - Fully keyboard operable (open via Menu/Shift+F10, arrows, Enter, Esc)
 *   and registered in the single Esc dismissal stack (H5 §11.1): Esc closes
 *   the menu before anything else.
 * - Positioning flips at the container borders; touch hit-targets are ≥44px
 *   (pointer: coarse media query in styles.css).
 */
const MENU_WIDTH = 240;
const ITEM_HEIGHT = 34;

export function ContextMenu() {
  const store = useCanvasStore();
  const menu = useCanvasState((s) => s.contextMenu);
  const { diagram, execute } = useDiagram();
  const config = useEditorConfig();
  const t = useT();
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = () => store.setState({ contextMenu: null });

  // Esc pops the menu FIRST — it registers on open, i.e. on top of the stack.
  useDismissal('context-menu', menu !== null, close);

  const items = useMemo<RegisteredMenuItem[]>(() => {
    if (!menu) return [];
    const target: MenuTarget = {
      kind: menu.kind,
      ...(menu.targetId ? { id: menu.targetId } : {}),
      point: menu.world,
      diagram,
      selectedIds: store.getState().selectedIds,
    };
    const ctx = { execute, store, config, t };
    return [...builtinMenuItems(target, ctx), ...pluginMenuItems(target, ctx)];
  }, [menu, diagram, config, execute, store, t]);

  useEffect(() => {
    setActiveIndex(0);
    // Focus lands on the menu so arrows/Enter/Esc work immediately.
    if (menu) menuRef.current?.focus();
  }, [menu]);

  if (!menu || items.length === 0) return null;

  // Flip at the borders of the designer container.
  const host = menuRef.current?.offsetParent as HTMLElement | null;
  const bounds = host?.getBoundingClientRect();
  const estimatedHeight = items.length * ITEM_HEIGHT + 16;
  let left = menu.client.x - (bounds?.left ?? 0);
  let top = menu.client.y - (bounds?.top ?? 0);
  if (bounds && left + MENU_WIDTH > bounds.width) left = Math.max(0, left - MENU_WIDTH);
  if (bounds && top + estimatedHeight > bounds.height) top = Math.max(0, top - estimatedHeight);

  const runItem = (item: RegisteredMenuItem) => {
    close();
    item.run();
  };

  let lastSection: string | undefined;
  return (
    <div
      ref={menuRef}
      className="bpmnr-context-menu"
      role="menu"
      aria-label={t('contextMenu.aria')}
      tabIndex={-1}
      data-testid="context-menu"
      style={{ left, top, width: MENU_WIDTH }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveIndex((index) => (index + 1) % items.length);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveIndex((index) => (index - 1 + items.length) % items.length);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          runItem(items[activeIndex]);
        }
        // Escape is NOT handled here: it belongs to the single dismissal
        // stack (useKeyboardShortcuts pops this menu first).
      }}
    >
      {items.map((item, index) => {
        const kicker =
          item.section !== lastSection && item.section !== undefined ? item.section : undefined;
        lastSection = item.section;
        return (
          <div key={item.id}>
            {kicker && <div className="bpmnr-context-menu-kicker">{kicker}</div>}
            <button
              type="button"
              role="menuitem"
              data-menu-item={item.id}
              data-active={index === activeIndex || undefined}
              tabIndex={-1}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => runItem(item)}
            >
              {item.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
