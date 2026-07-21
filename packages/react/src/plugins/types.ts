import type { ComponentType, ReactNode } from 'react';
import type {
  BpmnDiagram,
  BpmnNode,
  Command,
  EdgeGeometry,
  EventDefinitionRefKind,
  LifecycleConfig,
  NodeTypeDefinition,
  Point,
  Rect,
  RuleEngine,
  ValidationRule,
} from '@buildtovalue/core';

export interface ShapeProps {
  node: BpmnNode;
  selected: boolean;
}

export type ShapeComponent = ComponentType<ShapeProps>;

/**
 * A plugin-contributed inspector section (Handoff 5 wireframe 2d): rendered
 * inside the PropertiesPanel under the built-in fields whenever the selected
 * node matches `appliesTo` — e.g. the DMN "Decisão" section on
 * businessRuleTask.
 */
export interface InspectorSection {
  id: string;
  appliesTo: (node: BpmnNode) => boolean;
  component: ComponentType<{ node: BpmnNode }>;
  /**
   * Squad Lane SL-5 — when present, the section renders as its OWN REGISTERED
   * TAB (a tab button + panel) instead of inline in the General tab. `label` is
   * display text the plugin localizes. Sections without `tab` keep rendering
   * inline exactly as before (additive, MINOR).
   */
  tab?: { id: string; label: string };
}

/**
 * What a composite palette item's {@link PaletteItem.build} factory receives:
 * the CURRENT diagram, the node-type registry and the insertion position the
 * host computed (viewport center + snap/jitter). `t` resolves i18n defaults
 * (e.g. the E-2 default definition names).
 */
export interface PaletteBuildContext {
  diagram: BpmnDiagram;
  registry: import('@buildtovalue/core').NodeTypeRegistry;
  x: number;
  y: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}

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
  /**
   * COMPOSITE factory (Handoff 17 ES-2, documented public surface): when
   * present, inserting this item executes the returned command (usually a
   * `compositeCommand` — one undo) instead of a plain addNode, and selects
   * `selectId` afterwards. The palette click AND the ⌘K entry resolve through
   * this ONE factory (`paletteInsertCommand`) — never two code paths. A build
   * may DECLINE the insert (Handoff 18 §5b reforço 7: a boundary dropped away
   * from a host) by returning `{ veto }` — the caller announces it on the 🔒
   * channel instead of creating an orphan node.
   */
  build?: (ctx: PaletteBuildContext) => PaletteInsertResult;
}

/** Result of a palette {@link PaletteItem.build}: a command to run, or a declared veto. */
export type PaletteInsertResult =
  | { command: Command; selectId: string }
  | { veto: string };

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

/**
 * Optional routing context (Handoff 10 R-2a). Obstacle-avoiding routers (the
 * built-in `astar`) read the other node bounds and already-routed edges from
 * here; the cheap built-ins (`bezier`/`orthogonal`/`straight`) ignore it. The
 * parameter is optional, so a pre-existing two-argument `(source, target)`
 * router keeps working unchanged.
 */
export interface EdgeRouterContext {
  /** Node bounds to route around (excludes the two endpoints). */
  obstacles: Rect[];
  /** Waypoints of already-routed edges, for the crossing cost. */
  routedEdges: Point[][];
}

export type EdgeRouterFn = (
  source: Rect,
  target: Rect,
  context?: EdgeRouterContext,
) => EdgeGeometry;

/**
 * The PUBLIC editor event catalog (Handoff 11 N-3) — the complete, stable
 * vocabulary the editor emits through the plugin `onEditorEvent` channel
 * (same injected callback as always: no global emitter, zero deps).
 *
 * STABILITY CONTRACT (semver): adding an event = minor; changing an event's
 * payload = MAJOR; renaming an event = the old name keeps emitting alongside
 * the new one for at least one minor, with a single console deprecation
 * warning (see {@link DEPRECATED_EVENT_ALIASES}), then is removed in the
 * next major.
 */
export const EDITOR_EVENTS = [
  'diagram.loaded',
  'element.added',
  'element.changed',
  'element.removed',
  'edge.connected',
  'selection.changed',
  'command.executed',
  'command.undone',
  'validation.changed',
  'promotion.completed',
  'import.warning',
  'render.slow',
  'shape.render.error',
  // Handoff 15 (review) — V-0 decision 5: the catalog grows to 16 with the
  // three review.* events (additive = minor per the stability contract).
  'review.thread.opened',
  'review.thread.resolved',
  'review.changes.requested',
] as const;

export type EditorEventName = (typeof EDITOR_EVENTS)[number];

/**
 * Typed payloads, one per catalog event. Hosts narrow `event.meta` by
 * `event.type`; the emit side is typed against this map.
 */
export interface EditorEventPayloads {
  /** A diagram entered the editor (mount or `replaceDiagram`/import). */
  'diagram.loaded': { diagramId: string; name: string; nodes: number; edges: number };
  /** A node/edge was added by a command. */
  'element.added': { id?: string; elementType?: string; kind: 'node' | 'edge' };
  /** A node/edge changed (update/move/resize/attach…); composites report coarse. */
  'element.changed': { id?: string; elementType?: string; composite?: boolean; description?: string };
  /** A node/edge was removed by a command. */
  'element.removed': { id?: string; elementType?: string; kind: 'node' | 'edge' };
  /** The connect gesture created an edge. */
  'edge.connected': { edgeType: string; sourceId: string; targetId: string };
  /** The canvas selection changed. */
  'selection.changed': { selectedIds: string[] };
  /** A command was applied (redo re-emits it — a redo re-executes). */
  'command.executed': { commandId: string; description: string; auditType?: string };
  /** The last command was undone. */
  'command.undone': { description?: string };
  /** A Validate pass produced a (possibly different) issue set. */
  'validation.changed': { errors: number; warnings: number; codes: string[] };
  /** The formal promotion flow activated a version. */
  'promotion.completed': { semanticVersion: string; status: string; ledgerHash?: string };
  /** The HOST's XML import produced a warning (hosts emit this one). */
  'import.warning': { message: string };
  /** A frame took longer than the render budget. */
  'render.slow': { frameMs: number };
  /** A shape component threw during render (error boundary caught it). */
  'shape.render.error': { nodeId: string; nodeType: string; message: string };
  /** A review thread was opened on an element (Handoff 15 §2c). */
  'review.thread.opened': { threadId: string; elementId: string };
  /** A review thread was resolved (Handoff 15 §2c). */
  'review.thread.resolved': { threadId: string };
  /** A signed "request changes" was issued (Handoff 15 §2e — emitted by V-6). */
  'review.changes.requested': { versionId: string; threadRefs: string[] };
}

/**
 * Deprecated event names (N-3 rename to the public catalog): each old name
 * keeps emitting ALONGSIDE its replacement for one minor, with a single
 * console warning per session, and disappears in the next major.
 */
export const DEPRECATED_EVENT_ALIASES = {
  /** Old palette-insert event — superseded by `element.added` (kind: 'node'). */
  'node.created': 'element.added',
} as const;

/**
 * Context-menu invocation target (Handoff 11 N-5): what was right-clicked /
 * long-pressed / keyboard-opened, with enough context for `when()` guards.
 */
export interface MenuTarget {
  kind: 'node' | 'edge' | 'canvas';
  /** The node/edge id (absent for the empty canvas). */
  id?: string;
  /** World coordinates of the invocation point. */
  point: { x: number; y: number };
  diagram: BpmnDiagram;
  selectedIds: string[];
}

/**
 * One pluggable context-menu item (Handoff 11 N-5). The contract is
 * deliberately narrow: `run` receives ONLY a command dispatcher — actions go
 * through commands (undoable, audited); there is no direct state access.
 */
export interface ContextMenuItem {
  id: string;
  label: string;
  /** Guard: the item only renders when it returns true (omitted → always). */
  when?: (target: MenuTarget) => boolean;
  /** Dispatches commands through `execute` — the menu never mutates state. */
  run: (target: MenuTarget, api: { execute: (command: Command) => unknown }) => void;
}

/**
 * One pluggable context-pad action (Handoff 14 §1a) — the pad's 5th slot.
 * Same narrow contract as {@link ContextMenuItem}, plus a single-character
 * glyph rendered inside the pad button (an emoji or symbol; the full label
 * stays in the tooltip/aria).
 */
export interface ContextPadItem extends ContextMenuItem {
  /** One character/emoji drawn in the 26px button (e.g. '🤖'). */
  glyph: string;
}

/**
 * Editor observability event (Handoff 2 §2, catalog completed in Handoff 11
 * N-3). `type` is one of {@link EDITOR_EVENTS} — or a deprecated alias from
 * {@link DEPRECATED_EVENT_ALIASES} during its grace minor. The host decides
 * what to do with it (log, measure lead time, count import warnings). No
 * telemetry, no deps.
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
  /** Arrowhead at the target end. Default 'filled'. 'disc' is the DMN
   * authority-requirement tip (filled circle r 3.5). */
  marker?: 'filled' | 'open' | 'double-chevron' | 'disc' | 'none';
  /** Routing override for this edge type: 'straight' draws a border-anchored
   * line (DMN DRD requirement edges). Default: the editor's router. */
  routing?: 'straight';
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
  /**
   * The 40°-step of the 9-hue BTV wheel this domain/notation family claims
   * (Handoff 5 §7.3-7.4, e.g. DMN = 185, Healthcare = 305; free: 65, 105).
   * Two registered plugins on the same step trigger a build warning in
   * `resolveEditorConfig`.
   */
  colorWheelDegree?: number;
  /**
   * Declared body color of the domain (a `var(--…, #hex)` expression). The
   * plugin lint rejects gold and green as body colors — they are reserved
   * for governance/value and approval/selection (§10.3).
   */
  bodyColor?: string;
  /** Domain node types registered into the editor's NodeTypeRegistry. */
  nodeTypes?: NodeTypeDefinition[];
  /** Shape components keyed by node type. */
  shapes?: Record<string, ShapeComponent>;
  /** Extra palette entries. */
  paletteItems?: PaletteItem[];
  /** Inspector sections rendered for matching selected nodes. */
  inspectorSections?: InspectorSection[];
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
  /** Edge routing override: built-in name or custom function. `astar` is the
   * obstacle-avoiding router (Handoff 10); `straight` is the plain direct line. */
  edgeRouter?: 'bezier' | 'orthogonal' | 'straight' | 'astar' | EdgeRouterFn;
  /** Transforms the diagram before it is exported/saved. */
  onBeforeSave?: (diagram: BpmnDiagram) => BpmnDiagram;
  /** Transforms the diagram right after an import/load. */
  onAfterLoad?: (diagram: BpmnDiagram) => BpmnDiagram;
  /** Observability sink — receives editor events (all providers are called). */
  onEditorEvent?: EditorEventHandler;
  /**
   * Pluggable context-menu items (Handoff 11 N-5): called with the invocation
   * target; returned items render in the plugin's own section (kicker = the
   * plugin id), after each item's `when()` guard. Actions dispatch commands
   * only — the menu never mutates state directly.
   */
  contextMenuItems?: (target: MenuTarget) => ContextMenuItem[];
  /**
   * Context-pad slot (Handoff 14 §1a): the FIRST returned item (after `when`
   * filtering) takes the pad's 5th button; the rest are reachable via ⋯,
   * which opens the full context menu.
   */
  contextPadItems?: (target: MenuTarget) => ContextPadItem[];
  /**
   * Editor resilience opt-out: `false` disables autosave, the recovery
   * banner and the beforeunload guard. Default true; last plugin wins.
   */
  autosave?: boolean;
  /**
   * Execution-engine bridge (Handoff 14 §1f): registering one turns on the
   * "Execução" tab of the properties panel for executable activities. First
   * plugin providing one wins (same rule as `lifecycleConfig`). Actual
   * deployment stays HOST-owned and GATED — see {@link EngineBridge}.
   */
  engine?: EngineBridge;
  /**
   * Governed event-definition resolution (Handoff 16 §3b): registering one
   * turns on the "Da Biblioteca" section of the event picker and the
   * vigência chip/seal on the canvas. First plugin providing one wins. The
   * editor NEVER consults a registry — resolution is host-owned; without a
   * resolver the degradation is declared (binding renders as text + notice).
   */
  eventDefinitionResolver?: EventDefinitionResolver;
}

/** One catalog entry the picker's Biblioteca section lists. */
export interface EventDefinitionCatalogEntry {
  /** Artifact name — the `nome` half of `nome@semver`. */
  name: string;
  semanticVersion: string;
  /** Lifecycle status of that version ('active' = VIGENTE seal). */
  status: string;
}

/** A governed ref resolved to its definition payload. */
export interface ResolvedEventDefinition extends EventDefinitionCatalogEntry {
  definition: { name: string; errorCode?: string; escalationCode?: string };
}

/**
 * Host-injected resolver of governed event-definition refs (§3b — the
 * resolveCallActivities/EngineBridge mold): SYNCHRONOUS, the host preloads.
 * `ref` is the canonical `nome@semver` string. The BINDING PINS the exact
 * version: a newer artifact version never moves an existing binding — only
 * an explicit ref change does (audited by the host's ledger glue).
 */
export interface EventDefinitionResolver {
  /** Entries offered in the picker's "Da Biblioteca" section, per kind. */
  list(kind: EventDefinitionRefKind): EventDefinitionCatalogEntry[];
  /** Resolve a pinned `nome@semver` ref; undefined → SIG_REF_MISSING. */
  resolve(ref: string, kind: EventDefinitionRefKind): ResolvedEventDefinition | undefined;
}

/**
 * Execution-engine bridge (Handoff 14 §1f). The editor renders the
 * "Execução" tab (progressive disclosure: essentials visible, the rest
 * foldable) and GATES deploy: only an ACTIVE (VIGENTE) **and signed** version
 * may deploy; anything else gets the "⚑ Deploy bloqueado → Ir para promoção"
 * card. The signature truth and the deploy transport are host-owned —
 * network integration is deliberately out of editor scope (§3).
 */
export interface EngineBridge {
  /** Engine id, e.g. 'zeebe', 'camunda7'. Prefixes default property keys. */
  id: string;
  /** Display name in the tab header, e.g. 'Camunda 8 (Zeebe)'. */
  name?: string;
  /** Property key of the ESSENTIAL job-type binding. Default `<id>:taskDefinitionType`. */
  jobTypeKey?: string;
  /** Property key of the retries field. Default `<id>:retries`. */
  retriesKey?: string;
  /**
   * Event I/O keys (Handoff 16 E-4, §3c) — the engine names WHERE the props
   * live; WHICH events carry them is OMG semantics (`eventExecutionModeOf`).
   * Payload mappings (throw events only). Default `<id>:payload`.
   */
  payloadKey?: string;
  /** Error-code capture variable (error catches only). Default `<id>:errorCodeVariable`. */
  errorCodeVariableKey?: string;
  /** Error-message capture variable (error catches only). Default `<id>:errorMessageVariable`. */
  errorMessageVariableKey?: string;
  /**
   * Host-owned truth: is the CURRENT version's activation signed (identity
   * package / host ledger)? Gates deploy together with `status === 'active'`.
   * Absent → treated as NOT signed (deploy stays blocked).
   */
  isSigned?: (diagram: BpmnDiagram) => boolean;
  /** Deploy transport — only invoked when the gate passes. */
  deploy?: (diagram: BpmnDiagram) => void | Promise<void>;
  /** "Ir para promoção →" navigation on the blocked card (host-owned). */
  onRequestPromotion?: () => void;
}
