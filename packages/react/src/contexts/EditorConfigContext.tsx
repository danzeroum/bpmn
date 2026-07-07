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
import type { BpmnPlugin, EdgeRouterFn, PaletteItem, ShapeComponent } from '../plugins/types.js';
import { BUILT_IN_SHAPES } from '../shapes/index.js';
import { BUILT_IN_PALETTE } from '../ui/paletteItems.js';

export interface EditorConfig {
  registry: NodeTypeRegistry;
  shapes: Record<string, ShapeComponent>;
  paletteItems: PaletteItem[];
  ruleEngine: RuleEngine;
  validationEngine: ValidationEngine;
  lifecycleEngine: LifecycleEngine;
  edgeRouter: EdgeRouterFn;
  plugins: BpmnPlugin[];
  /** Custom types (from plugins) preferred when importing XML. */
  preferredTypes: string[];
}

const EditorConfigContext = createContext<EditorConfig | null>(null);

export function resolveEditorConfig(plugins: BpmnPlugin[] = []): EditorConfig {
  // De-duplicate by id, last registration wins.
  const byId = new Map<string, BpmnPlugin>();
  for (const plugin of plugins) byId.set(plugin.id, plugin);
  const resolved = [...byId.values()];

  const registry = createDefaultRegistry();
  const shapes: Record<string, ShapeComponent> = { ...BUILT_IN_SHAPES };
  const paletteItems: PaletteItem[] = [...BUILT_IN_PALETTE];
  const ruleEngine = createDefaultRuleEngine();
  const validationRules = [...BUILT_IN_VALIDATION_RULES];
  const preferredTypes: string[] = [];
  let lifecycleEngine = new LifecycleEngine();
  let edgeRouter: EdgeRouterFn = cubicBezierConnection;

  for (const plugin of resolved) {
    for (const def of plugin.nodeTypes ?? []) {
      if (!registry.has(def.type)) registry.register(def);
      preferredTypes.push(def.type);
    }
    Object.assign(shapes, plugin.shapes ?? {});
    paletteItems.push(...(plugin.paletteItems ?? []));
    validationRules.push(...(plugin.validationRules ?? []));
    plugin.registerRules?.(ruleEngine);
    if (plugin.lifecycleConfig) lifecycleEngine = new LifecycleEngine(plugin.lifecycleConfig);
    if (plugin.edgeRouter) {
      edgeRouter =
        plugin.edgeRouter === 'bezier'
          ? cubicBezierConnection
          : plugin.edgeRouter === 'orthogonal'
            ? orthogonalConnection
            : plugin.edgeRouter;
    }
  }

  return {
    registry,
    shapes,
    paletteItems,
    ruleEngine,
    validationEngine: new ValidationEngine(validationRules),
    lifecycleEngine,
    edgeRouter,
    plugins: resolved,
    preferredTypes,
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
