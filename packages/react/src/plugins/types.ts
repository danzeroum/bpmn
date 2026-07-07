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
}

export type EdgeRouterFn = (source: Rect, target: Rect) => EdgeGeometry;

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
}
