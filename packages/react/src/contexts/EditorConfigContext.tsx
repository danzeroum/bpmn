import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  BUILT_IN_VALIDATION_RULES,
  createDefaultRegistry,
  createDefaultRuleEngine,
  cubicBezierConnection,
  LifecycleEngine,
  orthogonalConnection,
  ValidationEngine,
  type NodeTypeRegistry,
  type RuleEngine,
} from '@bpmn-react/core';
import type {
  BpmnPlugin,
  EdgeRouterFn,
  EdgeStyle,
  EditorEventHandler,
  PaletteGroup,
  PaletteItem,
  ShapeComponent,
} from '../plugins/types.js';
import { BUILT_IN_SHAPES } from '../shapes/index.js';
import { EDGE_CORNER_RADIUS } from '../shapes/common.js';
import { BUILT_IN_PALETTE, BUILT_IN_PALETTE_GROUPS } from '../ui/paletteItems.js';

export interface EditorConfig {
  registry: NodeTypeRegistry;
  shapes: Record<string, ShapeComponent>;
  paletteItems: PaletteItem[];
  /** Palette section headers, in display order; merged across plugins. */
  paletteGroups: PaletteGroup[];
  /** Domain edge styles keyed by `edge.type`, merged across plugins. */
  edgeStyles: Record<string, EdgeStyle>;
  ruleEngine: RuleEngine;
  validationEngine: ValidationEngine;
  lifecycleEngine: LifecycleEngine;
  edgeRouter: EdgeRouterFn;
  plugins: BpmnPlugin[];
  /** Custom types (from plugins) preferred when importing XML. */
  preferredTypes: string[];
  /**
   * Emits an observability event to every plugin `onEditorEvent` handler
   * (no-op when none is registered). The timestamp is stamped here so all
   * handlers see the same event object.
   */
  emitEditorEvent: (type: string, meta?: Record<string, unknown>) => void;
  /** Autosave + recovery banner + beforeunload guard toggle. Default true. */
  autosave: boolean;
}

const EditorConfigContext = createContext<EditorConfig | null>(null);

/** Built-in orthogonal router with the craft-pack rounded corners applied. */
const roundedOrthogonalConnection: EdgeRouterFn = (source, target) =>
  orthogonalConnection(source, target, { cornerRadius: EDGE_CORNER_RADIUS });

export function resolveEditorConfig(plugins: BpmnPlugin[] = []): EditorConfig {
  // De-duplicate by id, last registration wins.
  const byId = new Map<string, BpmnPlugin>();
  for (const plugin of plugins) byId.set(plugin.id, plugin);
  const resolved = [...byId.values()];

  const registry = createDefaultRegistry();
  const shapes: Record<string, ShapeComponent> = { ...BUILT_IN_SHAPES };
  const paletteItems: PaletteItem[] = [...BUILT_IN_PALETTE];
  const paletteGroups: PaletteGroup[] = [...BUILT_IN_PALETTE_GROUPS];
  // Built-in style for the standard data association: dotted, open arrowhead
  // (BPMN notation). Plugins may override by re-declaring the key.
  const edgeStyles: Record<string, EdgeStyle> = {
    dataAssociation: {
      stroke: 'var(--bpmnr-text-muted, #6f675a)',
      dash: '2,4',
      marker: 'open',
    },
  };
  const ruleEngine = createDefaultRuleEngine();
  const validationRules = [...BUILT_IN_VALIDATION_RULES];
  const preferredTypes: string[] = [];
  const eventHandlers: EditorEventHandler[] = [];
  let lifecycleEngine = new LifecycleEngine();
  let edgeRouter: EdgeRouterFn = cubicBezierConnection;
  let autosave = true;

  for (const plugin of resolved) {
    for (const def of plugin.nodeTypes ?? []) {
      if (!registry.has(def.type)) registry.register(def);
      preferredTypes.push(def.type);
    }
    Object.assign(shapes, plugin.shapes ?? {});
    Object.assign(edgeStyles, plugin.edgeStyles ?? {});
    paletteItems.push(...(plugin.paletteItems ?? []));
    for (const group of plugin.paletteGroups ?? []) {
      const existing = paletteGroups.findIndex((g) => g.id === group.id);
      if (existing >= 0) paletteGroups[existing] = group;
      else paletteGroups.push(group);
    }
    validationRules.push(...(plugin.validationRules ?? []));
    plugin.registerRules?.(ruleEngine);
    if (plugin.onEditorEvent) eventHandlers.push(plugin.onEditorEvent);
    if (plugin.autosave !== undefined) autosave = plugin.autosave;
    if (plugin.lifecycleConfig) lifecycleEngine = new LifecycleEngine(plugin.lifecycleConfig);
    if (plugin.edgeRouter) {
      edgeRouter =
        plugin.edgeRouter === 'bezier'
          ? cubicBezierConnection
          : plugin.edgeRouter === 'orthogonal'
            ? roundedOrthogonalConnection
            : plugin.edgeRouter;
    }
  }

  return {
    registry,
    shapes,
    paletteItems,
    paletteGroups,
    edgeStyles,
    ruleEngine,
    validationEngine: new ValidationEngine(validationRules),
    lifecycleEngine,
    edgeRouter,
    plugins: resolved,
    preferredTypes,
    emitEditorEvent:
      eventHandlers.length === 0
        ? () => {}
        : (type, meta) => {
            const event = { type, ts: Date.now(), ...(meta ? { meta } : {}) };
            for (const handler of eventHandlers) handler(event);
          },
    autosave,
  };
}

export function EditorConfigProvider({
  plugins = [],
  children,
}: {
  plugins?: BpmnPlugin[];
  children: ReactNode;
}) {
  const config = useMemo(() => resolveEditorConfig(plugins), [plugins]);
  return <EditorConfigContext.Provider value={config}>{children}</EditorConfigContext.Provider>;
}

export function useEditorConfig(): EditorConfig {
  const config = useContext(EditorConfigContext);
  if (!config) throw new Error('useEditorConfig must be used inside <BpmnDesigner>/<BpmnViewer>');
  return config;
}
