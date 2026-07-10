import type { ReactNode } from 'react';
import type { BpmnDiagram } from '@buildtovalue/core';
import { EditorConfigProvider, resolveEditorConfig, useEditorConfig } from './contexts/EditorConfigContext.js';
import { DiagramProvider } from './contexts/DiagramContext.js';
import { CanvasProvider } from './contexts/CanvasContext.js';
import { BpmnCanvas } from './canvas/Canvas.js';
import { ResilienceLayer } from './canvas/ResilienceLayer.js';
import { VersionBanner } from './ui/VersionBanner.js';
import { ContextMenu } from './ui/ContextMenu.js';
import { I18nProvider } from './i18n/I18nContext.js';
import type { Messages } from './i18n/messages.js';
import type { BpmnPlugin } from './plugins/types.js';

export interface BpmnDesignerProps {
  /** Initial diagram. Subsequent edits flow through the command stack. */
  diagram: BpmnDiagram;
  plugins?: BpmnPlugin[];
  onChange?: (diagram: BpmnDiagram) => void;
  readOnly?: boolean;
  /**
   * Extra UI rendered inside the designer chrome (Palette, Toolbar,
   * PropertiesPanel, MiniMap are exported separately and can be composed
   * freely; `<BpmnEditor>` bundles the default arrangement).
   */
  children?: ReactNode;
  /** Extra SVG overlay content in world coordinates. */
  overlay?: ReactNode;
  /** Render closed (removedInVersion) elements. Default true. */
  showClosed?: boolean;
  /**
   * Injected UI dictionary (Handoff 11 N-6). Omitted → English. The host owns
   * locale choice: pass `PT_BR` (or a custom dictionary) to switch languages;
   * missing keys fall back to English. There is no automatic locale detection.
   */
  messages?: Messages;
}

function DesignerBody({
  diagram,
  onChange,
  readOnly,
  children,
  overlay,
  showClosed,
}: Omit<BpmnDesignerProps, 'plugins' | 'messages'>) {
  const config = useEditorConfig();
  return (
    <DiagramProvider
      diagram={diagram}
      ruleEngine={config.ruleEngine}
      edgeRouter={config.edgeRouter}
      onChange={onChange}
      emitEditorEvent={config.emitEditorEvent}
    >
      <CanvasProvider initial={{ readOnly: readOnly ?? false }}>
        <div className="bpmnr-designer" style={{ position: 'relative', width: '100%', height: '100%' }}>
          <BpmnCanvas overlay={overlay} showClosed={showClosed} />
          <ContextMenu />
          {/* Version context banner — self-gating (read-only / superseded). */}
          <VersionBanner />
          {!(readOnly ?? false) && <ResilienceLayer />}
          {children}
        </div>
      </CanvasProvider>
    </DiagramProvider>
  );
}

/**
 * Full editing surface: canvas + gestures + command stack + plugin system.
 * Compose UI panels as children, or use `<BpmnEditor>` for the batteries-
 * included arrangement.
 */
export function BpmnDesigner({ plugins, messages, ...rest }: BpmnDesignerProps) {
  const body = (
    <EditorConfigProvider plugins={plugins}>
      <DesignerBody {...rest} />
    </EditorConfigProvider>
  );
  // Compose, don't shadow (N-6): only mount our own dictionary provider when a
  // `messages` prop is given. Without one, defer to an outer <I18nProvider>
  // (e.g. a host wrapping <BpmnSimulator>/<BpmnReplay>) — or the English default
  // when there is none. Unconditionally re-providing here would reset any outer
  // dictionary to English for the whole editor subtree.
  return messages !== undefined ? <I18nProvider messages={messages}>{body}</I18nProvider> : body;
}

export interface BpmnViewerProps {
  diagram: BpmnDiagram;
  plugins?: BpmnPlugin[];
  overlay?: ReactNode;
  showClosed?: boolean;
  /** Injected UI dictionary (Handoff 11 N-6). Omitted → English. */
  messages?: Messages;
}

/** Read-only rendering of a diagram (no gestures that mutate state). */
export function BpmnViewer({ diagram, plugins, overlay, showClosed, messages }: BpmnViewerProps) {
  return (
    <BpmnDesigner
      diagram={diagram}
      plugins={plugins}
      readOnly
      overlay={overlay}
      showClosed={showClosed}
      messages={messages}
    />
  );
}

export { resolveEditorConfig };
