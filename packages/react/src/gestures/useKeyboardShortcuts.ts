import { useEffect } from 'react';
import {
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
 * Delete/Backspace removes the selection, Escape cancels gestures and clears
 * selection, arrows nudge selected nodes by the grid size, Space holds pan.
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
        const step = (event.shiftKey ? 1 : state.gridSize) || 1;
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
