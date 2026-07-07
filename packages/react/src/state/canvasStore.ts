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
  isPanning: boolean;
  gridSize: number;
  snapEnabled: boolean;
  readOnly: boolean;
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
    isPanning: false,
    gridSize: 20,
    snapEnabled: true,
    readOnly: false,
    ...partial,
  });
}
