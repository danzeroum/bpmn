import type { ComponentType, ReactNode } from 'react';
import type {
  BpmnDiagram,
  BpmnNode,
  EdgeGeometry,
  LifecycleConfig,
  NodeTypeDefinition,
  Rect,
  RuleEngine,
  ValidationRule,
} from '@bpmn-react/core';

export interface ShapeProps {
  node: BpmnNode;
  selected: boolean;
}

export type ShapeComponent = ComponentType<ShapeProps>;

export interface PaletteItem {
  id: string;
  label: string;
  nodeType: string;
  /** Small SVG/emoji/text icon rendered in the palette button. */
  icon?: ReactNode;
  defaultProperties?: Record<string, unknown>;
  /**
   * Id of the `PaletteGroup` this item renders under. Ungrouped items are
   * appended after all groups, preserving pre-group behavior.
   */
  group?: string;
}

/**
 * Palette section header. Groups render in registration order (built-ins
 * first, then plugins); a plugin re-registering an existing id replaces it
 * in place. Colors should be `var(--x, #hex)` like everywhere else.
 */
export interface PaletteGroup {
  id: string;
  label: string;
  /** Small pill after the label (e.g. a feature tag like 'F6'). */
  badge?: string;
  /** Header text color override (defaults to the muted text color). */
  headerColor?: string;
  /** Resting background of the group's items. */
  itemBackground?: string;
  /** Hover background of the group's items. */
  itemHoverBackground?: string;
}

export type EdgeRouterFn = (source: Rect, target: Rect) => EdgeGeometry;

/**
 * Editor observability event (Handoff 2 §2). The library emits a minimal
 * vocabulary — `node.created`, `edge.connected`, `promotion.completed`,
 * `import.warning`, `render.slow` — and the host decides what to do with it
 * (log, measure lead time, count import warnings). No telemetry, no deps.
 */
export interface EditorEvent {
  type: string;
  /** Epoch milliseconds. */
  ts: number;
  meta?: Record<string, unknown>;
}

export type EditorEventHandler = (event: EditorEvent) => void;

/**
 * Declarative styling for a domain edge type (keyed by `edge.type`). The
 * EdgeRenderer applies it in the resting state and composes it with the two
 * states that always win: `closed` (retired) and `selected`. Colors should be
 * `var(--btv-*, #hex)` so dark mode and export stay correct.
 */
export interface EdgeStyle {
  /** Line color. */
  stroke: string;
  /** Resting line width (selected still renders at 2.5). Default 1.5. */
  strokeWidth?: number;
  /** SVG dash array, e.g. '5,4'. Solid when omitted. */
  dash?: string;
  /** Arrowhead at the target end. Default 'filled'. */
  marker?: 'filled' | 'open' | 'double-chevron';
  /** Optional decoration drawn at the edge midpoint. */
  midDecoration?: 'purpose-chip' | 'check-disc';
}

/**
 * Declarative extension unit. Everything is optional — a plugin can add a
 * single validation rule or a whole domain vocabulary (node types + shapes +
 * palette + rules + XML mapping preferences).
 */
export interface BpmnPlugin {
  id: string;
  name?: string;
  /** Domain node types registered into the editor's NodeTypeRegistry. */
  nodeTypes?: NodeTypeDefinition[];
  /** Shape components keyed by node type. */
  shapes?: Record<string, ShapeComponent>;
  /** Extra palette entries. */
  paletteItems?: PaletteItem[];
  /** Palette section headers for this plugin's items. */
  paletteGroups?: PaletteGroup[];
  /** Visual styles for domain edge types, keyed by `edge.type`. */
  edgeStyles?: Record<string, EdgeStyle>;
  /** Domain validation rules appended to the ValidationEngine. */
  validationRules?: ValidationRule[];
  /** Hook to register governance rules (`*.pre` hooks) on the RuleEngine. */
  registerRules?: (engine: RuleEngine) => void;
  /** Lifecycle configuration override (first plugin providing one wins). */
  lifecycleConfig?: LifecycleConfig;
  /** Edge routing override: built-in name or custom function. */
  edgeRouter?: 'bezier' | 'orthogonal' | EdgeRouterFn;
  /** Transforms the diagram before it is exported/saved. */
  onBeforeSave?: (diagram: BpmnDiagram) => BpmnDiagram;
  /** Transforms the diagram right after an import/load. */
  onAfterLoad?: (diagram: BpmnDiagram) => BpmnDiagram;
  /** Observability sink — receives editor events (all providers are called). */
  onEditorEvent?: EditorEventHandler;
  /**
   * Editor resilience opt-out: `false` disables autosave, the recovery
   * banner and the beforeunload guard. Default true; last plugin wins.
   */
  autosave?: boolean;
}
