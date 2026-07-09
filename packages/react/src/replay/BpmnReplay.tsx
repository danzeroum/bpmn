import type { BpmnDiagram } from '@bpmn-react/core';
import type { Trace } from '@bpmn-react/replay';
import { BpmnEditor } from '../BpmnEditor.js';
import type { BpmnPlugin } from '../plugins/types.js';
import { useReplay } from './useReplay.js';
import { ReplayOverlaySvg } from './ReplayOverlaySvg.js';
import { ReplayPanel } from './ReplayPanel.js';
import { formatDuration } from './format.js';

export interface BpmnReplayProps {
  diagram: BpmnDiagram;
  /** Parsed event-log traces to replay against `diagram`. */
  traces: Trace[];
  /** Log file name shown in the panel header. */
  fileName?: string;
  plugins?: BpmnPlugin[];
  /** Leaves replay mode (the header "← Simulador" / exit control). */
  onExit?: () => void;
}

/**
 * Replay mode as a drop-in surface: a read-only `BpmnEditor` with the
 * frequency heatmap, ⌀ time chips, clickable deviations and the sampled-variant
 * token on the canvas, the 306px replay panel in place of the inspector, and
 * the violet "MODO REPLAY" pill. Simulated (blue) and real (violet) data never
 * mix — different pill, different token colour (§9). All numbers come from the
 * headless `@bpmn-react/replay` aggregation via {@link useReplay}.
 */
export function BpmnReplay({ diagram, traces, fileName = 'event-log.xes', plugins, onExit }: BpmnReplayProps) {
  const replay = useReplay(diagram, traces, formatDuration);
  const nodeLabel = (id: string) => diagram.nodes[id]?.label || id;

  const pill = (
    <div className="bpmnr-sim-toolbar-extra">
      <span className="bpmnr-replay-pill" data-replay-pill>
        MODO REPLAY
      </span>
      {onExit && (
        <button type="button" className="bpmnr-sim-exit" data-replay-exit onClick={onExit}>
          ← Simulador
        </button>
      )}
    </div>
  );

  return (
    <BpmnEditor
      diagram={diagram}
      plugins={plugins}
      readOnly
      hideInspector
      hidePalette
      toolbarExtra={pill}
      overlay={
        <ReplayOverlaySvg
          log={replay.log}
          selectedDeviation={replay.selectedDeviation}
          onSelectDeviation={replay.selectDeviation}
          variantTokenNodeId={replay.variantTokenNodeId}
        />
      }
    >
      <div className="bpmnr-replay-legend" data-replay-legend>
        <span><span className="bpmnr-replay-legend-thick" /> frequência (espessura)</span>
        <span><span className="bpmnr-replay-legend-dash" /> desvio do modelo</span>
        <span><span className="bpmnr-replay-legend-chip">⌀</span> tempo médio</span>
      </div>
      <div className="bpmnr-replay-panel-slot">
        <ReplayPanel
          fileName={fileName}
          log={replay.log}
          nodeLabel={nodeLabel}
          selectedDeviation={replay.selectedDeviation}
          onSelectDeviation={replay.selectDeviation}
          playingVariant={replay.playingVariant}
          onPlayVariant={replay.playVariant}
          onStopVariant={replay.stopVariant}
        />
      </div>
    </BpmnEditor>
  );
}
