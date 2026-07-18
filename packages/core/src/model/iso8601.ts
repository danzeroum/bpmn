import type { BpmnNode } from './types.js';

/**
 * ISO 8601 timer expressions — headless parser (Handoff 16 E-5, §3d).
 * Covers the three OMG timer flavors: `date` (`bpmn:timeDate`, a dateTime),
 * `duration` (`bpmn:timeDuration`, `PnYnMnDTnHnMnS`) and `cycle`
 * (`bpmn:timeCycle`, `Rn/…`). The result is STRUCTURED so the editor can
 * build a human preview without re-parsing — and the P1M (1 month) vs PT1M
 * (1 minute) trap is decided here, once, with a binding test.
 * Never throws: any input, however broken, returns `{ valid: false }`.
 */
export type TimerKind = 'date' | 'duration' | 'cycle';

/** The canonical timer property of a timer event (E-0 decision 3). */
export interface TimerProperty {
  kind: TimerKind;
  expression: string;
}

/** Numeric components of a parsed duration (absent units are 0). */
export interface DurationParts {
  years: number;
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export type TimerParseResult =
  | { valid: true; kind: 'date'; date: string }
  | { valid: true; kind: 'duration'; parts: DurationParts }
  | {
      valid: true;
      kind: 'cycle';
      /** `null` = unbounded (`R/…`). */
      repetitions: number | null;
      /** Optional anchor dateTime (`R3/2026-01-01T00:00:00Z/P1D`). */
      start?: string;
      parts: DurationParts;
    }
  | { valid: false; error: string };

// dateTime: date, mandatory time (OMG timers are instants), optional
// seconds/fraction and offset.
const DATE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/;
// Duration: at least one component; T only with at least one time component.
// The M before T is MONTHS, after T is MINUTES — the P1M/PT1M trap.
const DURATION_RE =
  /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

function parseDurationParts(expression: string): DurationParts | null {
  const match = DURATION_RE.exec(expression);
  if (!match) return null;
  const [, years, months, weeks, days, hours, minutes, seconds] = match;
  if (
    years === undefined &&
    months === undefined &&
    weeks === undefined &&
    days === undefined &&
    hours === undefined &&
    minutes === undefined &&
    seconds === undefined
  ) {
    return null; // "P" / "PT" alone carry no component
  }
  if (expression.endsWith('T')) return null; // "P1DT" — dangling designator
  return {
    years: Number(years ?? 0),
    months: Number(months ?? 0),
    weeks: Number(weeks ?? 0),
    days: Number(days ?? 0),
    hours: Number(hours ?? 0),
    minutes: Number(minutes ?? 0),
    seconds: Number(seconds ?? 0),
  };
}

function parseDate(expression: string): string | null {
  if (!DATE_RE.test(expression)) return null;
  return Number.isNaN(Date.parse(expression)) ? null : expression;
}

/** Parses a timer expression for its declared kind. Total — never throws. */
export function parseTimerExpression(kind: TimerKind, expression: string): TimerParseResult {
  const value = typeof expression === 'string' ? expression.trim() : '';
  if (value === '') return { valid: false, error: 'empty expression' };
  if (kind === 'date') {
    const date = parseDate(value);
    return date !== null
      ? { valid: true, kind: 'date', date }
      : { valid: false, error: `"${value}" is not an ISO 8601 dateTime` };
  }
  if (kind === 'duration') {
    const parts = parseDurationParts(value);
    return parts !== null
      ? { valid: true, kind: 'duration', parts }
      : { valid: false, error: `"${value}" is not an ISO 8601 duration` };
  }
  // cycle: R[n]/duration or R[n]/start/duration
  const segments = value.split('/');
  const head = segments[0];
  const repMatch = /^R(\d*)$/.exec(head ?? '');
  if (!repMatch || segments.length < 2 || segments.length > 3) {
    return { valid: false, error: `"${value}" is not an ISO 8601 repeating interval` };
  }
  const repetitions = repMatch[1] === '' ? null : Number(repMatch[1]);
  const durationSegment = segments[segments.length - 1];
  const parts = parseDurationParts(durationSegment);
  if (parts === null) {
    return { valid: false, error: `"${durationSegment}" is not an ISO 8601 duration` };
  }
  if (segments.length === 3) {
    const start = parseDate(segments[1]);
    if (start === null) {
      return { valid: false, error: `"${segments[1]}" is not an ISO 8601 dateTime` };
    }
    return { valid: true, kind: 'cycle', repetitions, start, parts };
  }
  return { valid: true, kind: 'cycle', repetitions, parts };
}

const TIMER_KINDS = new Set<string>(['date', 'duration', 'cycle']);

/**
 * The canonical `properties.timer` of a node, when well-shaped. Kind-agnostic
 * on purpose: the CONVERTER additionally requires the node to be a TIMER
 * event before emitting OMG children (E-5 reforço 10) — on any other node the
 * property stays in the ordinary `bpmnr:` soup.
 */
export function timerPropertyOf(node: BpmnNode): TimerProperty | undefined {
  const value = node.properties.timer;
  if (typeof value !== 'object' || value === null) return undefined;
  const { kind, expression } = value as { kind?: unknown; expression?: unknown };
  return typeof kind === 'string' && TIMER_KINDS.has(kind) && typeof expression === 'string'
    ? { kind: kind as TimerKind, expression }
    : undefined;
}
