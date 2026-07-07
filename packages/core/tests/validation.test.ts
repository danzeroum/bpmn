import { describe, expect, it } from 'vitest';
import {
  createDefaultRegistry,
  createDiagram,
  createEdge,
  createNode,
  unknownTypeRule,
  ValidationEngine,
  type BpmnDiagram,
} from '../src/index.js';

function build(): BpmnDiagram {
  const diagram = createDiagram({ name: 'T' });
  const start = createNode({ type: 'startEvent', id: 'start' });
  const task = createNode({ type: 'task', id: 'task' });
  const end = createNode({ type: 'endEvent', id: 'end' });
  diagram.nodes = { start, task, end };
  const e1 = createEdge({ id: 'e1', sourceId: 'start', targetId: 'task' });
  const e2 = createEdge({ id: 'e2', sourceId: 'task', targetId: 'end' });
  diagram.edges = { e1, e2 };
  return diagram;
}

describe('ValidationEngine', () => {
  it('accepts a well-formed diagram', () => {
    const result = new ValidationEngine().validate(build());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('flags orphan edges as errors', () => {
    const diagram = build();
    diagram.edges.bad = createEdge({ id: 'bad', sourceId: 'ghost', targetId: 'task' });
    const result = new ValidationEngine().validate(diagram);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'ORPHAN_EDGE' && i.edgeId === 'bad')).toBe(true);
  });

  it('flags self connections', () => {
    const diagram = build();
    diagram.edges.selfie = createEdge({ id: 'selfie', sourceId: 'task', targetId: 'task' });
    const result = new ValidationEngine().validate(diagram);
    expect(result.issues.some((i) => i.code === 'SELF_CONNECTION')).toBe(true);
  });

  it('warns when there is no start event', () => {
    const diagram = build();
    delete diagram.nodes.start;
    delete diagram.edges.e1;
    const result = new ValidationEngine().validate(diagram);
    expect(result.issues.some((i) => i.code === 'MISSING_START_EVENT')).toBe(true);
    // warnings do not invalidate
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('warns about unreachable nodes but ignores annotations', () => {
    const diagram = build();
    diagram.nodes.floating = createNode({ type: 'task', id: 'floating', label: 'Floating' });
    diagram.nodes.note = createNode({ type: 'textAnnotation', id: 'note' });
    const result = new ValidationEngine().validate(diagram);
    expect(result.issues.some((i) => i.code === 'UNREACHABLE_NODE' && i.nodeId === 'floating')).toBe(
      true,
    );
    expect(result.issues.some((i) => i.nodeId === 'note')).toBe(false);
  });

  it('rejects flows out of end events and into start events', () => {
    const diagram = build();
    diagram.edges.wrong1 = createEdge({ id: 'wrong1', sourceId: 'end', targetId: 'task' });
    diagram.edges.wrong2 = createEdge({ id: 'wrong2', sourceId: 'task', targetId: 'start' });
    const result = new ValidationEngine().validate(diagram);
    expect(result.issues.some((i) => i.code === 'END_EVENT_OUTGOING')).toBe(true);
    expect(result.issues.some((i) => i.code === 'START_EVENT_INCOMING')).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('ignores closed elements when checking reachability', () => {
    const diagram = build();
    diagram.nodes.closed = {
      ...createNode({ type: 'task', id: 'closed' }),
      removedInVersion: 'v1',
    };
    const result = new ValidationEngine().validate(diagram);
    expect(result.issues.some((i) => i.nodeId === 'closed')).toBe(false);
  });

  it('supports plugin rules via addRule and unknownTypeRule', () => {
    const engine = new ValidationEngine();
    engine.addRule(unknownTypeRule(createDefaultRegistry()));
    const diagram = build();
    diagram.nodes.alien = { ...createNode({ type: 'task', id: 'alien' }), type: 'alien:thing' };
    const result = engine.validate(diagram);
    expect(result.issues.some((i) => i.code === 'UNKNOWN_NODE_TYPE')).toBe(true);
  });
});
