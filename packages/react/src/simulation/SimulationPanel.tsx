import type { ReactNode } from 'react';
import type { BoundaryOption, CoverageSummary, TransitionRecord } from '@buildtovalue/simulation';
import { useT } from '../i18n/I18nContext.js';

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
  const t = useT();
  const pct = coverage.total > 0 ? Math.round((coverage.covered / coverage.total) * 100) : 0;

  return (
    <aside className="bpmnr-sim-panel" aria-label={t('sim.panel.aria')} data-sim-panel>
      <div>
        <div className="bpmnr-sim-eyebrow">{t('sim.eyebrow', { session: sessionNumber })}</div>
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
          ↺ {t('sim.reset')}
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
          ⏱ {t('sim.boundary.fire', { label: boundary.label })}
          {boundary.interrupting ? '' : t('sim.boundary.nonInterrupting')}
        </button>
      ))}

      <label className="bpmnr-sim-checkbox">
        <input
          type="checkbox"
          checked={stepMode}
          data-sim-stepmode
          onChange={(event) => onToggleStepMode(event.target.checked)}
        />
        {t('sim.stepMode')}
      </label>

      <div className="bpmnr-sim-card">
        <div className="bpmnr-sim-card-title">
          {t('sim.coverage.title', { covered: coverage.covered, total: coverage.total })}
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
        <div className="bpmnr-sim-card-title">{t('sim.trail.title')}</div>
        <div className="bpmnr-sim-trail" data-sim-trail>
          {trail.length === 0 ? (
            <div className="bpmnr-sim-trail-empty">{t('sim.trail.empty')}</div>
          ) : (
            trail.map((entry) => (
              <div key={entry.step} data-approximate={entry.approximate || undefined}>
                {entry.message}
                {entry.approximate ? t('sim.trail.approx') : ''}
              </div>
            ))
          )}
        </div>
      </div>

      {hasApproximateSemantics && (
        <div className="bpmnr-sim-notice" data-sim-approx-notice>
          {t('sim.approxNotice.before')}
          <strong>{t('sim.approxNotice.emphasis')}</strong>
          {t('sim.approxNotice.after')}
        </div>
      )}

      {onRecord && canRecord && (
        <button
          type="button"
          data-sim-record
          onClick={onRecord}
          className="bpmnr-sim-btn bpmnr-sim-btn-record"
        >
          {t('sim.record')}
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
