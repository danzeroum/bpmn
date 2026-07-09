import { describe, expect, it } from 'vitest';
import { aggregate, parseCsv, parseXes } from '../src/index.js';
import { linearGraph } from './fixtures.js';

describe('parseCsv', () => {
  const csv = [
    'case,activity,timestamp',
    'c1,A,2026-06-01T09:00:00Z',
    'c1,B,2026-06-01T10:00:00Z',
    'c2,A,2026-06-02T09:00:00Z',
    'c1,C,2026-06-01T11:00:00Z', // out of order — must sort into c1
  ].join('\n');

  it('groups by case, parses ISO timestamps and sorts each trace by time', () => {
    const traces = parseCsv(csv);
    expect(traces.map((t) => t.caseId)).toEqual(['c1', 'c2']);
    expect(traces[0].events.map((e) => e.activity)).toEqual(['A', 'B', 'C']); // reordered
    expect(traces[0].events[0].timestamp).toBe(Date.parse('2026-06-01T09:00:00Z'));
  });

  it('accepts numeric epoch timestamps and custom column names', () => {
    const log = ['cid;act;ts', 'x;A;0', 'x;B;1000'].join('\n');
    const traces = parseCsv(log, { case: 'cid', activity: 'act', timestamp: 'ts', delimiter: ';' });
    expect(traces[0].events).toEqual([
      { activity: 'A', timestamp: 0 },
      { activity: 'B', timestamp: 1000 },
    ]);
  });

  it('accepts column indices and honors quoted fields with commas', () => {
    const log = ['a,b,c', '"c,1","Do, thing",5'].join('\n');
    const traces = parseCsv(log, { case: 0, activity: 1, timestamp: 2 });
    expect(traces[0].caseId).toBe('c,1');
    expect(traces[0].events[0].activity).toBe('Do, thing');
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    const traces = parseCsv(['a,b,c', '"x""y",A,0'].join('\n'), { case: 0, activity: 1, timestamp: 2 });
    expect(traces[0].caseId).toBe('x"y');
  });

  it('keeps input order when timestamps are absent (no sort)', () => {
    const log = ['case,activity,timestamp', 'c1,C,', 'c1,A,', 'c1,B,'].join('\n');
    const traces = parseCsv(log);
    expect(traces[0].events.map((e) => e.activity)).toEqual(['C', 'A', 'B']); // unsorted
    expect(traces[0].events[0].timestamp).toBeUndefined();
  });

  it('throws a clear error for a missing named column', () => {
    expect(() => parseCsv('x,y\n1,2', { case: 'case' })).toThrow(/column "case" not found/);
  });

  it('round-trips into aggregate for a conformant log', () => {
    const log = ['case,activity,timestamp', 'c1,A,0', 'c1,B,1000', 'c1,C,2000', 'c1,D,3000'].join('\n');
    const result = aggregate(linearGraph, parseCsv(log));
    expect(result.fitness.fitness).toBe(1);
    expect(result.edges.find((e) => e.edgeId === 'ab')?.avgMs).toBe(1000);
  });
});

describe('parseXes', () => {
  const xes = `<?xml version="1.0" encoding="UTF-8"?>
<log xes.version="2.0">
  <trace>
    <string key="concept:name" value="case-1"/>
    <event>
      <string key="concept:name" value="A &amp; setup"/>
      <date key="time:timestamp" value="2026-06-01T09:00:00.000Z"/>
    </event>
    <event>
      <string key="concept:name" value="B"/>
      <date key="time:timestamp" value="2026-06-01T10:00:00.000Z"/>
    </event>
  </trace>
  <trace>
    <string key="concept:name" value="case-2"/>
    <event><string key="concept:name" value="A &amp; setup"/></event>
  </trace>
</log>`;

  it('extracts trace ids, activities (unescaped) and timestamps', () => {
    const traces = parseXes(xes);
    expect(traces.map((t) => t.caseId)).toEqual(['case-1', 'case-2']);
    expect(traces[0].events.map((e) => e.activity)).toEqual(['A & setup', 'B']);
    expect(traces[0].events[0].timestamp).toBe(Date.parse('2026-06-01T09:00:00.000Z'));
    expect(traces[1].events[0].timestamp).toBeUndefined();
  });

  it('falls back to a positional case id when the trace has no concept:name', () => {
    const noName = '<log><trace><event><string key="concept:name" value="A"/></event></trace></log>';
    expect(parseXes(noName)[0].caseId).toBe('case-0');
  });

  it('skips events with no concept:name and unescapes all entity kinds', () => {
    const log =
      '<log><trace><string key="concept:name" value="c1"/>' +
      '<event><date key="time:timestamp" value="2026-06-01T09:00:00Z"/></event>' + // no activity → skipped
      '<event><string key="concept:name" value="&lt;a&gt; &quot;x&quot; &apos;y&apos;"/></event>' +
      '</trace></log>';
    const traces = parseXes(log);
    expect(traces[0].events).toHaveLength(1);
    expect(traces[0].events[0].activity).toBe('<a> "x" \'y\'');
  });

  it('reads value-before-key attribute order too', () => {
    const swapped =
      '<log><trace><string value="c9" key="concept:name"/>' +
      '<event><string value="A" key="concept:name"/></event></trace></log>';
    const traces = parseXes(swapped);
    expect(traces[0].caseId).toBe('c9');
    expect(traces[0].events[0].activity).toBe('A');
  });
});
