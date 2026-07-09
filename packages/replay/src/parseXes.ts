import { parseTimestamp } from './parseCsv.js';
import type { LogEvent, Trace } from './types.js';

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Reads the `value` of the XES attribute element with the given `key`. */
function readKeyed(fragment: string, key: string): string | undefined {
  const tag = fragment.match(new RegExp(`<[a-zA-Z]+\\b[^>]*\\bkey="${key}"[^>]*>`));
  if (!tag) return undefined;
  const value = tag[0].match(/\bvalue="([^"]*)"/);
  return value ? unescapeXml(value[1]) : undefined;
}

const TRACE_RE = /<trace\b[^>]*>([\s\S]*?)<\/trace>/g;
const EVENT_RE = /<event\b[^>]*>([\s\S]*?)<\/event>/g;

/**
 * Parses an XES 2.0 event log into traces. Scans trace-by-trace and
 * event-by-event without materializing an XML DOM (cerca §0.3): only the
 * `concept:name` (activity / case id) and `time:timestamp` attributes are
 * read. Unknown extensions are ignored. Missing case names fall back to a
 * positional id.
 */
export function parseXes(xml: string): Trace[] {
  const traces: Trace[] = [];
  let traceMatch: RegExpExecArray | null;
  let index = 0;
  TRACE_RE.lastIndex = 0;
  while ((traceMatch = TRACE_RE.exec(xml)) !== null) {
    const body = traceMatch[1];
    const firstEvent = body.search(/<event\b/);
    const header = firstEvent >= 0 ? body.slice(0, firstEvent) : body;
    const caseId = readKeyed(header, 'concept:name') ?? `case-${index}`;
    index += 1;

    const events: LogEvent[] = [];
    EVENT_RE.lastIndex = 0;
    let eventMatch: RegExpExecArray | null;
    while ((eventMatch = EVENT_RE.exec(body)) !== null) {
      const fragment = eventMatch[1];
      const activity = readKeyed(fragment, 'concept:name');
      if (activity === undefined) continue;
      const tsRaw = readKeyed(fragment, 'time:timestamp');
      const timestamp = tsRaw !== undefined ? parseTimestamp(tsRaw) : undefined;
      events.push(timestamp !== undefined ? { activity, timestamp } : { activity });
    }
    traces.push({ caseId, events });
  }
  return traces;
}
