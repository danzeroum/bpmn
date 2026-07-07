import { describe, expect, it } from 'vitest';
import {
  BpmnParseError,
  createDiagram,
  createNode,
  createSnapshot,
  JsonSerializer,
  verifySnapshot,
} from '../src/index.js';

describe('JsonSerializer', () => {
  it('round-trips a diagram', () => {
    const serializer = new JsonSerializer();
    const diagram = createDiagram({ name: 'Json flow' });
    const node = createNode({ type: 'task', id: 'n1' });
    diagram.nodes[node.id] = node;

    const restored = serializer.deserialize(serializer.serialize(diagram));
    expect(restored.name).toBe('Json flow');
    expect(restored.nodes.n1.type).toBe('task');
    expect(restored.version.status).toBe('draft');
  });

  it('rejects invalid JSON and missing fields', () => {
    const serializer = new JsonSerializer();
    expect(() => serializer.deserialize('{oops')).toThrow(BpmnParseError);
    expect(() => serializer.deserialize('"just a string"')).toThrow(/JSON object/);
    expect(() => serializer.deserialize('{"id":"x","name":"y"}')).toThrow(/version/);
  });

  it('defaults optional fields', () => {
    const serializer = new JsonSerializer();
    const minimal = JSON.stringify({
      id: 'd',
      name: 'D',
      version: { id: 'v', semanticVersion: '1.0.0', status: 'draft' },
      nodes: {},
      edges: {},
    });
    const diagram = serializer.deserialize(minimal);
    expect(diagram.description).toBe('');
    expect(diagram.metadata).toEqual({});
  });
});

describe('snapshots', () => {
  it('captures and verifies content', async () => {
    const diagram = createDiagram({ name: 'S' });
    diagram.nodes.n1 = createNode({ type: 'task', id: 'n1' });

    const snapshot = await createSnapshot(diagram, 'alice');
    expect(snapshot.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.createdBy).toBe('alice');
    expect(await verifySnapshot(snapshot)).toBe(true);

    // The snapshot is a deep copy — later edits don't affect it
    diagram.nodes.n1.label = 'changed after snapshot';
    expect(await verifySnapshot(snapshot)).toBe(true);

    // Tampering with the snapshot content is detected
    snapshot.diagram.nodes.n1.label = 'tampered';
    expect(await verifySnapshot(snapshot)).toBe(false);
  });
});
