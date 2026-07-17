import type { ReactNode } from 'react';
import type { BpmnDiagram } from '@buildtovalue/core';
import {
  EditorConfigProvider,
  useEditorConfig,
} from '../contexts/EditorConfigContext.js';
import { DiagramProvider } from '../contexts/DiagramContext.js';
import { CanvasProvider } from '../contexts/CanvasContext.js';
import { I18nProvider } from '../i18n/I18nContext.js';
import { VersionBanner } from '../ui/VersionBanner.js';
import type { Messages } from '../i18n/messages.js';
import type { BpmnPlugin } from '../plugins/types.js';
import { ViewerCanvas, type ViewerCanvasProps } from './ViewerCanvas.js';

export interface BpmnViewerProps {
  diagram: BpmnDiagram;
  /**
   * Plugins supplying shapes / node types / edge styles for RENDERING only.
   * The viewer never runs edit interactions, so interaction/command plugin
   * surfaces are inert here.
   */
  plugins?: BpmnPlugin[];
  /** Extra SVG overlay content in world coordinates (read-only annotations). */
  overlay?: ReactNode;
  /** Render closed (removedInVersion) elements. Default true. */
  showClosed?: boolean;
  /** Injected UI dictionary (Handoff 11 N-6). Omitted → English / outer provider. */
  messages?: Messages;
  /** Diff painting per element (Handoff 15 §2a) — see ViewerCanvasProps. */
  diffStates?: ViewerCanvasProps['diffStates'];
}

function ViewerBody({
  diagram,
  overlay,
  showClosed,
  diffStates,
}: Pick<BpmnViewerProps, 'diagram' | 'overlay' | 'showClosed' | 'diffStates'>) {
  const config = useEditorConfig();
  return (
    <DiagramProvider
      diagram={diagram}
      ruleEngine={config.ruleEngine}
      edgeRouter={config.edgeRouter}
      emitEditorEvent={config.emitEditorEvent}
    >
      {/* Read-only from birth: no gesture can mutate the diagram. */}
      <CanvasProvider initial={{ readOnly: true }}>
        <div className="bpmnr-viewer" style={{ position: 'relative', width: '100%', height: '100%' }}>
          <ViewerCanvas overlay={overlay} showClosed={showClosed} diffStates={diffStates} />
          {/* Read-only governance seal (selo): version + lock + closed count.
              Self-gating — paints only in read-only / superseded contexts. */}
          <VersionBanner />
        </div>
      </CanvasProvider>
    </DiagramProvider>
  );
}

/**
 * Lightweight, tree-shakeable read-only viewer (Handoff 11 N-7). Renders a
 * governed diagram with pan / wheel-zoom and read-only overlays (seals, ⚠) —
 * and nothing else: no editor, no command stack UI, no palette, no inspector,
 * no toolbar, no edit interactions. Import it from `@buildtovalue/react/viewer`
 * to keep the editor graph out of the bundle; the same component is also
 * re-exported from the package root for drop-in compatibility.
 *
 * The render is byte-identical to `<BpmnDesigner readOnly>` (proven by
 * viewerEquivalence.test), so swapping a heavy read-only editor for this viewer
 * changes bundle size, never pixels.
 */
export function BpmnViewer({ diagram, plugins, overlay, showClosed, messages, diffStates }: BpmnViewerProps) {
  const body = (
    <EditorConfigProvider plugins={plugins}>
      <ViewerBody diagram={diagram} overlay={overlay} showClosed={showClosed} diffStates={diffStates} />
    </EditorConfigProvider>
  );
  // Compose, don't shadow (N-6): provide a dictionary only when given one,
  // otherwise defer to an outer <I18nProvider> or the English default.
  return messages !== undefined ? <I18nProvider messages={messages}>{body}</I18nProvider> : body;
}
