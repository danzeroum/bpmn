// Entry components
export * from './BpmnDesigner.js';
export * from './BpmnEditor.js';
// Lightweight read-only viewer (N-7) — re-exported here for drop-in
// compatibility; import from '@buildtovalue/react/viewer' to tree-shake the
// editor graph.
export { BpmnViewer, type BpmnViewerProps } from './viewer/BpmnViewer.js';
export { ViewerCanvas, type ViewerCanvasProps } from './viewer/ViewerCanvas.js';
export { BpmnDiffViewer, type BpmnDiffViewerProps } from './viewer/BpmnDiffViewer.js';
export { createInMemoryReviewStore, MIN_DISMISS_JUSTIFICATION } from './review/ReviewStore.js';
export type { ReviewMessage, ReviewStore, ReviewThread } from './review/ReviewStore.js';
export { reviewThreadsRule } from './review/reviewThreadsRule.js';

// Contexts & hooks
export * from './contexts/DiagramContext.js';
export * from './contexts/CanvasContext.js';
export * from './contexts/EditorConfigContext.js';

// State
export * from './state/createStore.js';
export * from './state/canvasStore.js';
export * from './state/autosave.js';

// Canvas building blocks
export * from './canvas/Canvas.js';
export * from './canvas/NodeRenderer.js';
export * from './canvas/ShapeErrorBoundary.js';
export * from './canvas/NodeLabelEditor.js';
export * from './canvas/EdgeRenderer.js';
export * from './canvas/SettlingOverlay.js';
export * from './canvas/Defs.js';
export * from './canvas/overlays.js';
// Handoff 16 E-3 (§3b) — governed event-definition bindings (nome@semver).
export * from './canvas/eventBinding.js';
export * from './canvas/viewport.js';
export * from './canvas/useInteractions.js';
export * from './canvas/routers.js';
export * from './canvas/routeEdge.js';

// Agent Lane (Handoff 12) — Agent Studio
export { AgentStudio, type AgentStudioProps, type AgentSimulationRecord } from './agent/AgentStudio.js';
export { proposeErrorBoundaryCommand } from './agent/agentBoundary.js';
// Squad Lane (Handoff 22) SL-2 — host-injected tool provider
export { createToolProvider, type ToolProvider } from './agent/toolProvider.js';
// Squad Lane (Handoff 22) SL-7 — host-injected prompt provider
export { createPromptProvider, type PromptProvider } from './agent/promptProvider.js';
export * from './agent/agentEditor.js';

// Simulation (Handoff 7A)
export * from './simulation/BpmnSimulator.js';
export * from './simulation/SimulationPanel.js';
export * from './simulation/SimulationOverlaySvg.js';
export * from './simulation/GatewayChoiceCard.js';
export * from './simulation/useSimulation.js';
export * from './simulation/edgePath.js';

// Replay (Handoff 7B)
export * from './replay/BpmnReplay.js';
export * from './replay/ReplayPanel.js';
export * from './replay/ReplayOverlaySvg.js';
export * from './replay/useReplay.js';
export * from './replay/diagramToReplayGraph.js';
export * from './replay/format.js';

// Gestures
export * from './gestures/useKeyboardShortcuts.js';

// Shapes
export * from './shapes/index.js';

// Plugins
export * from './plugins/types.js';

// UI
export * from './ui/paletteItems.js';
// Handoff 17 ES-2 (§4b) — the ONE palette insert factory (documented surface).
export {
  buildCompensationPairInsert,
  buildEscalationBoundaryInsert,
  buildEventSubprocessInsert,
  insertPaletteItem,
  paletteInsertCommand,
  paletteItemLabel,
} from './ui/paletteInsert.js';
export * from './ui/Palette.js';
export * from './ui/PropertiesPanel.js';
export * from './ui/Toolbar.js';
export * from './ui/MiniMap.js';
export * from './ui/StatusBadge.js';
export * from './ui/SignatureBadge.js';
export * from './ui/CanonicalPayloadCard.js';
export * from './ui/AnchorSeal.js';
export * from './ui/useAnchorCycle.js';
export * from './ui/approvalPayload.js';
export * from './ui/DiffView.js';
export * from './ui/PromotionPanel.js';
export * from './ui/LedgerStatus.js';
export * from './ui/GovernanceBreadcrumb.js';
export * from './gestures/useDismissal.js';
export * from './ui/VersionTimeline.js';
export * from './ui/VersionBanner.js';
export * from './ui/EdgePedigree.js';
export * from './ui/exporters.js';
export * from './copilot/CopilotPanel.js';
export * from './ui/ContextMenu.js';
export * from './canvas/EdgeLabelEditor.js';

// i18n (Handoff 11 N-6): injected dictionary, EN fallback, useT/t.
export * from './i18n/messages.js';
export * from './i18n/I18nContext.js';
export { EN } from './i18n/en.js';
export { PT_BR } from './i18n/ptBR.js';

// Optional off-thread compute (Handoff 11 N-8): sync default + worker opt-in.
export * from './workers/executor.js';
export * from './workers/jobs.js';

export { SearchPanel } from './ui/SearchPanel.js';
export { CommandPalette, paletteEntries, fuzzyScore } from './ui/CommandPalette.js';
export { Cheatsheet } from './ui/Cheatsheet.js';
export { EmptyState, buildGovernedExample } from './ui/EmptyState.js';
export { EventDefinitionSection, eventKindOf } from './ui/EventDefinitionSection.js';
// Handoff 16 E-5 (§3d) — timer editor with human preview.
export { TimerSection, isTimerEvent, formatTimerPreview } from './ui/TimerSection.js';
// Handoff 17 ES-3 (§4c) — event-subprocess start toggle.
export {
  hasInterruptingToggle,
  InterruptingToggle,
  isEventSubprocessStart,
} from './ui/InterruptingToggle.js';
// Handoff 16 E-4 (§3c) — executable-event matrix + payload helpers.
export {
  eventExecutionModeOf,
  payloadMappingsOf,
  prunePayloadMappings,
  type EventExecutionMode,
  type PayloadMapping,
} from './ui/eventExecution.js';
export * from './commands/menuRegistry.js';
export * from './commands/globalCommands.js';
export { KEYBOARD_SHORTCUT_CATALOG, type ShortcutCatalogEntry } from './gestures/useKeyboardShortcuts.js';
export { LintPanel } from './ui/LintPanel.js';
export type { LintPanelProps } from './ui/LintPanel.js';
export { LayoutProposalCard } from './ui/LayoutProposalCard.js';
export { buildLayoutProposal } from './canvas/arrange.js';
export type { LayoutMove, LayoutProposal } from './canvas/arrange.js';
