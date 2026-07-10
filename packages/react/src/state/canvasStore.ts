import type { Point } from '@buildtovalue/core';
import { createStore, type Store } from './createStore.js';

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DragState {
  nodeIds: string[];
  /**
   * The nodes the user actually grabbed (before folding in ride-along
   * descendants and attached boundary events). Only these reparent on drop —
   * their descendants keep their parentId, which points inside the moved
   * subtree.
   */
  rootIds: string[];
  /** World-space pointer position when the gesture started. */
  origin: Point;
  /** Current world-space offset applied visually to the dragged nodes. */
  dx: number;
  dy: number;
  /** True once the 4px threshold was crossed (drag vs click). */
  active: boolean;
  /** Lane currently under the dragged node — the drop target for membership. */
  dropLaneId?: string | null;
  /**
   * Expanded sub-process currently under the cursor — the reparent-on-drop
   * target (F7). Its border highlights; the drop sets the grabbed nodes'
   * parentId. `null` means no container (a plain move, or a drag to top level
   * that clears parentId). Boundary snap takes precedence: while a boundary
   * snap is armed this stays null, so the two gestures never both light up.
   */
  reparentTargetId?: string | null;
}

export interface ConnectState {
  sourceId: string;
  sourcePoint: Point;
  currentPoint: Point;
  /** Node currently hovered as a potential target. */
  hoverTargetId: string | null;
  /** Veto reason when hovering an invalid target. */
  invalidReason: string | null;
}

export interface SelectionBoxState {
  start: Point;
  current: Point;
}

/**
 * A manual-route edit in progress (Handoff 10 R-3): the user is dragging a
 * waypoint handle (or a freshly inserted bend). `waypoints` is the live route
 * with the dragged point tracking the pointer; committing turns the edge
 * manual in one command.
 */
export interface EdgeDragState {
  edgeId: string;
  /** Index of the waypoint being dragged within `waypoints`. */
  index: number;
  /** Working route (endpoints included); the dragged point follows the pointer. */
  waypoints: Point[];
  /** World-space pointer position when the gesture started. */
  origin: Point;
  /** Original position of the dragged point — the drag delta is applied to it. */
  grabbed: Point;
  /** True once the drag threshold was crossed (a click must not author a bend). */
  active: boolean;
}

export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export interface ResizeState {
  nodeId: string;
  corner: ResizeCorner;
  /** Node rect when the gesture started. */
  initial: { x: number; y: number; width: number; height: number };
  origin: Point;
  /** Live rect applied visually while resizing. */
  current: { x: number; y: number; width: number; height: number };
}

export interface CanvasState {
  viewport: Viewport;
  selectedIds: string[];
  hoveredId: string | null;
  /** Edge currently hovered — reveals its route handles + manual badge (R-3). */
  hoveredEdgeId: string | null;
  dragState: DragState | null;
  connectState: ConnectState | null;
  selectionBox: SelectionBoxState | null;
  resizeState: ResizeState | null;
  /** In-progress manual-route edit (waypoint/segment drag), R-3. */
  edgeDrag: EdgeDragState | null;
  /** Id of the node whose label is being edited inline, if any. */
  editingNodeId: string | null;
  isPanning: boolean;
  gridSize: number;
  snapEnabled: boolean;
  readOnly: boolean;
  /** Node created by the last palette insert — plays the enter animation once. */
  lastCreatedNodeId: string | null;
  /** True when commands ran since the last explicit export (beforeunload guard). */
  dirtySinceExport: boolean;
  /** Sub-process being viewed in drill-down mode (null = whole process). */
  drillId: string | null;
  /**
   * Validation/soundness badges by node id (shape-state pendência §5): the
   * node renders a `!` disc — and the stable issue code below the shape when
   * present (Handoff 5 §3.2, e.g. CALL_REF_MISSING) — until the map is
   * cleared. Populated by Validate and the PromotionPanel's "ver no canvas".
   */
  issueBadges: Record<string, NodeIssueBadge>;
  /** Open overlays, bottom→top. Esc pops the top (Handoff 5 §11.1). */
  dismissals: DismissalEntry[];
  /**
   * Edges that just re-routed (Handoff 10 R-2b): their pre-A* orthogonal
   * preview paths, rendered on top and faded out (160ms) so the settled A*
   * route crossfades in underneath — never a waypoint morph. `null` (or under
   * `prefers-reduced-motion`) means no crossfade is playing.
   */
  settling: SettlingEntry[] | null;
  /**
   * Live boundary snap target (Handoff 11 N-1): while an event node drags
   * within the snap zone of an activity border, the host id + parametric
   * anchor of the candidate attachment. Drives the border highlight; the
   * drop commits ONE attach command.
   */
  boundarySnap: BoundarySnapTarget | null;
  /** Open context menu (Handoff 11 N-5), or null. */
  contextMenu: ContextMenuState | null;
  /** Edge whose label is being edited inline (N-5 "Editar rótulo"). */
  editingEdgeId: string | null;
}

export interface BoundarySnapTarget {
  hostId: string;
  side: 'top' | 'right' | 'bottom' | 'left';
  t: number;
  /** The anchor point ON the border (world coordinates). */
  point: Point;
}

/**
 * Open context menu (Handoff 11 N-5): what was invoked and where. `client`
 * positions the HTML menu (viewport-relative); `world` feeds the actions
 * (e.g. "adicionar waypoint aqui").
 */
export interface ContextMenuState {
  kind: 'node' | 'edge' | 'canvas';
  targetId?: string;
  client: Point;
  world: Point;
}

export interface SettlingEntry {
  edgeId: string;
  /** SVG path of the orthogonal preview at the final positions. */
  path: string;
}

export interface NodeIssueBadge {
  severity: 'error' | 'warning';
  /** Stable issue code rendered mono below the shape (optional). */
  code?: string;
}

/**
 * One entry of the SINGLE Esc dismissal stack (Handoff 5 §11.1): Esc always
 * closes the highest open overlay first — popover → peek → selection →
 * breadcrumb up. Components register while open (see `useDismissal`);
 * never wire independent Esc listeners.
 */
export interface DismissalEntry {
  id: string;
  close: () => void;
}

export type CanvasStore = Store<CanvasState>;

export const MIN_VIEWPORT_WIDTH = 200;
export const MAX_VIEWPORT_WIDTH = 20000;

export function createCanvasStore(partial: Partial<CanvasState> = {}): CanvasStore {
  return createStore<CanvasState>({
    viewport: { x: 0, y: 0, width: 1200, height: 800 },
    selectedIds: [],
    hoveredId: null,
    hoveredEdgeId: null,
    dragState: null,
    connectState: null,
    selectionBox: null,
    resizeState: null,
    edgeDrag: null,
    editingNodeId: null,
    isPanning: false,
    gridSize: 20,
    snapEnabled: true,
    readOnly: false,
    lastCreatedNodeId: null,
    dirtySinceExport: false,
    drillId: null,
    issueBadges: {},
    dismissals: [],
    settling: null,
    boundarySnap: null,
    contextMenu: null,
    editingEdgeId: null,
    ...partial,
  });
}
