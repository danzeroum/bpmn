import { useEffect, useState } from 'react';
import {
  parseTimerExpression,
  timerPropertyOf,
  updateNodeCommand,
  type BpmnNode,
  type DurationParts,
  type TimerKind,
  type TimerParseResult,
} from '@buildtovalue/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useT } from '../i18n/I18nContext.js';
import type { TFunction } from '../i18n/messages.js';

/**
 * Timer editor (Handoff 16 E-5, §3d): kind select + ISO 8601 expression +
 * HUMAN preview derived from the parser's STRUCTURED result — the P1M (month)
 * vs PT1M (minute) decision is made once, in the core parser. An invalid
 * expression shows ONLY the glyph+text notice, never a guessed preview
 * (reforço 10); an empty expression removes `properties.timer` entirely
 * (clean model — the absent field keeps prior exports byte-identical).
 */
const TIMER_KINDS: TimerKind[] = ['date', 'duration', 'cycle'];

/** True for event nodes whose kind is `timer` — the section's gate. */
export function isTimerEvent(node: BpmnNode): boolean {
  return node.properties.eventDefinition === 'timer';
}

const UNIT_ORDER: Array<[keyof DurationParts, string]> = [
  ['years', 'year'],
  ['months', 'month'],
  ['weeks', 'week'],
  ['days', 'day'],
  ['hours', 'hour'],
  ['minutes', 'minute'],
  ['seconds', 'second'],
];

function humanDuration(parts: DurationParts, t: TFunction): string {
  const pieces = UNIT_ORDER.filter(([key]) => parts[key] > 0).map(
    ([key, unit]) => `${parts[key]} ${t(`timer.unit.${unit}`, { count: parts[key] })}`,
  );
  if (pieces.length === 0) return '';
  if (pieces.length === 1) return pieces[0];
  return pieces.slice(0, -1).join(', ') + t('timer.preview.and') + pieces.at(-1);
}

/** The human preview of a VALID parse result (exported for tests). */
export function formatTimerPreview(parsed: TimerParseResult, t: TFunction): string {
  if (!parsed.valid) return '';
  if (parsed.kind === 'date') return t('timer.preview.date', { date: parsed.date });
  if (parsed.kind === 'duration') {
    return t('timer.preview.in', { duration: humanDuration(parsed.parts, t) });
  }
  const duration = humanDuration(parsed.parts, t);
  const base =
    parsed.repetitions === null
      ? t('timer.preview.cycleInfinite', { duration })
      : t('timer.preview.cycle', { count: parsed.repetitions, duration });
  return parsed.start !== undefined ? base + t('timer.preview.since', { date: parsed.start }) : base;
}

export function TimerSection({ node, readOnly }: { node: BpmnNode; readOnly: boolean }) {
  const { execute } = useDiagram();
  const t = useT();
  const stored = timerPropertyOf(node);
  const [kind, setKind] = useState<TimerKind>(stored?.kind ?? 'duration');
  const [expression, setExpression] = useState(stored?.expression ?? '');
  useEffect(() => {
    setKind(stored?.kind ?? 'duration');
    setExpression(stored?.expression ?? '');
  }, [stored?.kind, stored?.expression, node.id]);

  // Clean model: empty expression = property removed (absent field), never
  // an empty claim in the soup.
  const commit = (nextKind: TimerKind, nextExpression: string) => {
    const value =
      nextExpression.trim() === '' ? undefined : { kind: nextKind, expression: nextExpression };
    if (JSON.stringify(value) === JSON.stringify(stored)) return;
    void execute(updateNodeCommand(node.id, { properties: { timer: value } }));
  };

  const parsed = expression.trim() === '' ? null : parseTimerExpression(kind, expression);

  return (
    <section className="bpmnr-timer" data-testid="timer-section">
      <span className="bpmnr-inspector-kicker">{t('timer.kicker')}</span>
      <label className="bpmnr-timer-field">
        <span>{t('timer.kind.label')}</span>
        <select
          value={kind}
          disabled={readOnly}
          aria-label={t('timer.kind.label')}
          data-testid="timer-kind"
          onChange={(event) => {
            const next = event.target.value as TimerKind;
            setKind(next);
            commit(next, expression);
          }}
        >
          {TIMER_KINDS.map((option) => (
            <option key={option} value={option}>
              {t(`timer.kind.${option}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="bpmnr-timer-field">
        <span>{t('timer.expression.label')}</span>
        <input
          type="text"
          value={expression}
          disabled={readOnly}
          aria-label={t('timer.expression.label')}
          data-testid="timer-expression"
          onChange={(event) => setExpression(event.target.value)}
          onBlur={() => commit(kind, expression)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          }}
        />
      </label>
      {parsed?.valid === true && (
        <p className="bpmnr-timer-preview" data-testid="timer-preview">
          {formatTimerPreview(parsed, t)}
        </p>
      )}
      {/* Reforço 10: invalid → ONLY the notice, glyph+text, never a guess. */}
      {parsed !== null && !parsed.valid && (
        <p className="bpmnr-timer-invalid" data-testid="timer-invalid">
          {/* i18n-exempt — warning glyph */}⚠ {t('timer.invalid')}
        </p>
      )}
    </section>
  );
}
