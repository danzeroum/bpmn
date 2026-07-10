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
  subProcessContainerAt,
  type BpmnDiagram,
} from '../src/index.js';

describe('NodeTypeRegistry', () => {
  it('registers the 26 built-in BPMN types', () => {
    const registry = createDefaultRegistry();
    expect(registry.list()).toHaveLength(26);
    expect(registry.has('agentTask')).toBe(true); // Agent Lane (Handoff 12)
    expect(registry.has('sendTask')).toBe(true);
    expect(registry.has('receiveTask')).toBe(true);
    expect(registry.has('manualTask')).toBe(true);
    expect(registry.has('startEvent')).toBe(true);
    expect(registry.has('intermediateCatchEvent')).toBe(true);
    expect(registry.has('intermediateThrowEvent')).toBe(true);
    expect(registry.has('boundaryEvent')).toBe(true);
    expect(registry.has('eventBasedGateway')).toBe(true);
    expect(registry.has('group')).toBe(true);
    expect(registry.has('exclusiveGateway')).toBe(true);
    expect(registry.has('pool')).toBe(true);
    expect(registry.has('lane')).toBe(true);
    expect(registry.get('task').defaultSize).toEqual({ width: 120, height: 60 });
    expect(registry.get('pool').xml.tag).toBe('participant');
    expect(registry.get('lane').xml.tag).toBe('lane');
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

describe('subProcessContainerAt (reparent hit-test, F7)', () => {
  // outer (expanded, 100..500 × 100..460) ⊃ inner (expanded, 200..420 × 180..380).
  function nested(): BpmnDiagram {
    const diagram = createDiagram({ name: 'Nested' });
    diagram.nodes = {
      outer: createNode({
        type: 'subProcess', id: 'outer', x: 100, y: 100, width: 400, height: 360,
        properties: { isExpanded: true },
      }),
      inner: createNode({
        type: 'subProcess', id: 'inner', x: 200, y: 180, width: 220, height: 200,
        properties: { isExpanded: true, parentId: 'outer' },
      }),
    };
    return diagram;
  }

  it('returns undefined over empty canvas', () => {
    expect(subProcessContainerAt(nested(), { x: 20, y: 20 })).toBeUndefined();
  });

  it('captures the outer container when the point is only inside it', () => {
    // Inside outer (x=120), outside inner (inner starts at x=200).
    expect(subProcessContainerAt(nested(), { x: 120, y: 300 })?.id).toBe('outer');
  });

  it('captures the DEEPEST container under the cursor', () => {
    // Inside both — the innermost (nested) wins.
    expect(subProcessContainerAt(nested(), { x: 300, y: 280 })?.id).toBe('inner');
  });

  it('excludes the dragged node and its subtree (no self-reparent)', () => {
    const diagram = nested();
    // Dragging inner (+ its subtree): the point is inside inner, but inner is
    // excluded, so it falls back to the outer container.
    expect(
      subProcessContainerAt(diagram, { x: 300, y: 280 }, new Set(['inner']))?.id,
    ).toBe('outer');
    // Excluding both leaves nothing eligible under the point.
    expect(
      subProcessContainerAt(diagram, { x: 300, y: 280 }, new Set(['inner', 'outer'])),
    ).toBeUndefined();
  });

  it('ignores collapsed sub-processes — their interior is not droppable', () => {
    const diagram = nested();
    diagram.nodes.inner.properties.isExpanded = false;
    // Point inside the (now collapsed) inner rect resolves to outer instead.
    expect(subProcessContainerAt(diagram, { x: 300, y: 280 })?.id).toBe('outer');
  });

  it('ignores removed sub-processes', () => {
    const diagram = nested();
    diagram.nodes.inner = { ...diagram.nodes.inner, removedInVersion: 'v9' };
    expect(subProcessContainerAt(diagram, { x: 300, y: 280 })?.id).toBe('outer');
  });
});
