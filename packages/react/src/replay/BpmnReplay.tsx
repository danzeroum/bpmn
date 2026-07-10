import { useMemo, useState } from 'react';
import type { BpmnDiagram } from '@buildtovalue/core';
import { summarizeReplay, type ReplayAnalysis, type Trace } from '@buildtovalue/replay';
import { BpmnEditor } from '../BpmnEditor.js';
import type { BpmnPlugin } from '../plugins/types.js';
import { useReplay } from './useReplay.js';
import { ReplayOverlaySvg } from './ReplayOverlaySvg.js';
import { ReplayPanel } from './ReplayPanel.js';
import { formatDuration } from './format.js';

/** A version the log can be filtered to, with its bound-run count (bindRun). */
export interface ReplayVersion {
  versionId: string;
  semanticVersion: string;
  /** e.g. 'candidate' — shown as "candidata" instead of a run count. */
  status?: string;
  /** Executions bound to this version (bindRun) — "N execuções". */
  runCount: number;
  /** The traces of the runs bound to this version. */
  traces: Trace[];
}

export interface BpmnReplayProps {
  diagram: BpmnDiagram;
  /** Flat traces (7B-2 mode). Ignored when `versions` is provided. */
  traces?: Trace[];
  /** Versions with bound runs for the header selector (Handoff 7B-3). */
  versions?: ReplayVersion[];
  /** The candidate whose promotion the comparison argues for. */
  candidate?: { semanticVersion: string; change: string };
  /** Attach the comparative analysis to the candidate's promotion request. */
  onAttachAnalysis?: (analysis: ReplayAnalysis) => void;
  /** Author recorded on the attached analysis. */
  author?: string;
  fileName?: string;
  plugins?: BpmnPlugin[];
  onExit?: () => void;
  /** ISO clock for the attached analysis (injectable for tests). */
  now?: () => string;
}

/**
 * Replay mode surface (Handoff 7B-2/7B-3): read-only `BpmnEditor` with the
 * frequency heatmap, ⌀ chips, deviations and the sampled-variant token, the
 * 306px replay panel, and the violet "MODO REPLAY" pill. In 7B-3 the header
 * gains a version selector (executions filtered by bindRun) and the panel a
 * comparison card whose analysis attaches to the candidate's promotion — all by
 * host injection. Simulated (blue) and real (violet) data never mix.
 */
export function BpmnReplay({
  diagram,
  traces,
  versions,
  candidate,
  onAttachAnalysis,
  author = 'replay',
  fileName = 'event-log.xes',
  plugins,
  onExit,
  now = () => new Date().toISOString(),
}: BpmnReplayProps) {
  const nodeLabel = (id: string) => diagram.nodes[id]?.label || id;

  // Default to the first version that actually has runs (else the first).
  const defaultVersionId = useMemo(
    () => versions?.find((v) => v.runCount > 0)?.versionId ?? versions?.[0]?.versionId,
    [versions],
  );
  const [selectedVersionId, setSelectedVersionId] = useState(defaultVersionId);
  const [attached, setAttached] = useState(false);

  const activeVersion = versions?.find((v) => v.versionId === selectedVersionId);
  const activeTraces = versions ? (activeVersion?.traces ?? []) : (traces ?? []);
  const replay = useReplay(diagram, activeTraces, formatDuration);

  const analysis = useMemo<ReplayAnalysis | undefined>(() => {
    if (!candidate || !activeVersion || activeTraces.length === 0) return undefined;
    return summarizeReplay(replay.log, {
      diagramId: diagram.id,
      versionId: activeVersion.versionId,
      semanticVersion: activeVersion.semanticVersion,
      author,
      timestamp: now(),
      label: nodeLabel,
      formatMs: formatDuration,
      candidateSemanticVersion: candidate.semanticVersion,
      candidateChange: candidate.change,
    });
  }, [candidate, activeVersion, activeTraces, replay.log, diagram, author]);

  const selectVersion = (versionId: string) => {
    setSelectedVersionId(versionId);
    setAttached(false);
  };

  const comparison =
    analysis && candidate
      ? {
          headline: analysis.headline,
          candidateSemanticVersion: candidate.semanticVersion,
          attached,
          onAttach: onAttachAnalysis
            ? () => {
                onAttachAnalysis(analysis);
                setAttached(true);
              }
            : undefined,
        }
      : undefined;

  const pill = (
    <div className="bpmnr-sim-toolbar-extra">
      {versions && versions.length > 0 && (
        <div className="bpmnr-replay-versions" data-replay-versions role="tablist">
          {versions.map((version) => (
            <button
              key={version.versionId}
              type="button"
              role="tab"
              aria-selected={version.versionId === selectedVersionId}
              data-replay-version={version.versionId}
              data-active={version.versionId === selectedVersionId || undefined}
              className="bpmnr-replay-version"
              onClick={() => selectVersion(version.versionId)}
            >
              v{version.semanticVersion} ·{' '}
              {version.runCount > 0
                ? `${version.runCount.toLocaleString('pt-BR')} execuções`
                : (version.status === 'candidate' ? 'candidata' : 'sem execuções')}
            </button>
          ))}
        </div>
      )}
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
          {...(comparison ? { comparison } : {})}
        />
      </div>
    </BpmnEditor>
  );
}
