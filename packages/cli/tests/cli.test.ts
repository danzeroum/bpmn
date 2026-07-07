import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  createDiagram,
  createEdge,
  createNode,
  JsonSerializer,
} from '@bpmn-react/core';
import {
  diffCommand,
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
