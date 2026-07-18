import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  BUILT_IN_VALIDATION_RULES,
  createDefaultRegistry,
  createDefaultRuleEngine,
  cubicBezierConnection,
  LifecycleEngine,
  ValidationEngine,
  type NodeTypeRegistry,
  type RuleEngine,
} from '@buildtovalue/core';
import type {
  BpmnPlugin,
  EdgeRouterFn,
  EdgeStyle,
  EditorEventHandler,
  EngineBridge,
  EventDefinitionResolver,
  EditorEventName,
  EditorEventPayloads,
  InspectorSection,
  PaletteGroup,
  PaletteItem,
  ShapeComponent,
} from '../plugins/types.js';
import { BUILT_IN_SHAPES } from '../shapes/index.js';
import { BUILT_IN_PALETTE, BUILT_IN_PALETTE_GROUPS } from '../ui/paletteItems.js';
import { resolveRouter } from '../canvas/routers.js';

export interface EditorConfig {
  registry: NodeTypeRegistry;
  shapes: Record<string, ShapeComponent>;
  paletteItems: PaletteItem[];
  /** Palette section headers, in display order; merged across plugins. */
  paletteGroups: PaletteGroup[];
  /** Domain edge styles keyed by `edge.type`, merged across plugins. */
  edgeStyles: Record<string, EdgeStyle>;
  /** Plugin inspector sections, in registration order. */
  inspectorSections: InspectorSection[];
  ruleEngine: RuleEngine;
  validationEngine: ValidationEngine;
  lifecycleEngine: LifecycleEngine;
  edgeRouter: EdgeRouterFn;
  plugins: BpmnPlugin[];
  /** Custom types (from plugins) preferred when importing XML. */
  preferredTypes: string[];
  /**
   * Emits a catalog event (Handoff 11 N-3 — see EDITOR_EVENTS and the semver
   * stability contract) to every plugin `onEditorEvent` handler (no-op when
   * none is registered). The timestamp is stamped here so all handlers see
   * the same event object. Deprecated aliases fan out automatically with a
   * single console warning per session.
   */
  emitEditorEvent: <T extends EditorEventName>(type: T, meta?: EditorEventPayloads[T]) => void;
  /** Autosave + recovery banner + beforeunload guard toggle. Default true. */
  autosave: boolean;
  /** Execution-engine bridge (Handoff 14 §1f); null → no "Execução" tab. */
  engine: EngineBridge | null;
  /** Governed event-definition resolver (Handoff 16 §3b); null → declared degradation. */
  eventDefinitionResolver: EventDefinitionResolver | null;
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
  const inspectorSections: InspectorSection[] = [];
  let lifecycleEngine = new LifecycleEngine();
  let edgeRouter: EdgeRouterFn = cubicBezierConnection;
  let autosave = true;
  let engine: EngineBridge | null = null;
  let eventDefinitionResolver: EventDefinitionResolver | null = null;

  // Family/domain color contract (Handoff 5 §10.3): one wheel step per
  // domain — a collision is a build warning; gold/green are reserved for
  // governance/approval and rejected as domain body colors.
  const wheelClaims = new Map<number, string>();
  for (const plugin of resolved) {
    if (plugin.colorWheelDegree !== undefined) {
      const holder = wheelClaims.get(plugin.colorWheelDegree);
      if (holder) {
        console.warn(
          `[bpmn-react] color wheel collision: plugins "${holder}" and "${plugin.id}" both claim the ${plugin.colorWheelDegree}° step — each domain must claim its own (Handoff 5 §7.4)`,
        );
      } else {
        wheelClaims.set(plugin.colorWheelDegree, plugin.id);
      }
    }
    if (plugin.bodyColor && /btv-gold|btv-green|#9a7b1e|#1a6a54/i.test(plugin.bodyColor)) {
      console.warn(
        `[bpmn-react] plugin "${plugin.id}" uses a RESERVED color as domain body color (gold = governance/value, green = approval/selection — Handoff 5 §7.5)`,
      );
    }
  }

  for (const plugin of resolved) {
    for (const def of plugin.nodeTypes ?? []) {
      if (!registry.has(def.type)) registry.register(def);
      preferredTypes.push(def.type);
    }
    Object.assign(shapes, plugin.shapes ?? {});
    Object.assign(edgeStyles, plugin.edgeStyles ?? {});
    paletteItems.push(...(plugin.paletteItems ?? []));
    inspectorSections.push(...(plugin.inspectorSections ?? []));
    for (const group of plugin.paletteGroups ?? []) {
      const existing = paletteGroups.findIndex((g) => g.id === group.id);
      if (existing >= 0) paletteGroups[existing] = group;
      else paletteGroups.push(group);
    }
    validationRules.push(...(plugin.validationRules ?? []));
    plugin.registerRules?.(ruleEngine);
    if (plugin.onEditorEvent) eventHandlers.push(plugin.onEditorEvent);
    if (plugin.autosave !== undefined) autosave = plugin.autosave;
    if (plugin.engine && engine === null) engine = plugin.engine; // first wins
    if (plugin.eventDefinitionResolver && eventDefinitionResolver === null) {
      eventDefinitionResolver = plugin.eventDefinitionResolver; // first wins
    }
    if (plugin.lifecycleConfig) lifecycleEngine = new LifecycleEngine(plugin.lifecycleConfig);
    if (plugin.edgeRouter) {
      // Built-in name ('bezier'|'orthogonal'|'straight'|'astar') or a custom
      // function; an unknown value keeps the current router.
      edgeRouter = resolveRouter(plugin.edgeRouter, edgeRouter);
    }
  }

  return {
    registry,
    shapes,
    paletteItems,
    paletteGroups,
    edgeStyles,
    inspectorSections,
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
            const fan = (name: string, payload?: Record<string, unknown>) => {
              const event = { type: name, ts: Date.now(), ...(payload ? { meta: payload } : {}) };
              for (const handler of eventHandlers) handler(event);
            };
            fan(type, meta as Record<string, unknown> | undefined);
            // N-3 deprecation grace: renamed events keep emitting under the
            // old name for one minor, with a single console warning.
            if (type === 'element.added' && (meta as { kind?: string } | undefined)?.kind === 'node') {
              warnDeprecatedAliasOnce('node.created', 'element.added');
              fan('node.created', {
                nodeType: (meta as { elementType?: string } | undefined)?.elementType,
              });
            }
          },
    autosave,
    engine,
    eventDefinitionResolver,
  };
}

/** One console warning per deprecated alias per session (N-3 contract). */
const warnedAliases = new Set<string>();
function warnDeprecatedAliasOnce(oldName: string, newName: string): void {
  if (warnedAliases.has(oldName)) return;
  warnedAliases.add(oldName);
  console.warn(
    `[bpmn-react] o evento '${oldName}' está deprecado e será removido na próxima major — ` +
      `escute '${newName}' (contrato de estabilidade N-3).`,
  );
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
