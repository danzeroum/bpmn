/**
 * `@buildtovalue/react/viewer` — the lightweight, tree-shakeable read-only
 * entry point (Handoff 11 N-7). Importing from here pulls ONLY the render
 * substrate (shapes, geometry, contexts) plus pan/zoom — never the editor graph
 * (useInteractions, toolbar, palette, inspector, command-stack UI, resilience,
 * context menu, exporters). A dep-graph test enforces that boundary and a size
 * test proves the viewer bundle is ≤50% of the editor entry.
 */
export { BpmnViewer } from './viewer/BpmnViewer.js';
export type { BpmnViewerProps } from './viewer/BpmnViewer.js';
export { BpmnDiffViewer } from './viewer/BpmnDiffViewer.js';
export type { BpmnDiffViewerProps } from './viewer/BpmnDiffViewer.js';
export { ViewerCanvas } from './viewer/ViewerCanvas.js';
export type { ViewerCanvasProps } from './viewer/ViewerCanvas.js';

// i18n so a viewer-only consumer can inject a dictionary without importing the
// editor entry (which is where PT_BR/EN would otherwise live).
export { I18nProvider, useT } from './i18n/I18nContext.js';
export { EN } from './i18n/en.js';
export { PT_BR } from './i18n/ptBR.js';
export type { Messages, TFunction, TParams } from './i18n/messages.js';
