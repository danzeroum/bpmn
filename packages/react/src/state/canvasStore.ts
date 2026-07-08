import type { Point } from '@bpmn-react/core';
import { createStore, type Store } from './createStore.js';

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DragState {
  nodeIds: string[];
  /** World-space pointer position when the gesture started. */
  origin: Point;
  /** Current world-space offset applied visually to the dragged nodes. */
  dx: number;
  dy: number;
  /** True once the 4px threshold was crossed (drag vs click). */
  active: boolean;
  /** Lane currently under the dragged node — the drop target for membership. */
  dropLaneId?: string | null;
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
  dragState: DragState | null;
  connectState: ConnectState | null;
  selectionBox: SelectionBoxState | null;
  resizeState: ResizeState | null;
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
    dragState: null,
    connectState: null,
    selectionBox: null,
    resizeState: null,
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
    ...partial,
  });
}
