import { useCallback, useState, type ReactNode } from 'react';
import type { BpmnDiagram } from '@bpmn-react/core';
import { buildSession, coveragePercent, type SimulationSession } from '@bpmn-react/simulation';
import { BpmnEditor } from '../BpmnEditor.js';
import type { BpmnPlugin } from '../plugins/types.js';
import { useSimulation } from './useSimulation.js';
import { SimulationOverlaySvg } from './SimulationOverlaySvg.js';
import { SimulationPanel } from './SimulationPanel.js';
import { GatewayChoiceCard } from './GatewayChoiceCard.js';

export interface BpmnSimulatorProps {
  diagram: BpmnDiagram;
  plugins?: BpmnPlugin[];
  /** Leaves simulation mode (the "Sair da simulação" control). */
  onExit?: () => void;
  /**
   * Register the session in the ledger (Handoff 7A-3). Receives the built
   * {@link SimulationSession} (roteiro + coverage + version + author/timestamp);
   * the host maps it to a ledger entry / SACM evidence / library artifact by
   * injection. Button hides when absent.
   */
  onRecord?: (session: SimulationSession) => void | Promise<void>;
  /** Author recorded on the session (defaults to "anônimo"). */
  author?: string;
  /**
   * Confirmation content after a successful registration. When omitted a
   * default confirmation (roteiro #hash + the SACM evidence line) is shown.
   */
  recordedInfo?: ReactNode;
}

/**
 * Simulation mode as a drop-in surface: a read-only `BpmnEditor` with the
 * token overlay on the canvas, the touch-first gateway choice card at the
 * base, the 300px simulation panel in place of the inspector, and the blue
 * "MODO SIMULAÇÃO" pill. All behavior comes from the headless engine via
 * {@link useSimulation}; nothing here mutates the diagram. Registration is
 * pure injection — the session artifact is built here and handed to
 * {@link BpmnSimulatorProps.onRecord}.
 */
export function BpmnSimulator({
  diagram,
  plugins,
  onExit,
  onRecord,
  author = 'anônimo',
  recordedInfo,
}: BpmnSimulatorProps) {
  const sim = useSimulation(diagram);
  const { state } = sim;
  const choice = state.pendingChoice;
  const gatewayLabel = choice ? diagram.nodes[choice.nodeId]?.label || choice.nodeId : '';
  const [recorded, setRecorded] = useState<SimulationSession | null>(null);

  const handleRecord = useCallback(async () => {
    const session = await buildSession(sim.engine.scenario, sim.coverage, {
      author,
      timestamp: new Date().toISOString(),
    });
    await onRecord?.(session);
    setRecorded(session);
  }, [sim.engine, sim.coverage, author, onRecord]);

  const advanceLabel = state.deadlocked
    ? 'Deadlock — sem saída'
    : state.complete
      ? 'Fim do caminho'
      : choice
        ? 'Escolha no gateway…'
        : '▶ Avançar token';

  const defaultRecordedInfo = recorded ? (
    <>
      <strong>✓ Sessão registrada</strong> · roteiro <code>#{recorded.scenarioHash}</code>
      <br />
      Vira evidence no assurance case (SACM): <em>“comportamento validado — {recorded.coverage.covered}/
      {recorded.coverage.total} caminhos exercitados ({coveragePercent(recorded.coverage)}%)”</em>
    </>
  ) : undefined;

  const pill = (
    <div className="bpmnr-sim-toolbar-extra">
      <span className="bpmnr-sim-pill" data-sim-pill>
        MODO SIMULAÇÃO
      </span>
      {onExit && (
        <button type="button" className="bpmnr-sim-exit" data-sim-exit onClick={onExit}>
          Sair da simulação
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
        <SimulationOverlaySvg
          tokenNodeIds={state.tokens.map((token) => token.nodeId)}
          traversedEdges={state.traversedEdges}
          travels={sim.travels}
          clearTravel={sim.clearTravel}
        />
      }
    >
      {choice && (
        <div className="bpmnr-sim-choice-slot">
          <GatewayChoiceCard choice={choice} gatewayLabel={gatewayLabel} onChoose={sim.choose} />
        </div>
      )}
      <div className="bpmnr-sim-panel-slot">
        <SimulationPanel
          sessionNumber={sim.sessionNumber}
          statusLine={sim.statusLine}
          canAdvance={sim.canAdvance}
          onAdvance={sim.advance}
          onReset={sim.reset}
          advanceLabel={advanceLabel}
          boundaryOptions={state.boundaryOptions}
          onFireBoundary={sim.fireBoundary}
          stepMode={sim.stepMode}
          onToggleStepMode={sim.setStepMode}
          coverage={sim.coverage}
          trail={state.trail}
          hasApproximateSemantics={sim.hasApproximateSemantics}
          onRecord={onRecord ? handleRecord : undefined}
          canRecord={sim.coverage.covered > 0 && !recorded}
          recordedInfo={recordedInfo ?? defaultRecordedInfo}
        />
      </div>
    </BpmnEditor>
  );
}
