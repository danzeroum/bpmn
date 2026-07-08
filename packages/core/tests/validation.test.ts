import { describe, expect, it } from 'vitest';
import {
  createDefaultRegistry,
  createDiagram,
  createEdge,
  createNode,
  crossScopeEdgeRule,
  missingStartEventRule,
  subProcessParentRule,
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

  it('never flags an attached boundary event as unreachable', () => {
    const diagram = build();
    diagram.nodes.timeout = createNode({
      type: 'boundaryEvent',
      id: 'timeout',
      label: 'Timeout',
      properties: { attachedToRef: 'task' },
    });
    const result = new ValidationEngine().validate(diagram);
    expect(result.issues.some((i) => i.nodeId === 'timeout' && i.code === 'UNREACHABLE_NODE')).toBe(
      false,
    );
    expect(result.valid).toBe(true);
  });

  it('errors on a boundary event without a valid host', () => {
    const diagram = build();
    diagram.nodes.orphan = createNode({
      type: 'boundaryEvent',
      id: 'orphan',
      label: 'Orphan',
      properties: { attachedToRef: 'ghost' },
    });
    const result = new ValidationEngine().validate(diagram);
    const issue = result.issues.find((i) => i.code === 'BOUNDARY_EVENT_WITHOUT_HOST');
    expect(issue?.severity).toBe('error');
    expect(result.valid).toBe(false);
  });

  it('never flags pools/lanes as unreachable (containers are not flow nodes)', () => {
    const diagram = build();
    diagram.nodes.pool1 = createNode({ type: 'pool', id: 'pool1', label: 'P' });
    diagram.nodes.lane1 = createNode({ type: 'lane', id: 'lane1', label: 'L' });
    const result = new ValidationEngine().validate(diagram);
    expect(result.issues.some((i) => i.nodeId === 'pool1' || i.nodeId === 'lane1')).toBe(false);
    expect(result.valid).toBe(true);
  });

  it('warns about lane refs pointing at missing or closed nodes', () => {
    const diagram = build();
    diagram.nodes.lane1 = createNode({
      type: 'lane',
      id: 'lane1',
      label: 'Authors',
      properties: { flowNodeRefs: ['task', 'ghost'] },
    });
    const result = new ValidationEngine().validate(diagram);
    const stale = result.issues.filter((i) => i.code === 'STALE_LANE_REF');
    expect(stale).toHaveLength(1);
    expect(stale[0].message).toContain('ghost');
    expect(stale[0].severity).toBe('warning');
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

describe('sub-process containment rules (F7)', () => {
  function nested(): BpmnDiagram {
    const diagram = createDiagram({ name: 'Nested' });
    diagram.nodes = {
      start: createNode({ type: 'startEvent', id: 'start' }),
      sub: createNode({ type: 'subProcess', id: 'sub', properties: { isExpanded: true } }),
      innerStart: createNode({ type: 'startEvent', id: 'innerStart', properties: { parentId: 'sub' } }),
      innerTask: createNode({ type: 'task', id: 'innerTask', properties: { parentId: 'sub' } }),
      end: createNode({ type: 'endEvent', id: 'end' }),
    };
    diagram.edges = {
      f1: createEdge({ id: 'f1', sourceId: 'start', targetId: 'sub' }),
      f2: createEdge({ id: 'f2', sourceId: 'sub', targetId: 'end' }),
      inner: createEdge({ id: 'inner', sourceId: 'innerStart', targetId: 'innerTask' }),
    };
    return diagram;
  }

  it('accepts a sound hierarchy', () => {
    const diagram = nested();
    expect(subProcessParentRule(diagram)).toEqual([]);
    expect(crossScopeEdgeRule(diagram)).toEqual([]);
  });

  it('flags a parentId that is missing or not a sub-process', () => {
    const diagram = nested();
    diagram.nodes.innerTask = {
      ...diagram.nodes.innerTask,
      properties: { parentId: 'ghost' },
    };
    diagram.nodes.innerStart = {
      ...diagram.nodes.innerStart,
      properties: { parentId: 'end' },
    };
    const codes = subProcessParentRule(diagram).map((i) => i.code);
    expect(codes).toEqual(['INVALID_PARENT_REF', 'INVALID_PARENT_REF']);
  });

  it('flags containment cycles', () => {
    const diagram = createDiagram({ name: 'Cycle' });
    diagram.nodes = {
      a: createNode({ type: 'subProcess', id: 'a', properties: { parentId: 'b' } }),
      b: createNode({ type: 'subProcess', id: 'b', properties: { parentId: 'a' } }),
    };
    const codes = subProcessParentRule(diagram).map((i) => i.code);
    expect(codes).toContain('PARENT_CYCLE');
  });

  it('flags sequence flows crossing a sub-process boundary', () => {
    const diagram = nested();
    diagram.edges.leak = createEdge({ id: 'leak', sourceId: 'innerTask', targetId: 'end' });
    const issues = crossScopeEdgeRule(diagram);
    expect(issues.map((i) => i.code)).toEqual(['CROSS_SCOPE_EDGE']);
    expect(issues[0].edgeId).toBe('leak');
  });

  it('lets a boundary event on an inner activity flow inside its host scope', () => {
    const diagram = nested();
    diagram.nodes.bnd = createNode({
      type: 'boundaryEvent',
      id: 'bnd',
      properties: { attachedToRef: 'innerTask', parentId: 'sub' },
    });
    diagram.nodes.handler = createNode({
      type: 'task',
      id: 'handler',
      properties: { parentId: 'sub' },
    });
    diagram.edges.escal = createEdge({ id: 'escal', sourceId: 'bnd', targetId: 'handler' });
    expect(crossScopeEdgeRule(diagram)).toEqual([]);
  });

  it('does not let an inner start event satisfy the outer process', () => {
    const diagram = nested();
    delete diagram.nodes.start;
    delete diagram.edges.f1;
    const codes = missingStartEventRule(diagram).map((i) => i.code);
    expect(codes).toEqual(['MISSING_START_EVENT']);
  });
});
