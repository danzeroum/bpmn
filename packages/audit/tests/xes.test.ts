import { describe, expect, it } from 'vitest';
import {
  AuditLedger,
  childrenByLocalName,
  computeDiagramHash,
  createDiagram,
  localName,
  MiniXmlParser,
  type XmlElement,
} from '@bpmn-react/core';
import { VersionRegistry } from '@bpmn-react/registry';
import { toXES } from '../src/index.js';

/**
 * Structural XES-schema check (aceite B3, same manifest approach as part A):
 * a hand-derived digest of the IEEE 1849-2016 XES schema for the elements we
 * emit — legal containment, required attributes, and the concept/time
 * globals every event must satisfy. A full XSD engine is out of scope
 * (zero-deps); this catches the structural mistakes that break mining tools.
 */
const ATTRIBUTE_TAGS = new Set(['string', 'date', 'int', 'float', 'boolean', 'id', 'list']);

function validateXes(xml: string): string[] {
  const problems: string[] = [];
  const root = new MiniXmlParser().parse(xml);
  if (localName(root.tag) !== 'log') problems.push(`root must be <log>, got <${root.tag}>`);
  if (!root.attributes['xes.version']) problems.push('<log> is missing xes.version');

  const checkAttribute = (el: XmlElement, where: string) => {
    if (!el.attributes.key) problems.push(`${where}: <${el.tag}> without key`);
    if (el.attributes.value === undefined && localName(el.tag) !== 'list') {
      problems.push(`${where}: <${el.tag} key="${el.attributes.key}"> without value`);
    }
    if (localName(el.tag) === 'date' && Number.isNaN(Date.parse(el.attributes.value ?? ''))) {
      problems.push(`${where}: date ${el.attributes.key} is not a valid xs:dateTime`);
    }
  };

  for (const child of root.children) {
    const tag = localName(child.tag);
    if (tag === 'extension') {
      for (const required of ['name', 'prefix', 'uri']) {
        if (!child.attributes[required]) problems.push(`<extension> missing ${required}`);
      }
    } else if (tag === 'classifier') {
      for (const required of ['name', 'keys']) {
        if (!child.attributes[required]) problems.push(`<classifier> missing ${required}`);
      }
    } else if (tag === 'global') {
      if (!['trace', 'event'].includes(child.attributes.scope ?? '')) {
        problems.push('<global> scope must be trace|event');
      }
      for (const attr of child.children) checkAttribute(attr, 'global');
    } else if (ATTRIBUTE_TAGS.has(tag)) {
      checkAttribute(child, 'log');
    } else if (tag === 'trace') {
      for (const traceChild of child.children) {
        const traceTag = localName(traceChild.tag);
        if (traceTag === 'event') {
          const keys = new Map(
            traceChild.children.map((attr) => [attr.attributes.key, attr] as const),
          );
          if (!keys.has('concept:name')) problems.push('event without concept:name');
          if (!keys.has('time:timestamp')) problems.push('event without time:timestamp');
          for (const attr of traceChild.children) {
            if (!ATTRIBUTE_TAGS.has(localName(attr.tag))) {
              problems.push(`event contains illegal child <${attr.tag}>`);
            }
            checkAttribute(attr, 'event');
          }
        } else if (ATTRIBUTE_TAGS.has(traceTag)) {
          checkAttribute(traceChild, 'trace');
        } else {
          problems.push(`trace contains illegal child <${traceChild.tag}>`);
        }
      }
    } else {
      problems.push(`log contains illegal child <${child.tag}>`);
    }
  }
  return problems;
}

async function referenceLedger(): Promise<AuditLedger> {
  const ledger = new AuditLedger();
  await ledger.append({ type: 'NODE_ADDED', userId: 'ana', versionId: 'v1', details: { nodeId: 'task1' } });
  await ledger.append({ type: 'NODE_MOVED', userId: 'bia', versionId: 'v1', details: { nodeId: 'task1' } });
  await ledger.append({ type: 'VERSION_ACTIVATED', userId: 'ana', versionId: 'v1', details: {} });
  await ledger.append({ type: 'NODE_ADDED', userId: 'caio', versionId: 'v2', details: { nodeId: 'task2' } });
  return ledger;
}

describe('toXES (Handoff 4 §B2)', () => {
  it('produces structurally valid XES 2.0 (aceite B3 — reference fixture)', async () => {
    const xes = toXES(await referenceLedger());
    expect(validateXes(xes)).toEqual([]);
    expect(xes).toContain('xes.version="2.0"');
    expect(xes).toContain('http://www.xes-standard.org/concept.xesext');
  });

  it('maps versions to traces and entries to classified events', async () => {
    const xes = toXES(await referenceLedger(), { logName: 'demo log' });
    const root = new MiniXmlParser().parse(xes);
    const traces = childrenByLocalName(root, 'trace');
    expect(traces).toHaveLength(2); // v1 and v2

    const nameOf = (el: XmlElement) =>
      el.children.find((c) => c.attributes.key === 'concept:name')?.attributes.value;
    expect(traces.map(nameOf)).toEqual(['v1', 'v2']);

    const v1Events = childrenByLocalName(traces[0], 'event');
    expect(v1Events.map(nameOf)).toEqual(['NODE_ADDED', 'NODE_MOVED', 'VERSION_ACTIVATED']);
    const first = v1Events[0];
    const attr = (key: string) =>
      first.children.find((c) => c.attributes.key === key)?.attributes.value;
    expect(attr('org:resource')).toBe('ana');
    expect(attr('lifecycle:transition')).toBe('complete');
    expect(Date.parse(attr('time:timestamp') ?? '')).not.toBeNaN();
    expect(attr('bpmnr:details')).toBe('{"nodeId":"task1"}');
  });

  it('merges registry registrations and publications into the traces', async () => {
    const ledger = await referenceLedger();
    const registry = new VersionRegistry();
    const diagram = createDiagram({ name: 'Flow', id: 'flow' });
    diagram.version = {
      id: 'v1',
      semanticVersion: '1.0.0',
      status: 'active',
      approvedBy: [],
      changeSummary: 'first modelled version',
      createdBy: 'ana',
      createdAt: '2026-01-01T00:00:00.000Z',
      snapshotHash: '',
    };
    diagram.version.snapshotHash = await computeDiagramHash(diagram);
    await registry.register(diagram);
    await registry.publish('v1', {
      channel: 'general',
      effectiveFrom: '2026-02-01T00:00:00.000Z',
      publishedBy: 'ops',
    });

    const xes = toXES(ledger, { registry });
    expect(validateXes(xes)).toEqual([]);
    const root = new MiniXmlParser().parse(xes);
    const v1 = childrenByLocalName(root, 'trace')[0];
    const names = childrenByLocalName(v1, 'event').map(
      (event) => event.children.find((c) => c.attributes.key === 'concept:name')?.attributes.value,
    );
    expect(names).toContain('VERSION_REGISTERED');
    expect(names).toContain('VERSION_PUBLISHED');
    expect(xes).toContain('key="bpmnr:channel" value="general"');
  });

  it('exports an empty ledger as a headers-only log', () => {
    const xes = toXES({ entries: [] });
    expect(validateXes(xes)).toEqual([]);
    expect(xes).not.toContain('<trace>');
  });
});
