import type { ReactNode } from 'react';
import type {
  BoundaryOption,
  CoverageSummary,
  ErrorThrowOption,
  EscalationDestination,
  EscalationThrowOption,
  EventSubprocessOption,
  TransitionRecord,
} from '@buildtovalue/simulation';
import { useT } from '../i18n/I18nContext.js';
import type { TFunction } from '../i18n/messages.js';

export interface SimulationPanelProps {
  sessionNumber: number;
  statusLine: string;
  canAdvance: boolean;
  onAdvance: () => void;
  onReset: () => void;
  advanceLabel: string;
  boundaryOptions: BoundaryOption[];
  onFireBoundary: (boundaryId: string) => void;
  /** "Throw error" cards (E-6 §3e) — user picks the ERROR, engine matches. */
  errorThrowOptions?: ErrorThrowOption[];
  onThrowError?: (host: string, errorRef?: string) => void;
  /** "Escalate" cards (Handoff 18 §5e) — user picks the escalation, engine
   * matches; each option shows its PREDICTED destination + mode (reforço 7). */
  escalationThrowOptions?: EscalationThrowOption[];
  onThrowEscalation?: (host: string, escalationRef?: string) => void;
  /** Manual timer/conditional event-subprocess cards (ES-5 §4e): those kinds
   * NEVER auto-fire; the mode is shown so the user decides informed. */
  eventSubprocessOptions?: EventSubprocessOption[];
  onFireEventSubprocess?: (subId: string) => void;
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
 * The predicted destination of one escalation option as glyph + text (Handoff
 * 18 §5e reforço 7): catch kind + mode, never color-only — the user reads WHERE
 * it lands and in which MODE before firing. Ambiguity/dissolve are declared.
 */
function escalationDestText(t: TFunction, dest: EscalationDestination): string {
  switch (dest.kind) {
    case 'boundary':
    case 'esubStart': {
      const where = t(
        dest.kind === 'boundary' ? 'sim.escalation.dest.boundary' : 'sim.escalation.dest.esubStart',
        { label: dest.label },
      );
      const mode = t(
        dest.interrupting
          ? 'sim.escalation.dest.interrupting'
          : 'sim.escalation.dest.nonInterrupting',
      );
      return where + mode;
    }
    case 'ambiguous':
      return t('sim.escalation.dest.ambiguous', { candidates: dest.candidates.join(', ') });
    case 'dissolve':
      return t('sim.escalation.dest.dissolve');
  }
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
    errorThrowOptions = [],
    onThrowError,
    escalationThrowOptions = [],
    onThrowEscalation,
    eventSubprocessOptions = [],
    onFireEventSubprocess,
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

      {/* E-6 (§3e): the INVERTED card — the user picks the ERROR (named
          definition or the uncatalogued one, reforço 10), the ENGINE resolves
          the boundary by matching; ambiguity is a declared stop. */}
      {onThrowError &&
        errorThrowOptions.map((card) => (
          <div key={card.host} className="bpmnr-sim-card" data-sim-throw-card={card.host}>
            <div className="bpmnr-sim-card-title">
              {t('sim.error.title', { host: card.hostLabel })}
            </div>
            {card.options.map((option) => (
              <button
                key={option.errorRef ?? '(uncatalogued)'}
                type="button"
                data-sim-throw-error={option.errorRef ?? ''}
                onClick={() => onThrowError(card.host, option.errorRef)}
                className="bpmnr-sim-btn bpmnr-sim-btn-boundary"
              >
                {/* i18n-exempt — lightning glyph */}⚡{' '}
                {option.errorRef !== undefined
                  ? t('sim.error.throw', { label: option.label ?? option.errorRef })
                  : t('sim.error.uncatalogued')}
              </button>
            ))}
          </div>
        ))}

      {/* Handoff 18 (§5e): the «Escalate» card — like «Throw error», the user
          picks the escalation (named or uncatalogued, reforço 10) and the
          ENGINE resolves the catch. Each option shows its PREDICTED destination
          + mode as glyph + text (reforço 7): the informed decision BEFORE the
          throw. No catch = dissolve (declared no-op); >1 = will block. */}
      {onThrowEscalation &&
        escalationThrowOptions.map((card) => (
          <div key={card.host} className="bpmnr-sim-card" data-sim-escalate-card={card.host}>
            <div className="bpmnr-sim-card-title">
              {t('sim.escalation.title', { host: card.hostLabel })}
            </div>
            {card.options.map((option) => (
              <button
                key={option.escalationRef ?? '(uncatalogued)'}
                type="button"
                data-sim-throw-escalation={option.escalationRef ?? ''}
                data-sim-escalation-dest={option.destination.kind}
                onClick={() => onThrowEscalation(card.host, option.escalationRef)}
                className="bpmnr-sim-btn bpmnr-sim-btn-boundary bpmnr-sim-btn-escalate"
              >
                <span className="bpmnr-sim-escalate-label">
                  {/* i18n-exempt — escalation chevron glyph */}↟{' '}
                  {option.escalationRef !== undefined
                    ? t('sim.escalation.throw', { label: option.label ?? option.escalationRef })
                    : t('sim.escalation.uncatalogued')}
                </span>
                <span className="bpmnr-sim-escalate-dest" data-sim-escalation-dest-text>
                  {escalationDestText(t, option.destination)}
                </span>
              </button>
            ))}
          </div>
        ))}

      {/* ES-5 (§4e): timer/conditional event subprocess NEVER auto-fires —
          this is the declared manual decision. The MODE is glyph + text
          (reforço 10) so the user knows an interrupting fire cancels the
          scope's tokens BEFORE deciding. */}
      {onFireEventSubprocess &&
        eventSubprocessOptions.map((option) => (
          <div key={option.sub} className="bpmnr-sim-card" data-sim-esub-card={option.sub}>
            <div className="bpmnr-sim-card-title">
              {t('sim.esub.title', { label: option.subLabel })}
            </div>
            <div className="bpmnr-sim-esub-mode" data-sim-esub-mode={option.interrupting ? 'interrupting' : 'non-interrupting'}>
              {option.interrupting
                ? <>{/* i18n-exempt — stop glyph */}⛔ {t('sim.esub.interrupting')}</>
                : <>{/* i18n-exempt — parallel glyph */}⇉ {t('sim.esub.nonInterrupting')}</>}
            </div>
            <button
              type="button"
              data-sim-esub-fire={option.sub}
              onClick={() => onFireEventSubprocess(option.sub)}
              className="bpmnr-sim-btn bpmnr-sim-btn-boundary"
            >
              {/* i18n-exempt — timer glyph */}⏱{' '}
              {t(option.kind === 'timer' ? 'sim.esub.fireTimer' : 'sim.esub.fireConditional')}
            </button>
          </div>
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
