import type { ReactNode } from 'react';
import type { BoundaryOption, CoverageSummary, TransitionRecord } from '@bpmn-react/simulation';

export interface SimulationPanelProps {
  sessionNumber: number;
  statusLine: string;
  canAdvance: boolean;
  onAdvance: () => void;
  onReset: () => void;
  advanceLabel: string;
  boundaryOptions: BoundaryOption[];
  onFireBoundary: (boundaryId: string) => void;
  stepMode: boolean;
  onToggleStepMode: (on: boolean) => void;
  coverage: CoverageSummary;
  trail: TransitionRecord[];
  hasApproximateSemantics: boolean;
  /** Ledger registration (Handoff 7A-3). Button hides when absent. */
  onRecord?: () => void;
  canRecord?: boolean;
  recordedInfo?: ReactNode;
}

/**
 * The 300px simulation panel that replaces the inspector in simulation mode:
 * status + advance/restart, contextual boundary firing, path coverage,
 * session trail, and (via injection) ledger registration.
 */
export function SimulationPanel(props: SimulationPanelProps) {
  const {
    sessionNumber,
    statusLine,
    canAdvance,
    onAdvance,
    onReset,
    advanceLabel,
    boundaryOptions,
    onFireBoundary,
    stepMode,
    onToggleStepMode,
    coverage,
    trail,
    hasApproximateSemantics,
    onRecord,
    canRecord,
    recordedInfo,
  } = props;
  const pct = coverage.total > 0 ? Math.round((coverage.covered / coverage.total) * 100) : 0;

  return (
    <aside className="bpmnr-sim-panel" aria-label="Painel de simulação" data-sim-panel>
      <div>
        <div className="bpmnr-sim-eyebrow">SIMULAÇÃO · SESSÃO #{sessionNumber}</div>
        <div className="bpmnr-sim-status" data-sim-status>
          {statusLine}
        </div>
      </div>

      <div className="bpmnr-sim-actions">
        <button
          type="button"
          data-sim-advance
          disabled={!canAdvance}
          onClick={onAdvance}
          className="bpmnr-sim-btn bpmnr-sim-btn-primary"
        >
          {advanceLabel}
        </button>
        <button type="button" data-sim-reset onClick={onReset} className="bpmnr-sim-btn">
          ↺ Reiniciar
        </button>
      </div>

      {boundaryOptions.map((boundary) => (
        <button
          key={boundary.boundary}
          type="button"
          data-sim-boundary={boundary.boundary}
          onClick={() => onFireBoundary(boundary.boundary)}
          className="bpmnr-sim-btn bpmnr-sim-btn-boundary"
        >
          ⏱ Disparar boundary “{boundary.label}”
          {boundary.interrupting ? '' : ' (não-interruptivo)'}
        </button>
      ))}

      <label className="bpmnr-sim-checkbox">
        <input
          type="checkbox"
          checked={stepMode}
          data-sim-stepmode
          onChange={(event) => onToggleStepMode(event.target.checked)}
        />
        Modo passo a passo sem animação (reduced motion)
      </label>

      <div className="bpmnr-sim-card">
        <div className="bpmnr-sim-card-title">
          COBERTURA DE CAMINHOS · {coverage.covered}/{coverage.total}
        </div>
        <ul className="bpmnr-sim-coverage" data-sim-coverage>
          {coverage.paths.map((path) => (
            <li key={path.id} data-covered={path.covered || undefined}>
              <span className="bpmnr-sim-mark" aria-hidden>
                {path.covered ? '✓' : '○'}
              </span>
              {path.label}
            </li>
          ))}
        </ul>
        <div className="bpmnr-sim-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="bpmnr-sim-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="bpmnr-sim-card bpmnr-sim-trail-card">
        <div className="bpmnr-sim-card-title">TRILHA DA SESSÃO</div>
        <div className="bpmnr-sim-trail" data-sim-trail>
          {trail.length === 0 ? (
            <div className="bpmnr-sim-trail-empty">sessão iniciada</div>
          ) : (
            trail.map((entry) => (
              <div key={entry.step} data-approximate={entry.approximate || undefined}>
                {entry.message}
                {entry.approximate ? ' · ~aprox' : ''}
              </div>
            ))
          )}
        </div>
      </div>

      {hasApproximateSemantics && (
        <div className="bpmnr-sim-notice" data-sim-approx-notice>
          Este modelo usa gateway OR — semântica de join é <strong>aproximada</strong> (ver
          limitations.md).
        </div>
      )}

      {onRecord && canRecord && (
        <button
          type="button"
          data-sim-record
          onClick={onRecord}
          className="bpmnr-sim-btn bpmnr-sim-btn-record"
        >
          Registrar sessão no ledger
        </button>
      )}
      {recordedInfo && (
        <div className="bpmnr-sim-recorded" data-sim-recorded>
          {recordedInfo}
        </div>
      )}
    </aside>
  );
}
