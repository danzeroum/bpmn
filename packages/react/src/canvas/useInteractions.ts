import { useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  addEdgeCommand,
  attachBoundaryCommand,
  attachedBoundaryEventIds,
  boundaryAnchorOf,
  boundaryAttachedTo,
  boundaryNodePosition,
  childrenOf,
  descendantIdsOf,
  compositeCommand,
  createEdge,
  detachBoundaryCommand,
  getAnchorPoint,
  getBoundingBox,
  isContainerType,
  isSubProcessExpanded,
  laneFlowNodeRefs,
  moveNodeCommand,
  nodeParentId,
  resizeNodeCommand,
  rectCenter,
  rectsIntersect,
  snapToGrid,
  subProcessContainerAt,
  updateEdgeCommand,
  updateNodeCommand,
  type BpmnDiagram,
  type BpmnNode,
  type Command,
  type ConnectPayload,
  type Point,
} from '@buildtovalue/core';
import { activeNodesCached } from './activeCache.js';
import { laneResizeAdjust, poolResizeReflow } from './laneTiling.js';
import { findBoundarySnapAt, findNodeAtPoint } from './hitTest.js';
import { computeGuideSnap } from './smartGuides.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasStore } from '../contexts/CanvasContext.js';
import type { ResizeCorner, SettlingEntry } from '../state/canvasStore.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import {
  computeRoutedWaypoints,
  edgeObstacles,
  edgeRouteCollides,
  isManualEdge,
  rerouteConnectedEdges,
  translateManualEdges,
  type RouteMode,
} from './routeEdge.js';
import type { EdgeRouterFn } from '../plugins/types.js';
import { fitViewport, panViewport, screenToWorld } from './viewport.js';
import { isNodeVisible } from './visibility.js';
import { SUBPROCESS_TITLE_HEIGHT } from '../shapes/shapes.js';

const DRAG_THRESHOLD = 4;

/** Handoff 11 N-1: event types that can attach to an activity border. */
const isAttachableEvent = (node: BpmnNode): boolean =>
  node.type === 'boundaryEvent' || node.type.startsWith('intermediate');

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
  const { diagram, execute, announceVeto } = useDiagram();
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

  /**
   * N-5 long-press (touch): pointerdown on a node/edge arms a 500ms timer;
   * crossing the drag threshold or lifting the pointer cancels it.
   */
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelLongPress = useCallback(() => {
    if (longPress.current) {
      clearTimeout(longPress.current);
      longPress.current = null;
    }
  }, []);

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
      // A boundary event travels with its host, and an (expanded) sub-process
      // carries its whole subtree: fold both into the drag set so they move
      // (and commit) together.
      const base = selectedIds.includes(nodeId) ? selectedIds : [nodeId];
      const withDescendants = [
        ...base,
        ...base.flatMap((id) => descendantIdsOf(diagramRef.current, id)),
      ];
      const attached = attachedBoundaryEventIds(diagramRef.current, withDescendants);
      const nodeIds = [...new Set([...withDescendants, ...attached])];
      store.setState({
        selectedIds,
        dragState: {
          nodeIds,
          rootIds: base,
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

  /**
   * Node double-click. One navigation gesture for the whole family (Handoff
   * 5 §7.6): on an EXPANDED sub-process' title strip it drills down; on the
   * body (and every other node) it begins inline label editing — rename
   * stays discoverable via body double-click and the inspector's Label field.
   */
  const onNodeDoubleClick = useCallback(
    (
      event: { stopPropagation: () => void; clientX?: number; clientY?: number },
      nodeId: string,
    ) => {
      if (store.getState().readOnly) return;
      event.stopPropagation();
      const node = diagramRef.current.nodes[nodeId];
      if (
        node &&
        node.type === 'subProcess' &&
        isSubProcessExpanded(node) &&
        event.clientX !== undefined &&
        event.clientY !== undefined
      ) {
        const point = world({ clientX: event.clientX, clientY: event.clientY });
        if (point.y - node.y <= SUBPROCESS_TITLE_HEIGHT) {
          const children = childrenOf(diagramRef.current, nodeId);
          if (children.length > 0) {
            const { viewport } = store.getState();
            store.setState({
              drillId: nodeId,
              selectedIds: [],
              viewport: fitViewport(getBoundingBox(children), viewport.width / viewport.height),
            });
            return;
          }
        }
      }
      store.setState({ editingNodeId: nodeId, selectedIds: [nodeId] });
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

  /** Route-handle pointerdown → begin dragging an existing waypoint (R-3). */
  const onEdgeHandlePointerDown = useCallback(
    (event: ReactPointerEvent, edgeId: string, index: number, base: Point[]) => {
      if (store.getState().readOnly || !isPrimaryButton(event)) return;
      event.stopPropagation();
      const origin = world(event);
      store.setState({
        selectedIds: [edgeId],
        edgeDrag: {
          edgeId,
          index,
          waypoints: base.map((p) => ({ ...p })),
          origin,
          grabbed: { ...base[index] },
          active: false,
        },
      });
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    },
    [store, world],
  );

  /** Segment pointerdown → insert a bend at the pointer and drag it (R-3). The
   * gesture only authors a manual route once the drag threshold is crossed. */
  const onEdgeSegmentPointerDown = useCallback(
    (event: ReactPointerEvent, edgeId: string, segIndex: number, base: Point[]) => {
      if (store.getState().readOnly || !isPrimaryButton(event)) return;
      event.stopPropagation();
      const point = world(event);
      const waypoints = [
        ...base.slice(0, segIndex + 1).map((p) => ({ ...p })),
        { ...point },
        ...base.slice(segIndex + 1).map((p) => ({ ...p })),
      ];
      store.setState({
        selectedIds: [edgeId],
        edgeDrag: {
          edgeId,
          index: segIndex + 1,
          waypoints,
          origin: point,
          grabbed: { ...point },
          active: false,
        },
      });
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    },
    [store, world],
  );

  /** Double-click an interior waypoint → remove it (stays manual, undoable). */
  const onEdgeWaypointDoubleClick = useCallback(
    (event: { stopPropagation: () => void }, edgeId: string, index: number, base: Point[]) => {
      if (store.getState().readOnly) return;
      event.stopPropagation();
      if (index <= 0 || index >= base.length - 1) return; // endpoints are anchored
      const waypoints = base.filter((_, i) => i !== index);
      if (waypoints.length < 2) return;
      const edge = diagramRef.current.edges[edgeId];
      const collides = edge
        ? edgeRouteCollides(waypoints, edgeObstacles(diagramRef.current, edge))
        : false;
      execute(
        updateEdgeCommand(edgeId, {
          waypoints,
          properties: { routeMode: 'manual', routeCollision: collides ? true : undefined },
        }),
      );
    },
    [execute, store],
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
        const patch: Partial<import('../state/canvasStore.js').CanvasState> = {};
        if (!event.shiftKey) patch.selectedIds = [];
        // Clicking the canvas dismisses an in-progress inline label edit
        // (the input's onBlur commits the value first).
        if (store.getState().editingNodeId) patch.editingNodeId = null;
        if (Object.keys(patch).length > 0) store.setState(patch);
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

        if (state.edgeDrag) {
          const point = world({ clientX, clientY });
          const rawX = state.edgeDrag.grabbed.x + (point.x - state.edgeDrag.origin.x);
          const rawY = state.edgeDrag.grabbed.y + (point.y - state.edgeDrag.origin.y);
          const active =
            state.edgeDrag.active ||
            Math.hypot(point.x - state.edgeDrag.origin.x, point.y - state.edgeDrag.origin.y) *
              (svgScale(svgRef.current, state.viewport) || 1) >
              DRAG_THRESHOLD;
          const x = state.snapEnabled && active ? snapToGrid(rawX, state.gridSize) : rawX;
          const y = state.snapEnabled && active ? snapToGrid(rawY, state.gridSize) : rawY;
          const waypoints = state.edgeDrag.waypoints.map((p, i) =>
            i === state.edgeDrag!.index ? { x, y } : p,
          );
          store.setState({ edgeDrag: { ...state.edgeDrag, waypoints, active } });
          return;
        }

        if (state.dragState) {
          const point = world({ clientX, clientY });
          let dx = point.x - state.dragState.origin.x;
          let dy = point.y - state.dragState.origin.y;
          const active =
            state.dragState.active ||
            Math.hypot(dx, dy) * (svgScale(svgRef.current, state.viewport) || 1) > DRAG_THRESHOLD;
          if (active) cancelLongPress();
          if (state.snapEnabled && active) {
            dx = snapToGrid(dx, state.gridSize);
            dy = snapToGrid(dy, state.gridSize);
          }
          // Smart guides (item 2): single-root drags magnetize to neighbors'
          // edges/centers; the final pixels win over the grid snap.
          let alignGuides: ReturnType<typeof computeGuideSnap>['guides'] | null = null;
          let spacingBadges: ReturnType<typeof computeGuideSnap>['badges'] | null = null;
          if (active && state.dragState.rootIds.length === 1) {
            const root = diagramRef.current.nodes[state.dragState.rootIds[0]];
            if (root) {
              const snap = computeGuideSnap(
                diagramRef.current,
                state.drillId,
                state.viewport,
                root,
                dx,
                dy,
                new Set(state.dragState.nodeIds),
              );
              dx = snap.dx;
              dy = snap.dy;
              alignGuides = snap.guides.length > 0 ? snap.guides : null;
              spacingBadges = snap.badges.length > 0 ? snap.badges : null;
            }
          }
          const dropLaneId = active
            ? (dropTargetLane(diagramRef.current, state.dragState.nodeIds, dx, dy)?.id ?? null)
            : null;
          // Handoff 11 N-1: a LONE event dragged near an activity border arms
          // the snap target — border highlight now, attach on drop.
          let boundarySnap = null as ReturnType<typeof findBoundarySnap>;
          if (active && state.dragState.nodeIds.length === 1) {
            const dragged = diagramRef.current.nodes[state.dragState.nodeIds[0]];
            if (dragged && isAttachableEvent(dragged)) {
              boundarySnap = findBoundarySnap(dragged, point);
            }
          }
          // F7 reparent-on-drop: the deepest expanded sub-process under the
          // cursor arms the container highlight. Boundary snap has precedence —
          // while it is armed (event near an activity border) no reparent
          // target lights up, so the N-1 gesture is never hijacked.
          const reparentTargetId =
            active && !boundarySnap
              ? (subProcessContainerAt(
                  diagramRef.current,
                  point,
                  new Set(state.dragState.nodeIds),
                )?.id ?? null)
              : null;
          store.setState({
            dragState: { ...state.dragState, dx, dy, active, dropLaneId, reparentTargetId },
            boundarySnap,
            alignGuides,
            spacingBadges,
          });
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
            // Rules run only when the hover target CHANGES, not per frame —
            // a host-plugged expensive rule must never stall the drag.
            if (target.id === state.connectState.hoverTargetId) {
              invalidReason = state.connectState.invalidReason;
            } else {
              const verdict = config.ruleEngine.evaluate<ConnectPayload>(
                'edge.connect.pre',
                { sourceId: state.connectState.sourceId, targetId: target.id },
                diagramRef.current,
              );
              invalidReason = verdict.allowed ? null : (verdict.reason ?? 'Not allowed');
            }
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

  /**
   * Handoff 11 N-1: the best boundary-snap candidate for a dragged event —
   * the nearest activity border anchor within the 12px snap zone, or null.
   */
  const findBoundarySnap = useCallback(
    (dragged: BpmnNode, pointer: Point) =>
      findBoundarySnapAt(
        diagramRef.current,
        config.registry,
        store.getState().drillId,
        dragged,
        pointer,
      ),
    [config.registry, store],
  );

  const findNodeAt = useCallback(
    (point: Point) => findNodeAtPoint(diagramRef.current, store.getState().drillId, point),
    [store],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      if (rafId.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      pendingMove.current?.();
      pendingMove.current = null;
      cancelLongPress();

      const state = store.getState();

      if (panSession.current) {
        panSession.current = null;
        store.setState({ isPanning: false });
        return;
      }

      if (state.edgeDrag) {
        const { edgeId, waypoints, active } = state.edgeDrag;
        store.setState({ edgeDrag: null });
        // A click (no drag past threshold) authors nothing — the edge is just
        // selected. A real drag commits ONE command that turns the edge manual
        // (waypoints + routeMode together), undoable back to its prior route.
        if (active) {
          const edge = diagramRef.current.edges[edgeId];
          const collides = edge
            ? edgeRouteCollides(waypoints, edgeObstacles(diagramRef.current, edge))
            : false;
          execute(
            updateEdgeCommand(edgeId, {
              waypoints,
              properties: {
                routeMode: 'manual' satisfies RouteMode,
                routeFallback: undefined,
                routeCollision: collides ? true : undefined,
              },
            }),
          );
        }
        return;
      }

      if (state.dragState) {
        const { nodeIds, rootIds, dx, dy, active, reparentTargetId } = state.dragState;
        const snap = state.boundarySnap;
        store.setState({ dragState: null, boundarySnap: null, alignGuides: null, spacingBadges: null });
        if (active && (dx !== 0 || dy !== 0)) {
          const single = nodeIds.length === 1 ? diagramRef.current.nodes[nodeIds[0]] : undefined;
          // Handoff 11 N-1: a lone event dropped inside the snap zone
          // ATTACHES; a lone attached boundary dropped outside DETACHES.
          // Each gesture is ONE undoable command (reroutes ride inside it).
          if (single && snap && isAttachableEvent(single)) {
            const host = diagramRef.current.nodes[snap.hostId];
            if (host) {
              const to = boundaryNodePosition(host, snap.side, snap.t, single);
              const cmds: Command[] = [
                attachBoundaryCommand(single.id, snap.hostId, snap.side, snap.t, to),
              ];
              const settling = appendRerouteCommands(
                cmds,
                diagramRef.current,
                [single],
                to.x - single.x,
                to.y - single.y,
                config.edgeRouter,
              );
              execute(cmds.length === 1 ? cmds[0] : compositeCommand('Attach boundary event', cmds));
              store.setState({
                settling: settling.length > 0 && !prefersReducedMotion() ? settling : null,
              });
              return;
            }
          }
          if (single && !snap && boundaryAttachedTo(single)) {
            const to = { x: single.x + dx, y: single.y + dy };
            const cmds: Command[] = [detachBoundaryCommand(single.id, to)];
            const settling = appendRerouteCommands(
              cmds,
              diagramRef.current,
              [single],
              dx,
              dy,
              config.edgeRouter,
            );
            execute(cmds.length === 1 ? cmds[0] : compositeCommand('Detach boundary event', cmds));
            store.setState({
              settling: settling.length > 0 && !prefersReducedMotion() ? settling : null,
            });
            return;
          }
          const moved = nodeIds
            .map((id) => diagramRef.current.nodes[id])
            .filter((node): node is BpmnNode => Boolean(node));
          const commands: Command[] = moved.map((node) =>
            moveNodeCommand(
              node.id,
              { x: node.x, y: node.y },
              { x: node.x + dx, y: node.y + dy },
            ),
          );
          commands.push(...laneMembershipCommands(diagramRef.current, moved, dx, dy));
          // F7 reparent-on-drop: the grabbed nodes join the highlighted
          // container (or leave their current one when dropped outside). Part
          // of the SAME composite as the move — reparent + move undo together.
          // Coordinates are NOT translated (DI absolute); ride-along children
          // and cross-boundary flow validation follow from the parentId alone.
          commands.push(
            ...reparentCommands(diagramRef.current, rootIds, reparentTargetId ?? null),
          );
          // Re-route the auto A* edges touching the moved nodes and cache their
          // fresh waypoints INSIDE this same move (one atomic, undoable unit —
          // Handoff 10 R-2b). Unrelated / non-astar edges are never recomputed.
          const settling = appendRerouteCommands(
            commands,
            diagramRef.current,
            moved,
            dx,
            dy,
            config.edgeRouter,
          );
          if (commands.length === 1) execute(commands[0]);
          else if (commands.length > 1) execute(compositeCommand('Move nodes', commands));
          // The waypoints are cached regardless; the crossfade is a pure visual
          // affordance, suppressed under prefers-reduced-motion (instant snap).
          store.setState({
            settling: settling.length > 0 && !prefersReducedMotion() ? settling : null,
          });
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
          // #154 — design-time snap+tiling: a lane resize snaps to its pool
          // body and re-tiles the sibling lanes; a pool resize reflows its
          // lanes. All inside the SAME gesture → one composite, one undo.
          // Import is never involved — this only runs on interactive resizes.
          const resized = diagramRef.current.nodes[nodeId];
          let target = current;
          const laneCmds: Command[] = [];
          if (resized?.type === 'lane') {
            const adjust = laneResizeAdjust(diagramRef.current, nodeId, current);
            if (adjust) {
              target = adjust.snapped;
              laneCmds.push(...adjust.commands);
            }
          } else if (resized?.type === 'pool') {
            laneCmds.push(...poolResizeReflow(diagramRef.current, initial, current));
          }
          const cmds: Command[] = [resizeNodeCommand(nodeId, initial, target), ...laneCmds];
          // Handoff 11 N-1: attached boundary events REFLOW proportionally —
          // the parametric anchor (side + t, stored or derived from the
          // pre-resize geometry) is re-projected onto the new rect INSIDE the
          // same undoable command.
          for (const boundaryId of attachedBoundaryEventIds(diagramRef.current, [nodeId])) {
            const boundary = diagramRef.current.nodes[boundaryId];
            if (!boundary) continue;
            const { side, t } = boundaryAnchorOf(initial, boundary);
            const to = boundaryNodePosition(target, side, t, boundary);
            if (to.x !== boundary.x || to.y !== boundary.y) {
              cmds.push(moveNodeCommand(boundaryId, { x: boundary.x, y: boundary.y }, to));
            }
          }
          execute(cmds.length === 1 ? cmds[0] : compositeCommand('Resize node', cmds));
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
          // ES-3 (§4c): a vetoed DROP is never silent — the rule's reason
          // lights the 🔒 through the shared lastVeto lifecycle.
          if (!verdict.allowed) announceVeto(verdict.reason ?? 'Not allowed');
          if (verdict.allowed) {
            // Connecting a data element (category 'data') to an activity — in
            // either direction — is a data association, not a sequence flow.
            const isData = (id: string) => {
              const node = diagramRef.current.nodes[id];
              return Boolean(
                node && config.registry.has(node.type) && config.registry.get(node.type).category === 'data',
              );
            };
            const dataAssociation = isData(sourceId) !== isData(target.id);
            const edge = createEdge({
              sourceId,
              targetId: target.id,
              ...(dataAssociation ? { type: 'dataAssociation' } : {}),
              versionId: diagramRef.current.version.id,
            });
            execute(addEdgeCommand(edge));
            store.setState({ selectedIds: [edge.id] });
            config.emitEditorEvent('edge.connected', {
              edgeType: edge.type,
              sourceId,
              targetId: target.id,
            });
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
        // Only nodes actually on screen are lassoable — never the contents of
        // a collapsed sub-process or, in drill-down, the outer process.
        const picked =
          box.width > 2 || box.height > 2
            ? activeNodesCached(diagramRef.current)
                .filter(
                  (node) =>
                    rectsIntersect(box, node) &&
                    isNodeVisible(diagramRef.current, node, state.drillId),
                )
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
    [announceVeto, config, execute, findNodeAt, store, world],
  );

  const cancelGestures = useCallback(() => {
    panSession.current = null;
    store.setState({
      dragState: null,
      connectState: null,
      selectionBox: null,
      resizeState: null,
      edgeDrag: null,
      isPanning: false,
    });
  }, [store]);

  /** Space key toggles pan mode for left-button drags. */
  const panKeyHeld = useRef(false);
  const setPanKey = useCallback((held: boolean) => {
    panKeyHeld.current = held;
  }, []);

  /**
   * Handoff 11 N-5: opens the context menu for a target. Selection follows
   * the invocation (like a click would); the menu itself lives in the HTML
   * overlay and reads this state.
   */
  const openContextMenu = useCallback(
    (
      kind: 'node' | 'edge' | 'canvas',
      targetId: string | undefined,
      client: Point,
      worldPoint: Point,
    ) => {
      if (store.getState().readOnly) return;
      // Right-clicking a member of a multi-selection keeps the selection
      // (align/distribute act on it); clicking outside it re-selects.
      const currentSelection = store.getState().selectedIds;
      store.setState({
        ...(kind !== 'canvas' && targetId && !currentSelection.includes(targetId)
          ? { selectedIds: [targetId] }
          : {}),
        contextMenu: { kind, ...(targetId ? { targetId } : {}), client, world: worldPoint },
      });
    },
    [store],
  );

  const onNodeContextMenu = useCallback(
    (event: ReactPointerEvent | React.MouseEvent, nodeId: string) => {
      event.preventDefault();
      event.stopPropagation();
      openContextMenu('node', nodeId, { x: event.clientX, y: event.clientY }, world(event));
    },
    [openContextMenu, world],
  );

  const onEdgeContextMenu = useCallback(
    (event: ReactPointerEvent | React.MouseEvent, edgeId: string) => {
      event.preventDefault();
      event.stopPropagation();
      openContextMenu('edge', edgeId, { x: event.clientX, y: event.clientY }, world(event));
    },
    [openContextMenu, world],
  );

  const onCanvasContextMenu = useCallback(
    (event: ReactPointerEvent | React.MouseEvent) => {
      event.preventDefault();
      openContextMenu('canvas', undefined, { x: event.clientX, y: event.clientY }, world(event));
    },
    [openContextMenu, world],
  );

  const armLongPress = useCallback(
    (event: ReactPointerEvent, kind: 'node' | 'edge', targetId: string) => {
      if (event.pointerType !== 'touch') return;
      cancelLongPress();
      const client = { x: event.clientX, y: event.clientY };
      const worldPoint = world(event);
      longPress.current = setTimeout(() => {
        cancelGestures();
        openContextMenu(kind, targetId, client, worldPoint);
      }, 500);
    },
    [cancelGestures, cancelLongPress, openContextMenu, world],
  );

  /** N-5 keyboard (Menu / Shift+F10): opens for the first selected element. */
  const openContextMenuForSelection = useCallback(() => {
    const { selectedIds, viewport } = store.getState();
    const id = selectedIds[0];
    if (!id) return;
    const diagram = diagramRef.current;
    const node = diagram.nodes[id];
    const edge = diagram.edges[id];
    const worldPoint = node
      ? rectCenter(node)
      : edge
        ? rectCenter(getBoundingBox([diagram.nodes[edge.sourceId], diagram.nodes[edge.targetId]].filter(Boolean) as BpmnNode[]))
        : { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 };
    // World → client (svg rect + viewBox scale); falls back to the rect corner.
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    const scale = rect && viewport.width > 0 ? rect.width / viewport.width : 1;
    const client = rect
      ? { x: rect.left + (worldPoint.x - viewport.x) * scale, y: rect.top + (worldPoint.y - viewport.y) * scale }
      : { x: worldPoint.x, y: worldPoint.y };
    openContextMenu(node ? 'node' : edge ? 'edge' : 'canvas', id, client, worldPoint);
  }, [openContextMenu, store, svgRef]);

  return useMemo(
    () => ({
      onNodePointerDown,
      onPortPointerDown,
      onNodeDoubleClick,
      onResizePointerDown,
      onEdgeHandlePointerDown,
      onEdgeSegmentPointerDown,
      onEdgeWaypointDoubleClick,
      onCanvasPointerDown,
      onPointerMove,
      onPointerUp,
      cancelGestures,
      setPanKey,
      onNodeContextMenu,
      onEdgeContextMenu,
      onCanvasContextMenu,
      openContextMenuForSelection,
      armLongPress,
      cancelLongPress,
      centerOfNode: (nodeId: string) => {
        const node = diagramRef.current.nodes[nodeId];
        return node ? rectCenter(node) : { x: 0, y: 0 };
      },
    }),
    [
      onNodePointerDown,
      onPortPointerDown,
      onNodeDoubleClick,
      onResizePointerDown,
      onEdgeHandlePointerDown,
      onEdgeSegmentPointerDown,
      onEdgeWaypointDoubleClick,
      onCanvasPointerDown,
      onPointerMove,
      onPointerUp,
      cancelGestures,
      setPanKey,
      onNodeContextMenu,
      onEdgeContextMenu,
      onCanvasContextMenu,
      openContextMenuForSelection,
      armLongPress,
      cancelLongPress,
    ],
  );
}

/**
 * Appends the edge-reroute commands for a completed move to `commands` (so the
 * whole gesture stays one atomic, undoable unit) and returns the settle
 * crossfade entries. Routing runs against a POST-move snapshot of the diagram;
 * only the auto A* edges touching a moved node are recomputed (Handoff 10
 * R-2b's zero-recalc guarantee lives in `rerouteConnectedEdges`).
 */
function appendRerouteCommands(
  commands: Command[],
  diagram: BpmnDiagram,
  moved: BpmnNode[],
  dx: number,
  dy: number,
  defaultRouter: EdgeRouterFn,
): SettlingEntry[] {
  const movedIds = new Set(moved.map((node) => node.id));
  const nextNodes = { ...diagram.nodes };
  for (const node of moved) {
    nextNodes[node.id] = { ...node, x: node.x + dx, y: node.y + dy };
  }
  const nextDiagram: BpmnDiagram = { ...diagram, nodes: nextNodes };
  const settling: SettlingEntry[] = [];
  for (const reroute of rerouteConnectedEdges(nextDiagram, movedIds, defaultRouter)) {
    const properties: Record<string, unknown> = { routeMode: 'auto' satisfies RouteMode };
    // Carry the fallback flag only while there's no corridor; clear it once a
    // route is found again so a stale ⚠ never sticks after the graph opens up.
    properties.routeFallback = reroute.routed ? undefined : true;
    commands.push(
      updateEdgeCommand(reroute.edgeId, { waypoints: reroute.waypoints, properties }),
    );
    settling.push({ edgeId: reroute.edgeId, path: reroute.previewPath });
  }
  // Manual routes translate RIGIDLY with their moved anchor — never re-routed
  // (edge case 6). A translation onto a shape keeps the route and flags ⚠.
  for (const t of translateManualEdges(nextDiagram, movedIds, dx, dy)) {
    commands.push(
      updateEdgeCommand(t.edgeId, {
        waypoints: t.waypoints,
        properties: { routeCollision: t.collides ? true : undefined },
      }),
    );
  }
  // Fallback recovery (edge case 4): a route with no corridor self-heals when
  // an obstacle move opens space — retry the *flagged* auto edges (not the
  // connected ones, already handled) and clear ⚠ only if a corridor is found.
  // Bounded to fallbacks, so healthy unrelated edges are never recomputed.
  for (const edge of Object.values(nextDiagram.edges)) {
    if (!edge.properties.routeFallback) continue;
    if (movedIds.has(edge.sourceId) || movedIds.has(edge.targetId)) continue;
    if (isManualEdge(edge)) continue;
    const result = computeRoutedWaypoints(nextDiagram, edge, defaultRouter);
    if (!result || !result.routed) continue; // still no corridor → leave it flagged
    commands.push(
      updateEdgeCommand(edge.id, {
        waypoints: result.waypoints,
        properties: { routeMode: 'auto' satisfies RouteMode, routeFallback: undefined },
      }),
    );
  }
  return settling;
}

/** Reduced-motion preference (SSR/jsdom-safe): the settle crossfade is skipped
 * when true, snapping straight to the cached A* route. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
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

/** Active lanes that are legal drop targets — never the dragged nodes themselves. */
function candidateLanes(diagram: BpmnDiagram, draggedIds: string[]): BpmnNode[] {
  return Object.values(diagram.nodes).filter(
    (node) =>
      node.type === 'lane' && !node.removedInVersion && !draggedIds.includes(node.id),
  );
}

/** Smallest lane containing the point wins, so nested/overlapping lanes resolve
 * to the most specific one. */
function laneAt(lanes: BpmnNode[], point: Point): BpmnNode | undefined {
  let best: BpmnNode | undefined;
  for (const lane of lanes) {
    const inside =
      point.x >= lane.x &&
      point.x <= lane.x + lane.width &&
      point.y >= lane.y &&
      point.y <= lane.y + lane.height;
    if (inside && (!best || lane.width * lane.height < best.width * best.height)) {
      best = lane;
    }
  }
  return best;
}

/** Lane under the first dragged flow node's center — the highlight target. */
function dropTargetLane(
  diagram: BpmnDiagram,
  draggedIds: string[],
  dx: number,
  dy: number,
): BpmnNode | undefined {
  const primary = draggedIds
    .map((id) => diagram.nodes[id])
    .find((node) => node && !isContainerType(node.type));
  if (!primary) return undefined;
  return laneAt(candidateLanes(diagram, draggedIds), {
    x: primary.x + dx + primary.width / 2,
    y: primary.y + dy + primary.height / 2,
  });
}

/**
 * Lane-membership updates for a completed drag: each moved flow node joins the
 * lane its new center lands in (leaving any other lane). Returned as commands
 * so the whole gesture — move + membership — is one undoable unit.
 */
function laneMembershipCommands(
  diagram: BpmnDiagram,
  moved: BpmnNode[],
  dx: number,
  dy: number,
): Command[] {
  const flowNodes = moved.filter((node) => !isContainerType(node.type));
  if (flowNodes.length === 0) return [];
  const lanes = candidateLanes(diagram, moved.map((node) => node.id));
  if (lanes.length === 0) return [];

  const targetLaneOf = new Map<string, string | null>();
  for (const node of flowNodes) {
    const center = { x: node.x + dx + node.width / 2, y: node.y + dy + node.height / 2 };
    targetLaneOf.set(node.id, laneAt(lanes, center)?.id ?? null);
  }

  const commands: Command[] = [];
  for (const lane of lanes) {
    const refs = laneFlowNodeRefs(lane);
    // Keep refs the drag didn't touch; re-evaluate membership for moved nodes.
    const next = refs.filter((id) => !targetLaneOf.has(id) || targetLaneOf.get(id) === lane.id);
    for (const [nodeId, laneId] of targetLaneOf) {
      if (laneId === lane.id && !next.includes(nodeId)) next.push(nodeId);
    }
    const changed = next.length !== refs.length || next.some((id, index) => refs[index] !== id);
    if (changed) {
      commands.push(updateNodeCommand(lane.id, { properties: { flowNodeRefs: next } }));
    }
  }
  return commands;
}

/**
 * Sub-process reparent updates for a completed drag (F7): each GRABBED node
 * (roots only — ride-along descendants keep their in-subtree parentId, and
 * boundary events follow their host, not a parentId) adopts `targetParentId`,
 * or clears its parentId when dropped outside any container. Returned as
 * commands so reparent rides in the same composite as the move — one undoable
 * unit. Coordinates are untouched (DI absolute): only parentId changes, which
 * is what collapse/drill/visibility and the cross-scope-edge validation key
 * off. Containers (lanes/pools) and boundary events never reparent this way.
 */
function reparentCommands(
  diagram: BpmnDiagram,
  rootIds: string[],
  targetParentId: string | null,
): Command[] {
  const commands: Command[] = [];
  for (const id of rootIds) {
    const node = diagram.nodes[id];
    if (!node) continue;
    if (isContainerType(node.type) || isAttachableEvent(node)) continue;
    // A node can never become its own ancestor's child target — the hit-test
    // already excludes the dragged subtree, so target is never a descendant.
    const desired = targetParentId ?? undefined;
    if (nodeParentId(node) === desired) continue; // no-op move within the same scope
    commands.push(updateNodeCommand(id, { properties: { parentId: desired } }));
  }
  return commands;
}
