import { canonicalJson, XmlBuilder, type AuditEntry } from '@buildtovalue/core';
import type { VersionRegistry } from '@buildtovalue/registry';
import type { LedgerLike } from './verify.js';

/**
 * XES 2.0 export (Handoff 4 §B2): the governance history becomes an IEEE
 * 1849-2016 event log so the REAL design process can be mined against the
 * documented one in any process-mining tool (ProM, Celonis, Disco).
 *
 * Mapping: each VERSION is a trace (`concept:name` = versionId); ledger
 * entries — commands, promotions, attestations — are events with
 * `concept:name` (type), `time:timestamp`, `org:resource` (author) and
 * `lifecycle:transition` = complete. With a registry, registrations and
 * publications join the same traces.
 */
export interface XesOptions {
  /** `concept:name` of the log. Default 'bpmn-react governance log'. */
  logName?: string;
  /** Merges registry events (registration, publications) into the traces. */
  registry?: VersionRegistry;
}

interface XesEvent {
  name: string;
  timestamp: string;
  resource?: string;
  /** Extra string attributes (key → value). */
  extras: Record<string, string>;
}

const XES_EXTENSIONS = [
  { name: 'Concept', prefix: 'concept', uri: 'http://www.xes-standard.org/concept.xesext' },
  { name: 'Time', prefix: 'time', uri: 'http://www.xes-standard.org/time.xesext' },
  {
    name: 'Organizational',
    prefix: 'org',
    uri: 'http://www.xes-standard.org/org.xesext',
  },
  { name: 'Lifecycle', prefix: 'lifecycle', uri: 'http://www.xes-standard.org/lifecycle.xesext' },
];

function entriesOf(ledger: LedgerLike): readonly AuditEntry[] {
  return 'getEntries' in ledger ? ledger.getEntries() : ledger.entries;
}

/** Serializes the ledger (+ registry events) as XES 2.0 XML. */
export function toXES(ledger: LedgerLike, options: XesOptions = {}): string {
  // Trace per version, insertion-ordered for a stable output.
  const traces = new Map<string, XesEvent[]>();
  const traceFor = (versionId: string): XesEvent[] => {
    let events = traces.get(versionId);
    if (!events) {
      events = [];
      traces.set(versionId, events);
    }
    return events;
  };

  for (const entry of entriesOf(ledger)) {
    traceFor(entry.versionId).push({
      name: entry.type,
      timestamp: entry.timestamp,
      resource: entry.userId,
      extras: {
        'bpmnr:seq': String(entry.seq),
        'bpmnr:hash': entry.hash,
        ...(Object.keys(entry.details).length > 0
          ? { 'bpmnr:details': canonicalJson(entry.details) }
          : {}),
      },
    });
  }

  for (const entry of options.registry?.list() ?? []) {
    const versionId = entry.version.id;
    traceFor(versionId).push({
      name: 'VERSION_REGISTERED',
      timestamp: entry.registeredAt,
      resource: entry.version.createdBy,
      extras: { 'bpmnr:semanticVersion': entry.version.semanticVersion },
    });
    for (const publication of entry.publications) {
      traceFor(versionId).push({
        name: 'VERSION_PUBLISHED',
        timestamp: publication.effectiveFrom,
        ...(publication.publishedBy ? { resource: publication.publishedBy } : {}),
        extras: {
          'bpmnr:channel': publication.channel,
          ...(publication.environment ? { 'bpmnr:environment': publication.environment } : {}),
          'bpmnr:status': publication.status,
        },
      });
    }
  }

  const xml = new XmlBuilder();
  xml.open('log', {
    'xes.version': '2.0',
    'xes.features': 'nested-attributes',
    xmlns: 'http://www.xes-standard.org/',
  });
  for (const extension of XES_EXTENSIONS) {
    xml.element('extension', extension);
  }
  xml.open('global', { scope: 'trace' });
  xml.element('string', { key: 'concept:name', value: 'UNKNOWN' });
  xml.close();
  xml.open('global', { scope: 'event' });
  xml.element('string', { key: 'concept:name', value: 'UNKNOWN' });
  xml.element('date', { key: 'time:timestamp', value: '1970-01-01T00:00:00.000Z' });
  xml.close();
  xml.element('classifier', { name: 'Activity', keys: 'concept:name' });
  xml.element('string', {
    key: 'concept:name',
    value: options.logName ?? 'bpmn-react governance log',
  });

  for (const [versionId, events] of traces) {
    xml.open('trace');
    xml.element('string', { key: 'concept:name', value: versionId });
    // Chronological inside the trace (ledger order is global, registry
    // events interleave by their own timestamps).
    const ordered = [...events].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
    for (const event of ordered) {
      xml.open('event');
      xml.element('string', { key: 'concept:name', value: event.name });
      xml.element('date', { key: 'time:timestamp', value: event.timestamp });
      if (event.resource !== undefined) {
        xml.element('string', { key: 'org:resource', value: event.resource });
      }
      xml.element('string', { key: 'lifecycle:transition', value: 'complete' });
      for (const [key, value] of Object.entries(event.extras)) {
        xml.element('string', { key, value });
      }
      xml.close();
    }
    xml.close();
  }

  xml.close();
  return xml.toString();
}
