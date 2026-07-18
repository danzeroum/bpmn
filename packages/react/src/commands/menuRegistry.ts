import {
  compositeCommand,
  descendantIdsOf,
  getAnchorPoint,
  isContainerType,
  nodeParentId,
  rectCenter,
  subProcessContainerAt,
  removeEdgeCommand,
  removeNodeCommand,
  updateEdgeCommand,
  updateNodeCommand,
  type BpmnDiagram,
  type BpmnEdge,
  type Command,
  type Point,
  type RuleVerdict,
} from '@buildtovalue/core';
import type { CanvasStore } from '../state/canvasStore.js';
import type { EditorConfig } from '../contexts/EditorConfigContext.js';
import type { TFunction } from '../i18n/messages.js';
import type { ContextMenuItem, MenuTarget } from '../plugins/types.js';
import { buildAlignCommand, buildDistributeCommand } from '../canvas/arrange.js';
import {
  buildPasteCommand,
  collectClipboardPayload,
  hasClipboardContent,
  readClipboardPayload,
  writeClipboardPayload,
} from '../gestures/clipboard.js';
import {
  backToAutoPatch,
  computeRoutedWaypoints,
  isManualEdge,
  type RouteMode,
} from '../canvas/routeEdge.js';

/**
 * THE command registry of the editor surfaces (Handoff 15 §2f, V-0 decisão 4):
 * the ContextMenu's conditional built-ins extracted VERBATIM into a pure
 * builder — proven identical by tests/menuRegistryEquivalence.test.tsx, which
 * was frozen BEFORE this extraction (N-7 discipline). The ContextMenu, the
 * Ctrl/Cmd+K command palette and the "?" cheatsheet all consume THIS source —
 * no surface defines its own items, so they can never drift apart.
 *
 * Rules carried over unchanged:
 * - Every action dispatches COMMANDS through `execute` — never a direct
 *   diagram mutation.
 * - `when()` of plugin items is evaluated against the REAL target context.
 */
export interface MenuBuildContext {
  execute: (command: Command) => RuleVerdict;
  store: CanvasStore;
  config: EditorConfig;
  t: TFunction;
}

/** One executable entry of the registry (menu row / palette row). */
export interface RegisteredMenuItem {
  id: string;
  label: string;
  /** Section kicker (plugin id) — undefined for built-ins. */
  section?: string;
  run: () => void;
}

/**
 * Conditional BUILT-INS per target kind (edge complete; node minimal —
 * pendencias §13). Body moved verbatim from `<ContextMenu>`; the equivalence
 * test pins ids/labels/order per scenario.
 */
export function builtinMenuItems(target: MenuTarget, ctx: MenuBuildContext): RegisteredMenuItem[] {
  const { execute, store, config, t } = ctx;
  const diagram = target.diagram;
  const rendered: RegisteredMenuItem[] = [];

  if (target.kind === 'edge' && target.id) {
    const edge = diagram.edges[target.id];
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
          const index = nearestSegmentIndex(route, target.point);
          const waypoints = [...route.slice(0, index + 1), target.point, ...route.slice(index + 1)];
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
  if (target.kind === 'node' && target.id && diagram.nodes[target.id]) {
    const node = diagram.nodes[target.id];
    const nodeId = target.id;
    rendered.push({
      id: 'node.edit-label',
      label: t('contextMenu.editLabel'),
      run: () => store.setState({ editingNodeId: nodeId, selectedIds: [nodeId] }),
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
    const clipboardSelection = target.selectedIds.includes(node.id)
      ? target.selectedIds
      : [node.id];
    rendered.push({
      id: 'node.copy',
      label: t('contextMenu.copy'),
      run: () => {
        const payload = collectClipboardPayload(diagram, clipboardSelection);
        if (payload) void writeClipboardPayload(payload);
      },
    });
    rendered.push({
      id: 'node.duplicate',
      label: t('contextMenu.duplicate'),
      run: () => {
        const payload = collectClipboardPayload(diagram, clipboardSelection);
        const paste = payload
          ? buildPasteCommand(diagram, payload, { description: 'Duplicate selection' })
          : null;
        if (paste) {
          void execute(paste.command);
          store.setState({ selectedIds: paste.newIds });
        }
      },
    });
    rendered.push({
      id: 'node.delete',
      label: t('contextMenu.delete'),
      run: () => {
        const ids = clipboardSelection;
        const commands = ids.map((id) =>
          diagram.nodes[id] ? removeNodeCommand(id) : removeEdgeCommand(id),
        );
        void execute(
          commands.length === 1 ? commands[0] : compositeCommand('Delete selection', commands),
        );
        store.setState({ selectedIds: [] });
      },
    });
    // Align/distribute (referência item 2): appear for multi-node selections.
    const selectedNodes = target.selectedIds
      .map((id) => diagram.nodes[id])
      .filter((n): n is NonNullable<typeof n> => Boolean(n && !n.removedInVersion));
    if (selectedNodes.length >= 2) {
      const aligners = [
        ['align-left', 'left', 'contextMenu.alignLeft'],
        ['align-center-x', 'centerX', 'contextMenu.alignCenterX'],
        ['align-top', 'top', 'contextMenu.alignTop'],
        ['align-center-y', 'centerY', 'contextMenu.alignCenterY'],
      ] as const;
      for (const [id, mode, key] of aligners) {
        rendered.push({
          id: `selection.${id}`,
          label: t(key),
          run: () => {
            const command = buildAlignCommand(diagram, selectedNodes, mode);
            if (command) void execute(command);
          },
        });
      }
    }
    if (selectedNodes.length >= 3) {
      for (const axis of ['horizontal', 'vertical'] as const) {
        rendered.push({
          id: `selection.distribute-${axis}`,
          label: t(
            axis === 'horizontal'
              ? 'contextMenu.distributeHorizontal'
              : 'contextMenu.distributeVertical',
          ),
          run: () => {
            const command = buildDistributeCommand(diagram, selectedNodes, axis);
            if (command) void execute(command);
          },
        });
      }
    }
  }

  if (target.kind === 'canvas' && hasClipboardContent()) {
    rendered.push({
      id: 'canvas.paste',
      label: t('contextMenu.paste'),
      run: () => {
        void readClipboardPayload().then((payload) => {
          // Paste anchored at the click point: shift the payload so its
          // top-left corner lands on the menu's world position.
          const minX = payload ? Math.min(...payload.nodes.map((n) => n.x)) : 0;
          const minY = payload ? Math.min(...payload.nodes.map((n) => n.y)) : 0;
          const paste = payload
            ? buildPasteCommand(diagram, payload, {
                offsetX: target.point.x - minX,
                offsetY: target.point.y - minY,
              })
            : null;
          if (paste) {
            void execute(paste.command);
            store.setState({ selectedIds: paste.newIds });
          }
        });
      },
    });
  }

  return rendered;
}

/**
 * PLUGIN sections (contract §N-5): `when()` decides presence against the REAL
 * target; `run()` only receives the command dispatcher.
 */
export function pluginMenuItems(target: MenuTarget, ctx: MenuBuildContext): RegisteredMenuItem[] {
  const { execute, config } = ctx;
  const rendered: RegisteredMenuItem[] = [];
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
}

/**
 * PLUGIN context-pad actions (Handoff 14 §1a contract) surfaced as registry
 * entries — the palette aggregates them for single-node targets so a pad-only
 * plugin action is still reachable by keyboard. Ids share the plugin prefix,
 * so a plugin exposing the same id in menu AND pad dedupes naturally.
 */
export function pluginPadItems(target: MenuTarget, ctx: MenuBuildContext): RegisteredMenuItem[] {
  if (target.kind !== 'node') return [];
  const { execute, config } = ctx;
  const rendered: RegisteredMenuItem[] = [];
  for (const plugin of config.plugins) {
    const padItems = plugin.contextPadItems?.(target) ?? [];
    for (const item of padItems) {
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
