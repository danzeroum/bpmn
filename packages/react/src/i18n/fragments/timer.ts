import type { Messages } from '../messages.js';

/**
 * Handoff 16 E-5 dictionary fragment (§3d UI): the timer editor — kind
 * select, ISO 8601 expression and the HUMAN preview built from the parser's
 * structured result (the P1M/PT1M decision is the parser's, not a string
 * re-read). No preview for invalid expressions — only the glyph+text notice
 * (reforço 10: never a guessed preview).
 */
export const timer: { en: Messages; ptBR: Messages } = {
  en: {
    'timer.kicker': 'Event — timer',
    'timer.kind.label': 'Timer type',
    'timer.kind.date': 'Date (instant)',
    'timer.kind.duration': 'Duration',
    'timer.kind.cycle': 'Cycle',
    'timer.expression.label': 'ISO 8601 expression',
    'timer.invalid': 'Invalid expression for this timer type.',
    'timer.preview.date': 'at {date}',
    'timer.preview.in': 'in {duration}',
    'timer.preview.cycle': '{count}× every {duration}',
    'timer.preview.cycleInfinite': 'every {duration}',
    'timer.preview.since': ', starting {date}',
    'timer.preview.and': ' and ',
    'timer.unit.year_one': 'year',
    'timer.unit.year_other': 'years',
    'timer.unit.month_one': 'month',
    'timer.unit.month_other': 'months',
    'timer.unit.week_one': 'week',
    'timer.unit.week_other': 'weeks',
    'timer.unit.day_one': 'day',
    'timer.unit.day_other': 'days',
    'timer.unit.hour_one': 'hour',
    'timer.unit.hour_other': 'hours',
    'timer.unit.minute_one': 'minute',
    'timer.unit.minute_other': 'minutes',
    'timer.unit.second_one': 'second',
    'timer.unit.second_other': 'seconds',
  },
  ptBR: {
    'timer.kicker': 'Evento — timer',
    'timer.kind.label': 'Tipo de timer',
    'timer.kind.date': 'Data (instante)',
    'timer.kind.duration': 'Duração',
    'timer.kind.cycle': 'Ciclo',
    'timer.expression.label': 'Expressão ISO 8601',
    'timer.invalid': 'Expressão inválida para este tipo de timer.',
    'timer.preview.date': 'em {date}',
    'timer.preview.in': 'em {duration}',
    'timer.preview.cycle': '{count}× a cada {duration}',
    'timer.preview.cycleInfinite': 'a cada {duration}',
    'timer.preview.since': ', a partir de {date}',
    'timer.preview.and': ' e ',
    'timer.unit.year_one': 'ano',
    'timer.unit.year_other': 'anos',
    'timer.unit.month_one': 'mês',
    'timer.unit.month_other': 'meses',
    'timer.unit.week_one': 'semana',
    'timer.unit.week_other': 'semanas',
    'timer.unit.day_one': 'dia',
    'timer.unit.day_other': 'dias',
    'timer.unit.hour_one': 'hora',
    'timer.unit.hour_other': 'horas',
    'timer.unit.minute_one': 'minuto',
    'timer.unit.minute_other': 'minutos',
    'timer.unit.second_one': 'segundo',
    'timer.unit.second_other': 'segundos',
  },
};
