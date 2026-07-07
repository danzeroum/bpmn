import { describe, expect, it } from 'vitest';
import {
  activeEdges,
  activeNodes,
  BpmnValidationError,
  createDefaultRegistry,
  createDiagram,
  createEdge,
  createNode,
  createVersion,
} from '../src/index.js';

describe('NodeTypeRegistry', () => {
  it('registers the 12 built-in BPMN types', () => {
    const registry = createDefaultRegistry();
    expect(registry.list()).toHaveLength(12);
    expect(registry.has('startEvent')).toBe(true);
    expect(registry.has('exclusiveGateway')).toBe(true);
    expect(registry.get('task').defaultSize).toEqual({ width: 120, height: 60 });
  });

  it('rejects duplicate registrations and unknown lookups', () => {
    const registry = createDefaultRegistry();
    expect(() =>
      registry.register({
        type: 'task',
        label: 'X',
        category: 'activity',
        defaultSize: { width: 1, height: 1 },
        xml: { tag: 'task' },
      }),
    ).toThrow(BpmnValidationError);
    expect(() => registry.get('nope')).toThrow(BpmnValidationError);
  });

  it('registers custom types and resolves XML tags with preference', () => {
    const registry = createDefaultRegistry();
    registry.register({
      type: 'myDomain:persona',
      label: 'Persona',
      category: 'custom',
      defaultSize: { width: 100, height: 80 },
      xml: { tag: 'userTask' },
    });
    expect(registry.typeForXmlTag('userTask')?.type).toBe('userTask');
    expect(registry.typeForXmlTag('userTask', ['myDomain:persona'])?.type).toBe(
      'myDomain:persona',
    );
  });
});

describe('factories', () => {
  it('creates a diagram with a draft version', () => {
    const diagram = createDiagram({ name: 'Test', createdBy: 'alice' });
    expect(diagram.name).toBe('Test');
    expect(diagram.version.status).toBe('draft');
    expect(diagram.version.semanticVersion).toBe('0.1.0');
    expect(diagram.version.createdBy).toBe('alice');
    expect(diagram.nodes).toEqual({});
  });

  it('creates nodes with registry defaults', () => {
    const node = createNode({ type: 'exclusiveGateway', x: 10, y: 20 });
    expect(node.width).toBe(50);
    expect(node.label).toBe('Exclusive Gateway');
    expect(node.createdInVersion).toBe('0');
    expect(node.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects nodes of unknown type', () => {
    expect(() => createNode({ type: 'ghost' })).toThrow(BpmnValidationError);
  });

  it('creates edges with defaults and supersede chains', () => {
    const edge = createEdge({ sourceId: 'a', targetId: 'b' });
    expect(edge.type).toBe('sequenceFlow');
    const replacement = createEdge({ sourceId: 'a', targetId: 'c', supersedesEdgeId: edge.id });
    expect(replacement.supersedesEdgeId).toBe(edge.id);
  });

  it('creates versions with parent lineage', () => {
    const v1 = createVersion({ semanticVersion: '1.0.0', status: 'active' });
    const v2 = createVersion({ parentVersionId: v1.id });
    expect(v2.parentVersionId).toBe(v1.id);
    expect(v2.status).toBe('draft');
  });
});

describe('active element helpers', () => {
  it('filters out closed nodes and edges', () => {
    const diagram = createDiagram({ name: 'T' });
    const n1 = createNode({ type: 'task' });
    const n2 = { ...createNode({ type: 'task' }), removedInVersion: 'v9' };
    const e1 = createEdge({ sourceId: n1.id, targetId: n2.id });
    const e2 = { ...createEdge({ sourceId: n1.id, targetId: n2.id }), removedInVersion: 'v9' };
    diagram.nodes[n1.id] = n1;
    diagram.nodes[n2.id] = n2;
    diagram.edges[e1.id] = e1;
    diagram.edges[e2.id] = e2;
    expect(activeNodes(diagram)).toHaveLength(1);
    expect(activeEdges(diagram)).toHaveLength(1);
  });
});
