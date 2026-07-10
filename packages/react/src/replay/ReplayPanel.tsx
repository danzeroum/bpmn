import type { AggregatedLog } from '@buildtovalue/replay';
import { useT } from '../i18n/I18nContext.js';

export interface ReplayComparison {
  headline: string;
  candidateSemanticVersion: string;
  attached: boolean;
  /** Attaches the analysis to the candidate's promotion; absent → no button. */
  onAttach?: () => void;
}

export interface ReplayPanelProps {
  fileName: string;
  log: AggregatedLog;
  nodeLabel: (id: string) => string;
  selectedDeviation: number | null;
  onSelectDeviation: (index: number) => void;
  playingVariant: number | null;
  onPlayVariant: (index: number) => void;
  onStopVariant: () => void;
  /** Comparison card "antes de aprovar a vX" + attach action (Handoff 7B-3). */
  comparison?: ReplayComparison;
}

const pct = (fraction: number) => `${(fraction * 100).toFixed(1).replace('.', ',')}%`;
const int = (value: number) => value.toLocaleString('pt-BR');

function endpointLabel(id: string, nodeLabel: (id: string) => string): string {
  return id.startsWith('?') ? id.slice(1) : nodeLabel(id);
}

/**
 * The 306px replay panel that replaces the inspector in replay mode: import
 * summary, token-replay fitness, the deviation list (clickable → highlight on
 * canvas), and the sampled top variants with ▶ Reproduzir. Version comparison
 * and "attach to promotion" land in Handoff 7B-3.
 */
export function ReplayPanel(props: ReplayPanelProps) {
  const { fileName, log, nodeLabel, selectedDeviation, onSelectDeviation, playingVariant, onPlayVariant, onStopVariant, comparison } = props;
  const t = useT();
  const { fitness, deviations, variants } = log;
  const fitPct = fitness.totalMoves > 0 ? fitness.fitness * 100 : 0;
  const empty = log.totalCases === 0;

  return (
    <aside className="bpmnr-replay-panel" aria-label={t('replay.panel.aria')} data-replay-panel>
      <div>
        <div className="bpmnr-replay-eyebrow">{t('replay.eventLog')}</div>
        <div className="bpmnr-replay-file" data-replay-file>{fileName}</div>
        <div className="bpmnr-replay-meta">
          {t('replay.meta', { cases: int(log.totalCases), events: int(log.totalEvents) })}
          {log.unmapped.length > 0 ? t('replay.meta.unmapped', { count: log.unmapped.length }) : ''}
        </div>
      </div>

      {/* Fitness */}
      <div className="bpmnr-replay-card">
        <div className="bpmnr-replay-card-head">
          <span className="bpmnr-replay-card-title">{t('replay.fitness.title')}</span>
          <span className="bpmnr-replay-fitness-value" data-replay-fitness>
            {empty ? '—' : pct(fitness.fitness)}
          </span>
        </div>
        <div className="bpmnr-replay-progress" role="progressbar" aria-valuenow={Math.round(fitPct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="bpmnr-replay-progress-fill" style={{ width: `${fitPct}%` }} />
        </div>
        <div className="bpmnr-replay-note">
          {empty ? (
            t('replay.fitness.empty')
          ) : (
            <>
              {t('replay.fitness.conforming', {
                conforming: int(fitness.conformingCases),
                total: int(fitness.totalCases),
              })}
              {t('replay.fitness.nonConforming', {
                count: fitness.totalCases - fitness.conformingCases,
                n: int(fitness.totalCases - fitness.conformingCases),
              })}
            </>
          )}
        </div>
      </div>

      {comparison && (
        <div className="bpmnr-replay-card bpmnr-replay-compare" data-replay-compare>
          <div className="bpmnr-replay-card-title">
            {t('replay.compare.title', { version: comparison.candidateSemanticVersion })}
          </div>
          <p className="bpmnr-replay-compare-text" data-replay-compare-text>
            {comparison.headline}
          </p>
          {comparison.attached ? (
            <div className="bpmnr-replay-attached" data-replay-attached>
              ✓ {t('replay.compare.attached')}
            </div>
          ) : (
            comparison.onAttach && (
              <button
                type="button"
                data-replay-attach
                className="bpmnr-replay-attach"
                onClick={comparison.onAttach}
              >
                {t('replay.compare.attach')} →
              </button>
            )
          )}
        </div>
      )}

      {/* Deviations */}
      <div className="bpmnr-replay-card bpmnr-replay-dev-card">
        <div className="bpmnr-replay-card-title bpmnr-replay-dev-title">{t('replay.deviations.title', { n: deviations.length })}</div>
        {deviations.length === 0 ? (
          <div className="bpmnr-replay-note">{t('replay.deviations.none')}</div>
        ) : (
          <ul className="bpmnr-replay-devlist" data-replay-devlist>
            {deviations.map((deviation, index) => (
              <li
                key={index}
                data-replay-dev={index}
                data-selected={selectedDeviation === index || undefined}
                onClick={() => onSelectDeviation(index)}
              >
                <strong>▲ {endpointLabel(deviation.from, nodeLabel)} → {endpointLabel(deviation.to, nodeLabel)}</strong>
                {' '}({t('replay.cases', { count: deviation.cases, n: int(deviation.cases) })} · {pct(log.totalCases > 0 ? deviation.cases / log.totalCases : 0)})
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Variants */}
      <div className="bpmnr-replay-card">
        <div className="bpmnr-replay-card-title">{t('replay.variants.title', { n: variants.length })}</div>
        <ul className="bpmnr-replay-variants" data-replay-variants>
          {variants.map((variant, index) => {
            const playing = playingVariant === index;
            return (
              <li key={variant.signature}>
                <span className="bpmnr-replay-variant-label">
                  {index + 1} · {t('replay.cases', { count: variant.count, n: int(variant.count) })} ({pct(variant.share)})
                </span>
                <button
                  type="button"
                  data-replay-play={index}
                  className="bpmnr-replay-play"
                  onClick={() => (playing ? onStopVariant() : onPlayVariant(index))}
                >
                  {playing ? `■ ${t('replay.variant.stop')}` : `▶ ${t('replay.variant.play')}`}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="bpmnr-replay-legend-note">
        {t('replay.legend')}
      </div>
    </aside>
  );
}
