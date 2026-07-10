import { useEffect, useMemo, useRef, useState } from 'react';
import {
  descendantIdsOf,
  getAnchorPoint,
  isContainerType,
  nodeParentId,
  rectCenter,
  subProcessContainerAt,
  updateEdgeCommand,
  updateNodeCommand,
  type BpmnDiagram,
  type BpmnEdge,
  type Point,
} from '@buildtovalue/core';
import { useCanvasStore, useCanvasState } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { useDismissal } from '../gestures/useDismissal.js';
import { useT } from '../i18n/I18nContext.js';
import {
  backToAutoPatch,
  computeRoutedWaypoints,
  isManualEdge,
  type RouteMode,
} from '../canvas/routeEdge.js';
import type { ContextMenuItem, MenuTarget } from '../plugins/types.js';

/**
 * Pluggable context menu (Handoff 11 N-5, protótipo aba 2): conditional
 * built-ins per target kind + one section per plugin (kicker = plugin id)
 * through the `contextMenuItems` contract. Rules:
 *
 * - Actions dispatch COMMANDS — the menu never mutates diagram state
 *   directly (plugin `run` receives only `execute`).
 * - Fully keyboard operable (open via Menu/Shift+F10, arrows, Enter, Esc)
 *   and registered in the single Esc dismissal stack (H5 §11.1): Esc closes
 *   the menu before anything else.
 * - Positioning flips at the container borders; touch hit-targets are ≥44px
 *   (pointer: coarse media query in styles.css).
 */
interface RenderedItem {
  id: string;
  label: string;
  section?: string;
  run: () => void;
}

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

  const items = useMemo<RenderedItem[]>(() => {
    if (!menu) return [];
    const target: MenuTarget = {
      kind: menu.kind,
      ...(menu.targetId ? { id: menu.targetId } : {}),
      point: menu.world,
      diagram,
      selectedIds: store.getState().selectedIds,
    };
    const rendered: RenderedItem[] = [];

    // Conditional BUILT-INS (edge complete; node minimal — pendencias §13).
    if (menu.kind === 'edge' && menu.targetId) {
      const edge = diagram.edges[menu.targetId];
      if (edge) {
        if (isManualEdge(edge)) {
          rendered.push({
            id: 'edge.back-to-auto',
            label: t('contextMenu.backToAuto'),
            run: () =>
              void execute(updateEdgeCommand(edge.id, backToAutoPatch(diagram, edge, config.edgeRouter))),
          });
        }
        rendered.push({
          id: 'edge.add-waypoint',
          label: t('contextMenu.addWaypoint'),
          run: () => {
            const route =
              edge.waypoints ??
              computeRoutedWaypoints(diagram, edge, config.edgeRouter)?.waypoints ??
              straightRoute(diagram, edge);
            if (!route || route.length < 2) return;
            const index = nearestSegmentIndex(route, menu.world);
            const waypoints = [...route.slice(0, index + 1), menu.world, ...route.slice(index + 1)];
            void execute(
              updateEdgeCommand(edge.id, {
                waypoints,
                properties: { routeMode: 'manual' satisfies RouteMode, routeFallback: undefined },
              }),
            );
          },
        });
        rendered.push({
          id: 'edge.edit-label',
          label: t('contextMenu.editLabel'),
          run: () => store.setState({ editingEdgeId: edge.id }),
        });
      }
    }
    if (menu.kind === 'node' && menu.targetId && diagram.nodes[menu.targetId]) {
      const node = diagram.nodes[menu.targetId];
      rendered.push({
        id: 'node.edit-label',
        label: t('contextMenu.editLabel'),
        run: () => store.setState({ editingNodeId: menu.targetId!, selectedIds: [menu.targetId!] }),
      });
      // F7 reparent — the keyboard/touch path for drag reparent-on-drop (a drag
      // is not accessible). Swimlane containers and boundary events (which follow
      // their host, not a parentId) never reparent this way.
      if (!isContainerType(node.type) && node.type !== 'boundaryEvent') {
        const currentParent = nodeParentId(node);
        // Exclude self + subtree so a container never adopts itself; the deepest
        // expanded sub-process the node's center sits in is the move target.
        const exclude = new Set<string>([node.id, ...descendantIdsOf(diagram, node.id)]);
        const container = subProcessContainerAt(diagram, rectCenter(node), exclude);
        if (container && container.id !== currentParent) {
          rendered.push({
            id: 'node.move-into-subprocess',
            label: t('contextMenu.moveIntoSubprocess', { name: container.label }),
            run: () =>
              void execute(updateNodeCommand(node.id, { properties: { parentId: container.id } })),
          });
        }
        if (currentParent) {
          rendered.push({
            id: 'node.remove-from-subprocess',
            label: t('contextMenu.removeFromSubprocess'),
            run: () =>
              void execute(updateNodeCommand(node.id, { properties: { parentId: undefined } })),
          });
        }
      }
    }

    // PLUGIN sections (contract §N-5): when() decides presence; run() only
    // receives the command dispatcher.
    for (const plugin of config.plugins) {
      const pluginItems: ContextMenuItem[] = plugin.contextMenuItems?.(target) ?? [];
      for (const item of pluginItems) {
        if (item.when && !item.when(target)) continue;
        rendered.push({
          id: `${plugin.id}/${item.id}`,
          label: item.label,
          section: plugin.id,
          run: () => item.run(target, { execute }),
        });
      }
    }
    return rendered;
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

  const runItem = (item: RenderedItem) => {
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

/** Endpoint-anchored straight route for edges without a waypoint model. */
function straightRoute(diagram: BpmnDiagram, edge: BpmnEdge): Point[] | undefined {
  const source = diagram.nodes[edge.sourceId];
  const target = diagram.nodes[edge.targetId];
  if (!source || !target) return undefined;
  return [getAnchorPoint(source, rectCenter(target)).point, getAnchorPoint(target, rectCenter(source)).point];
}

/** Index of the route segment closest to `point` (segments = i → i+1). */
function nearestSegmentIndex(route: Point[], point: Point): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < route.length; i++) {
    const distance = pointToSegment(point, route[i], route[i + 1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

function pointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
