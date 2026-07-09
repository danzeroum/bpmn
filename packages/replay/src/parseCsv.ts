import type { LogEvent, Trace } from './types.js';

export interface CsvMapping {
  /** Column name (or 0-based index) for the case id. Default: "case". */
  case?: string | number;
  /** Column name/index for the activity. Default: "activity". */
  activity?: string | number;
  /** Column name/index for the timestamp. Default: "timestamp". */
  timestamp?: string | number;
  /** Field delimiter. Default: ",". */
  delimiter?: string;
}

/** Parses a timestamp cell to epoch ms: numeric epoch, or any Date-parsable string. */
export function parseTimestamp(value: string): number | undefined {
  const text = value.trim();
  if (text === '') return undefined;
  if (/^-?\d+$/.test(text)) return Number(text);
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? undefined : ms;
}

/** Splits one CSV line, honoring double-quoted fields with escaped quotes. */
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function resolveIndex(
  header: string[],
  spec: string | number | undefined,
  fallbackName: string,
): number {
  if (typeof spec === 'number') return spec;
  const name = (spec ?? fallbackName).toLowerCase();
  const index = header.findIndex((h) => h.trim().toLowerCase() === name);
  if (index < 0) {
    throw new Error(`replay CSV: column "${spec ?? fallbackName}" not found in header`);
  }
  return index;
}

/**
 * Parses a CSV event log (minimum columns: case, activity, timestamp) into
 * traces. Reads line by line and groups events by case (compact tuples — never
 * a rich object graph, cerca §0.3); each trace is stably sorted by timestamp
 * when present. Column names are configurable via {@link CsvMapping}.
 */
export function parseCsv(text: string, mapping: CsvMapping = {}): Trace[] {
  const delimiter = mapping.delimiter ?? ',';
  const lines = text.split(/\r?\n/);
  let headerParsed = false;
  let caseIx = 0;
  let actIx = 1;
  let tsIx = 2;
  const order: string[] = [];
  const byCase = new Map<string, LogEvent[]>();

  for (const raw of lines) {
    if (raw.trim() === '') continue;
    const fields = splitLine(raw, delimiter);
    if (!headerParsed) {
      headerParsed = true;
      // A header row is required to resolve named columns; numeric mapping
      // still uses the first row as header (skipped from data).
      caseIx = resolveIndex(fields, mapping.case, 'case');
      actIx = resolveIndex(fields, mapping.activity, 'activity');
      tsIx = resolveIndex(fields, mapping.timestamp, 'timestamp');
      continue;
    }
    const caseId = fields[caseIx]?.trim() ?? '';
    const activity = fields[actIx]?.trim() ?? '';
    if (caseId === '' || activity === '') continue;
    const tsRaw = fields[tsIx];
    const timestamp = tsRaw !== undefined ? parseTimestamp(tsRaw) : undefined;
    let events = byCase.get(caseId);
    if (!events) {
      events = [];
      byCase.set(caseId, events);
      order.push(caseId);
    }
    events.push(timestamp !== undefined ? { activity, timestamp } : { activity });
  }

  return order.map((caseId) => {
    const events = byCase.get(caseId)!;
    const sorted = events.every((e) => e.timestamp !== undefined)
      ? [...events].sort((a, b) => (a.timestamp! - b.timestamp!))
      : events;
    return { caseId, events: sorted };
  });
}
