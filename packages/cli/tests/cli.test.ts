import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  createDiagram,
  createEdge,
  createNode,
  JsonSerializer,
} from '@bpmn-react/core';
import {
  certifyCommand,
  diffCommand,
  formatCertify,
  exportCommand,
  formatDiff,
  formatValidation,
  loadDiagram,
  validateCommand,
} from '../src/index.js';

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'bpmnr-cli-'));
  const diagram = createDiagram({ name: 'CLI flow', id: 'cli-flow' });
  const start = createNode({ type: 'startEvent', id: 'start', x: 10, y: 10 });
  const task = createNode({ type: 'task', id: 'task', x: 200, y: 10 });
  diagram.nodes = { start, task };
  diagram.edges = { e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'task' }) };

  const jsonPath = join(dir, 'flow.json');
  await writeFile(jsonPath, new JsonSerializer().serialize(diagram));
  const xmlPath = join(dir, 'flow.bpmn.xml');
  await writeFile(xmlPath, new BpmnXmlConverter().toXml(diagram));
  return { dir, diagram, jsonPath, xmlPath };
}

describe('loadDiagram', () => {
  it('loads JSON and XML files', async () => {
    const { jsonPath, xmlPath } = await fixture();
    const fromJson = await loadDiagram(jsonPath);
    const fromXml = await loadDiagram(xmlPath);
    expect(Object.keys(fromJson.diagram.nodes)).toHaveLength(2);
    expect(Object.keys(fromXml.diagram.nodes)).toHaveLength(2);
    expect(fromXml.warnings).toEqual([]);
  });
});

describe('validateCommand', () => {
  it('validates a clean diagram', async () => {
    const { jsonPath } = await fixture();
    const { result } = await validateCommand(jsonPath);
    expect(result.valid).toBe(true);
    expect(formatValidation(result)).toContain('No issues');
  });

  it('reports issues for a broken diagram', async () => {
    const { dir, diagram } = await fixture();
    diagram.edges.bad = createEdge({ id: 'bad', sourceId: 'ghost', targetId: 'task' });
    const path = join(dir, 'broken.json');
    await writeFile(path, new JsonSerializer().serialize(diagram));
    const { result } = await validateCommand(path);
    expect(result.valid).toBe(false);
    expect(formatValidation(result)).toContain('ORPHAN_EDGE');
  });
});

describe('exportCommand', () => {
  it('converts JSON → XML and back', async () => {
    const { dir, jsonPath } = await fixture();
    const xml = await exportCommand(jsonPath, 'xml');
    expect(xml).toContain('<bpmn:definitions');

    const xmlOut = join(dir, 'out.bpmn.xml');
    await exportCommand(jsonPath, 'xml', xmlOut);
    const json = await exportCommand(xmlOut, 'json');
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed.nodes)).toHaveLength(2);
  });
});

describe('diffCommand', () => {
  it('detects changes between two files', async () => {
    const { dir, diagram, jsonPath } = await fixture();
    const changed = structuredClone(diagram);
    changed.nodes.task.label = 'Renamed';
    const otherPath = join(dir, 'changed.json');
    await writeFile(otherPath, new JsonSerializer().serialize(changed));

    const same = await diffCommand(jsonPath, jsonPath);
    expect(formatDiff(same)).toBe('No changes.');

    const diff = await diffCommand(jsonPath, otherPath);
    expect(formatDiff(diff)).toContain('~ node task: label');
  });
});

describe('certifyCommand / formatCertify (Handoff 4 §A2)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const corpus = join(here, '../../conformance/corpus');
  const fixtures = join(here, '../../conformance/tests/fixtures');

  it('certifies a descriptive file and formats the human certificate', async () => {
    const report = await certifyCommand(join(corpus, '01-linear-approval-v1.bpmn'));
    expect(report.achievedClass).toBe('descriptive');
    const text = formatCertify(report, 'certify-report.json');
    expect(text).toContain('XML bem-formado · XXE-safe');
    expect(text).toContain('Round-trip lossless');
    expect(text).toContain('Perfil: Descriptive');
    expect(text).toContain('Classe certificável: DESCRIPTIVE');
    expect(text).toContain('relatório: certify-report.json');
  });

  it('formats requirement success and failure marks', async () => {
    const analytic = join(corpus, '16-boundary-events-v1.bpmn');
    const ok = formatCertify(await certifyCommand(analytic, { require: 'analytic' }));
    expect(ok).toContain('Classe certificável: ANALYTIC ✔');
    const fail = formatCertify(await certifyCommand(analytic, { require: 'descriptive' }));
    expect(fail).toContain('Classe certificável: ANALYTIC ✖');
  });

  it('formats warnings, unsupported elements and structural issues', async () => {
    const degraded = formatCertify(await certifyCommand(join(corpus, '37-degraded-elements-v1.bpmn')));
    expect(degraded).toContain('Elementos fora do perfil');
    expect(degraded).toContain('warning(s):');
    expect(degraded).toContain('Classe certificável: NENHUMA');

    const structural = formatCertify(
      await certifyCommand(join(fixtures, 'invalid-structure.bpmn')),
    );
    expect(structural).toContain('problema(s) estruturais');
    expect(structural).toContain('STRUCT_MISSING_ATTR');
  });

  it('formats malformed and XXE rejections', async () => {
    const malformed = formatCertify(await certifyCommand(join(fixtures, 'invalid-malformed.bpmn')));
    expect(malformed).toContain('✖ XML mal-formado');
    const xxe = formatCertify(await certifyCommand(join(fixtures, 'invalid-doctype.bpmn')));
    expect(xxe).toContain('Rejeitado');
    expect(xxe).toContain('XXE-safe');
  });

  it('writes the JSON report when asked', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bpmnr-certify-'));
    const out = join(dir, 'certify-report.json');
    const report = await certifyCommand(join(corpus, '01-linear-approval-v1.bpmn'), { report: out });
    expect(report.roundTripLossless).toBe(true);
    const { readFile } = await import('node:fs/promises');
    expect(JSON.parse(await readFile(out, 'utf8')).achievedClass).toBe('descriptive');
  });
});
