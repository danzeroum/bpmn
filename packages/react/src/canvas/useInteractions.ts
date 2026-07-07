import { useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  activeNodes,
  addEdgeCommand,
  compositeCommand,
  createEdge,
  getAnchorPoint,
  moveNodeCommand,
  resizeNodeCommand,
  rectCenter,
  rectsIntersect,
  snapToGrid,
  type ConnectPayload,
  type Point,
} from '@bpmn-react/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasStore } from '../contexts/CanvasContext.js';
import type { ResizeCorner } from '../state/canvasStore.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { panViewport, screenToWorld } from './viewport.js';

const DRAG_THRESHOLD = 4;

interface PanSession {
  startClient: Point;
  scale: number; // world units per pixel
}

/**
 * Centralized pointer-gesture engine. One pointermove/pointerup pair on the
 * SVG serves every gesture (drag, connect, pan, lasso); per-frame updates go
 * through requestAnimationFrame and the canvas store, never through React
 * context state.
 */
export function useInteractions(svgRef: React.RefObject<SVGSVGElement | null>) {
  const { diagram, execute } = useDiagram();
  const store = useCanvasStore();
  const config = useEditorConfig();

  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;

  const panSession = useRef<PanSession | null>(null);
  const rafId = useRef<number | null>(null);
  const pendingMove = useRef<(() => void) | null>(null);

  const schedule = useCallback((work: () => void) => {
    pendingMove.current = work;
    if (rafId.current !== null) return;
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number;
    rafId.current = raf(() => {
      rafId.current = null;
      pendingMove.current?.();
      pendingMove.current = null;
    });
  }, []);

  const world = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const svg = svgRef.current;
      if (!svg) return { x: event.clientX, y: event.clientY };
      return screenToWorld(svg, event.clientX, event.clientY);
    },
    [svgRef],
  );

  /** Node body pointerdown → select + begin (potential) drag. */
  const onNodePointerDown = useCallback(
    (event: ReactPointerEvent, nodeId: string) => {
      if (store.getState().readOnly || !isPrimaryButton(event)) return;
      event.stopPropagation();
      const state = store.getState();
      const additive = event.shiftKey;
      let selectedIds: string[];
      if (additive) {
        selectedIds = state.selectedIds.includes(nodeId)
          ? state.selectedIds.filter((id) => id !== nodeId)
          : [...state.selectedIds, nodeId];
      } else {
        selectedIds = state.selectedIds.includes(nodeId) ? state.selectedIds : [nodeId];
      }
      const origin = world(event);
      store.setState({
        selectedIds,
        dragState: {
          nodeIds: selectedIds.includes(nodeId) ? selectedIds : [nodeId],
          origin,
          dx: 0,
          dy: 0,
          active: false,
        },
      });
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    },
    [store, world],
  );

  /** Port pointerdown → begin a connection gesture. */
  const onPortPointerDown = useCallback(
    (event: ReactPointerEvent, nodeId: string) => {
      if (store.getState().readOnly || !isPrimaryButton(event)) return;
      event.stopPropagation();
      const node = diagramRef.current.nodes[nodeId];
      if (!node) return;
      const point = world(event);
      const anchor = getAnchorPoint(node, point);
      store.setState({
        connectState: {
          sourceId: nodeId,
          sourcePoint: anchor.point,
          currentPoint: point,
          hoverTargetId: null,
          invalidReason: null,
        },
      });
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    },
    [store, world],
  );

  /** Resize-handle pointerdown → begin a resize gesture. */
  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent, nodeId: string, corner: ResizeCorner) => {
      if (store.getState().readOnly || !isPrimaryButton(event)) return;
      event.stopPropagation();
      const node = diagramRef.current.nodes[nodeId];
      if (!node) return;
      const rect = { x: node.x, y: node.y, width: node.width, height: node.height };
      store.setState({
        resizeState: { nodeId, corner, initial: rect, origin: world(event), current: rect },
      });
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    },
    [store, world],
  );

  /** Empty-canvas pointerdown → pan (middle button / space) or lasso (left). */
  const onCanvasPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      if (event.button === 1 || (isPrimaryButton(event) && panKeyHeld.current)) {
        event.preventDefault();
        const { viewport } = store.getState();
        const rect = svg.getBoundingClientRect();
        panSession.current = {
          startClient: { x: event.clientX, y: event.clientY },
          scale: rect.width > 0 ? viewport.width / rect.width : 1,
        };
        store.setState({ isPanning: true });
        svg.setPointerCapture?.(event.pointerId);
        return;
      }
      if (isPrimaryButton(event)) {
        if (!event.shiftKey) store.setState({ selectedIds: [] });
        if (store.getState().readOnly) return;
        const start = world(event);
        store.setState({ selectionBox: { start, current: start } });
        svg.setPointerCapture?.(event.pointerId);
      }
    },
    [store, svgRef, world],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const { clientX, clientY } = event;
      schedule(() => {
        const state = store.getState();

        if (panSession.current) {
          const session = panSession.current;
          const dx = (clientX - session.startClient.x) * session.scale;
          const dy = (clientY - session.startClient.y) * session.scale;
          session.startClient = { x: clientX, y: clientY };
          store.setState({ viewport: panViewport(state.viewport, dx, dy) });
          return;
        }

        if (state.dragState) {
          const point = world({ clientX, clientY });
          let dx = point.x - state.dragState.origin.x;
          let dy = point.y - state.dragState.origin.y;
          const active =
            state.dragState.active ||
            Math.hypot(dx, dy) * (svgScale(svgRef.current, state.viewport) || 1) > DRAG_THRESHOLD;
          if (state.snapEnabled && active) {
            dx = snapToGrid(dx, state.gridSize);
            dy = snapToGrid(dy, state.gridSize);
          }
          store.setState({ dragState: { ...state.dragState, dx, dy, active } });
          return;
        }

        if (state.resizeState) {
          const point = world({ clientX, clientY });
          const { initial, corner, origin } = state.resizeState;
          let dx = point.x - origin.x;
          let dy = point.y - origin.y;
          if (state.snapEnabled) {
            dx = snapToGrid(dx, state.gridSize);
            dy = snapToGrid(dy, state.gridSize);
          }
          const MIN = 20;
          let { x, y, width, height } = initial;
          if (corner.includes('e')) width = Math.max(MIN, initial.width + dx);
          if (corner.includes('s')) height = Math.max(MIN, initial.height + dy);
          if (corner.includes('w')) {
            width = Math.max(MIN, initial.width - dx);
            x = initial.x + initial.width - width;
          }
          if (corner.includes('n')) {
            height = Math.max(MIN, initial.height - dy);
            y = initial.y + initial.height - height;
          }
          store.setState({ resizeState: { ...state.resizeState, current: { x, y, width, height } } });
          return;
        }

        if (state.connectState) {
          const point = world({ clientX, clientY });
          const target = findNodeAt(point);
          let invalidReason: string | null = null;
          if (target && target.id !== state.connectState.sourceId) {
            const verdict = config.ruleEngine.evaluate<ConnectPayload>(
              'edge.connect.pre',
              { sourceId: state.connectState.sourceId, targetId: target.id },
              diagramRef.current,
            );
            invalidReason = verdict.allowed ? null : (verdict.reason ?? 'Not allowed');
          } else if (target && target.id === state.connectState.sourceId) {
            invalidReason = 'A node cannot connect to itself';
          }
          store.setState({
            connectState: {
              ...state.connectState,
              currentPoint: point,
              hoverTargetId: target?.id ?? null,
              invalidReason,
            },
          });
          return;
        }

        if (state.selectionBox) {
          const point = world({ clientX, clientY });
          store.setState({ selectionBox: { ...state.selectionBox, current: point } });
        }
      });
    },
    [config.ruleEngine, schedule, store, svgRef, world],
  );

  const findNodeAt = useCallback((point: Point) => {
    const nodes = activeNodes(diagramRef.current);
    // Iterate in reverse so topmost (later-rendered) nodes win.
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (
        point.x >= node.x &&
        point.x <= node.x + node.width &&
        point.y >= node.y &&
        point.y <= node.y + node.height
      ) {
        return node;
      }
    }
    return undefined;
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      if (rafId.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      pendingMove.current?.();
      pendingMove.current = null;

      const state = store.getState();

      if (panSession.current) {
        panSession.current = null;
        store.setState({ isPanning: false });
        return;
      }

      if (state.dragState) {
        const { nodeIds, dx, dy, active } = state.dragState;
        store.setState({ dragState: null });
        if (active && (dx !== 0 || dy !== 0)) {
          const commands = nodeIds
            .map((id) => diagramRef.current.nodes[id])
            .filter(Boolean)
            .map((node) =>
              moveNodeCommand(
                node.id,
                { x: node.x, y: node.y },
                { x: node.x + dx, y: node.y + dy },
              ),
            );
          if (commands.length === 1) execute(commands[0]);
          else if (commands.length > 1) execute(compositeCommand('Move nodes', commands));
        }
        return;
      }

      if (state.resizeState) {
        const { nodeId, initial, current } = state.resizeState;
        store.setState({ resizeState: null });
        if (
          current.x !== initial.x ||
          current.y !== initial.y ||
          current.width !== initial.width ||
          current.height !== initial.height
        ) {
          execute(resizeNodeCommand(nodeId, initial, current));
        }
        return;
      }

      if (state.connectState) {
        const { sourceId } = state.connectState;
        const point = world(event);
        const target = findNodeAt(point);
        store.setState({ connectState: null });
        if (target && target.id !== sourceId) {
          const verdict = config.ruleEngine.evaluate<ConnectPayload>(
            'edge.connect.pre',
            { sourceId, targetId: target.id },
            diagramRef.current,
          );
          if (verdict.allowed) {
            const edge = createEdge({
              sourceId,
              targetId: target.id,
              versionId: diagramRef.current.version.id,
            });
            execute(addEdgeCommand(edge));
            store.setState({ selectedIds: [edge.id] });
          }
        }
        return;
      }

      if (state.selectionBox) {
        const { start, current } = state.selectionBox;
        const box = {
          x: Math.min(start.x, current.x),
          y: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        };
        const picked =
          box.width > 2 || box.height > 2
            ? activeNodes(diagramRef.current)
                .filter((node) => rectsIntersect(box, node))
                .map((node) => node.id)
            : [];
        store.setState({
          selectionBox: null,
          ...(picked.length > 0
            ? {
                selectedIds: event.shiftKey
                  ? [...new Set([...state.selectedIds, ...picked])]
                  : picked,
              }
            : {}),
        });
      }
    },
    [config.ruleEngine, execute, findNodeAt, store, world],
  );

  const cancelGestures = useCallback(() => {
    panSession.current = null;
    store.setState({ dragState: null, connectState: null, selectionBox: null, resizeState: null, isPanning: false });
  }, [store]);

  /** Space key toggles pan mode for left-button drags. */
  const panKeyHeld = useRef(false);
  const setPanKey = useCallback((held: boolean) => {
    panKeyHeld.current = held;
  }, []);

  return useMemo(
    () => ({
      onNodePointerDown,
      onPortPointerDown,
      onResizePointerDown,
      onCanvasPointerDown,
      onPointerMove,
      onPointerUp,
      cancelGestures,
      setPanKey,
      centerOfNode: (nodeId: string) => {
        const node = diagramRef.current.nodes[nodeId];
        return node ? rectCenter(node) : { x: 0, y: 0 };
      },
    }),
    [
      onNodePointerDown,
      onPortPointerDown,
      onResizePointerDown,
      onCanvasPointerDown,
      onPointerMove,
      onPointerUp,
      cancelGestures,
      setPanKey,
    ],
  );
}

function svgScale(
  svg: SVGSVGElement | null,
  viewport: { width: number },
): number {
  if (!svg) return 1;
  const rect = svg.getBoundingClientRect();
  if (rect.width === 0 || viewport.width === 0) return 1;
  return rect.width / viewport.width; // pixels per world unit
}

export type Interactions = ReturnType<typeof useInteractions>;

function isPrimaryButton(event: { button?: number }): boolean {
  // jsdom fires plain Events without a `button` field — treat as primary.
  return event.button === undefined || event.button === 0;
}
