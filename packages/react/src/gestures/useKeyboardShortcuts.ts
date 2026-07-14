import { useEffect } from 'react';
import {
  activeEdges,
  activeNodes,
  childrenOf,
  compositeCommand,
  getBoundingBox,
  moveNodeCommand,
  nodeParentId,
  removeEdgeCommand,
  removeNodeCommand,
} from '@buildtovalue/core';
import { fitViewport } from '../canvas/viewport.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasStore } from '../contexts/CanvasContext.js';
import type { Interactions } from '../canvas/useInteractions.js';
import {
  buildPasteCommand,
  collectClipboardPayload,
  readClipboardPayload,
  writeClipboardPayload,
} from './clipboard.js';

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

/**
 * Editor shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z / Ctrl+Y redo,
 * Ctrl/Cmd+A select-all, Ctrl/Cmd+C/X/V copy/cut/paste, Ctrl/Cmd+D duplicate,
 * Delete/Backspace removes the selection, Escape cancels gestures and clears
 * selection, arrows nudge selected nodes by 1px (Shift = grid step), Space
 * holds pan.
 */
export function useKeyboardShortcuts(interactions: Interactions): void {
  const { diagram, execute, undo, redo } = useDiagram();
  const store = useCanvasStore();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditingTarget(event.target)) return;
      const meta = event.ctrlKey || event.metaKey;

      if (event.key === ' ' && !event.repeat) {
        // Panning is a viewport operation, not a diagram mutation — allowed
        // even in read-only mode.
        interactions.setPanKey(true);
        return;
      }

      const state = store.getState();
      // Every shortcut below can mutate the diagram (undo/redo replay
      // commands on the stack too), so a read-only viewer must be fully
      // inert to all of them, not just Delete/arrows.
      if (state.readOnly) return;

      // N-5: an open context menu owns the keyboard (arrows move the active
      // item, Enter runs it — handled on the menu element itself). Global
      // shortcuts stand down so arrows never nudge and Delete never removes
      // the selection behind the menu. Escape stays live: the dismissal
      // stack below pops the menu first.
      if (state.contextMenu && event.key !== 'Escape') return;

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }

      // Roving keyboard focus (N-8 keyboard-only editing): with DOM focus on
      // the canvas (or on an element that is NOT selected), arrows browse the
      // elements instead of nudging; Enter selects the focused element
      // (Shift+Enter = additive). Once the focused element is selected, arrows
      // fall through to the nudge block below — Tab → browse → Enter → nudge.
      const activeEl = document.activeElement;
      const focusedDomId =
        activeEl instanceof Element
          ? (activeEl.getAttribute('data-node-id') ?? activeEl.getAttribute('data-edge-id'))
          : null;
      const focusInCanvas =
        activeEl instanceof Element &&
        (activeEl.classList.contains('bpmnr-canvas') || focusedDomId !== null);
      const isNavArrow = event.key.startsWith('Arrow');
      if (
        isNavArrow &&
        focusInCanvas &&
        (focusedDomId === null
          ? state.selectedIds.length === 0
          : !state.selectedIds.includes(focusedDomId))
      ) {
        event.preventDefault();
        const order = [...activeNodes(diagram)]
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((n) => n.id)
          .concat(activeEdges(diagram).map((e) => e.id));
        if (order.length === 0) return;
        const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
        const current = focusedDomId ?? state.focusedElementId;
        const index = current ? order.indexOf(current) : -1;
        const next = order[(index + (forward ? 1 : -1) + order.length) % order.length];
        store.setState({ focusedElementId: next });
        const target = document.querySelector<SVGGElement>(
          `[data-node-id="${next}"], [data-edge-id="${next}"]`,
        );
        target?.focus?.();
        return;
      }
      if (event.key === 'Enter' && focusedDomId !== null) {
        event.preventDefault();
        const current = state.selectedIds;
        store.setState({
          selectedIds: event.shiftKey
            ? current.includes(focusedDomId)
              ? current.filter((id) => id !== focusedDomId)
              : [...current, focusedDomId]
            : [focusedDomId],
        });
        return;
      }

      if (meta && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        store.setState({
          selectedIds: [
            ...activeNodes(diagram).map((n) => n.id),
            ...activeEdges(diagram).map((e) => e.id),
          ],
        });
        return;
      }
      if (meta && event.key.toLowerCase() === 'c' && state.selectedIds.length > 0) {
        event.preventDefault();
        const payload = collectClipboardPayload(diagram, state.selectedIds);
        if (payload) void writeClipboardPayload(payload);
        return;
      }
      if (meta && event.key.toLowerCase() === 'x' && state.selectedIds.length > 0) {
        event.preventDefault();
        const payload = collectClipboardPayload(diagram, state.selectedIds);
        if (payload) {
          void writeClipboardPayload(payload);
          const commands = state.selectedIds.map((id) =>
            diagram.nodes[id] ? removeNodeCommand(id) : removeEdgeCommand(id),
          );
          execute(
            commands.length === 1 ? commands[0] : compositeCommand('Cut selection', commands),
          );
          store.setState({ selectedIds: [] });
        }
        return;
      }
      if (meta && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        void readClipboardPayload().then((payload) => {
          if (!payload) return;
          const paste = buildPasteCommand(diagram, payload);
          if (!paste) return;
          execute(paste.command);
          store.setState({ selectedIds: paste.newIds });
        });
        return;
      }
      if (meta && event.key.toLowerCase() === 'd' && state.selectedIds.length > 0) {
        event.preventDefault();
        const payload = collectClipboardPayload(diagram, state.selectedIds);
        if (payload) {
          const paste = buildPasteCommand(diagram, payload, {
            description: 'Duplicate selection',
          });
          if (paste) {
            execute(paste.command);
            store.setState({ selectedIds: paste.newIds });
          }
        }
        return;
      }

      // N-5: open the context menu for the current selection via keyboard.
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        interactions.openContextMenuForSelection();
        return;
      }

      if (event.key === 'Escape') {
        // Single dismissal stack (Handoff 5 §11.1): overlay on top first,
        // then selection/gestures, and only then one breadcrumb level up
        // (selection preserved on the way up — aceite 10.5.3).
        const { dismissals, selectedIds, drillId } = store.getState();
        const top = dismissals[dismissals.length - 1];
        if (top) {
          store.setState({ dismissals: dismissals.slice(0, -1) });
          top.close();
          return;
        }
        if (
          selectedIds.length > 0 ||
          state.dragState ||
          state.connectState ||
          state.selectionBox ||
          state.resizeState
        ) {
          interactions.cancelGestures();
          store.setState({ selectedIds: [] });
          return;
        }
        if (drillId !== null) {
          const current = diagram.nodes[drillId];
          const parentId = current ? nodeParentId(current) : undefined;
          const nextDrill = parentId ?? null;
          const scope =
            nextDrill === null
              ? Object.values(diagram.nodes).filter((n) => nodeParentId(n) === undefined)
              : childrenOf(diagram, nextDrill);
          store.setState({
            drillId: nextDrill,
            ...(scope.length > 0
              ? {
                  viewport: fitViewport(
                    getBoundingBox(scope),
                    state.viewport.width / state.viewport.height,
                  ),
                }
              : {}),
          });
        }
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedIds.length > 0) {
        event.preventDefault();
        const commands = state.selectedIds.map((id) =>
          diagram.nodes[id] ? removeNodeCommand(id) : removeEdgeCommand(id),
        );
        execute(
          commands.length === 1 ? commands[0] : compositeCommand('Delete selection', commands),
        );
        store.setState({ selectedIds: [] });
        return;
      }

      const arrows: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      const arrow = arrows[event.key];
      if (arrow && state.selectedIds.length > 0) {
        event.preventDefault();
        // Common editor convention: plain arrow = fine 1px nudge, Shift = grid step.
        const step = (event.shiftKey ? state.gridSize : 1) || 1;
        const commands = state.selectedIds
          .map((id) => diagram.nodes[id])
          .filter(Boolean)
          .map((node) =>
            moveNodeCommand(
              node.id,
              { x: node.x, y: node.y },
              { x: node.x + arrow[0] * step, y: node.y + arrow[1] * step },
            ),
          );
        if (commands.length === 1) execute(commands[0]);
        else if (commands.length > 1) execute(compositeCommand('Nudge selection', commands));
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') interactions.setPanKey(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [diagram, execute, interactions, redo, store, undo]);
}
