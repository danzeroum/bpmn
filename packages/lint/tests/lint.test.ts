import { describe, expect, it } from 'vitest';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import {
  conditionalFlowsRule,
  duplicateFlowRule,
  eventEndpointsRule,
  implicitJoinRule,
  implicitSplitRule,
  labelRequiredRule,
  lintDiagram,
  serviceTaskImplementationRule,
  superfluousGatewayRule,
} from '../src/index.js';

function base(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Lint' });
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Go', x: 0, y: 0 }),
    a: createNode({ id: 'a', type: 'task', label: 'Work', x: 200, y: 0 }),
    end: createNode({ id: 'end', type: 'endEvent', label: 'Done', x: 400, y: 0 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'a' }),
    e2: createEdge({ id: 'e2', sourceId: 'a', targetId: 'end' }),
  };
  return diagram;
}

describe('etiquette rules', () => {
  it('clean diagram passes every rule', () => {
    const result = lintDiagram(base());
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('LINT_LABEL_REQUIRED flags unnamed activities but not gateways', () => {
    const diagram = base();
    diagram.nodes.a = { ...diagram.nodes.a, label: '' };
    diagram.nodes.g = createNode({ id: 'g', type: 'exclusiveGateway', label: '', x: 300, y: 100 });
    const issues = labelRequiredRule(diagram);
    expect(issues.map((i) => i.nodeId)).toEqual(['a']);
  });

  it('LINT_SUPERFLUOUS_GATEWAY flags a pass-through gateway', () => {
    const diagram = base();
    diagram.nodes.g = createNode({ id: 'g', type: 'exclusiveGateway', label: 'G', x: 300, y: 0 });
    diagram.edges.e2 = createEdge({ id: 'e2', sourceId: 'a', targetId: 'g' });
    diagram.edges.e3 = createEdge({ id: 'e3', sourceId: 'g', targetId: 'end' });
    expect(superfluousGatewayRule(diagram).map((i) => i.nodeId)).toEqual(['g']);
  });

  it('implicit split/join flag activities with multiple flows', () => {
    const diagram = base();
    diagram.nodes.b = createNode({ id: 'b', type: 'task', label: 'B', x: 200, y: 150 });
    diagram.edges.e3 = createEdge({ id: 'e3', sourceId: 'a', targetId: 'b' });
    diagram.edges.e4 = createEdge({ id: 'e4', sourceId: 'b', targetId: 'end' });
    expect(implicitSplitRule(diagram).map((i) => i.nodeId)).toEqual(['a']);
    expect(implicitJoinRule(diagram).map((i) => i.nodeId)).toEqual(['end'].filter(() => false));
    // end is an event, not an activity — joins on events are fine.
    diagram.edges.e5 = createEdge({ id: 'e5', sourceId: 'start', targetId: 'b' });
    expect(implicitJoinRule(diagram).map((i) => i.nodeId)).toEqual(['b']);
  });

  it('LINT_DUPLICATE_FLOW flags a second identical connection', () => {
    const diagram = base();
    diagram.edges.dup = createEdge({ id: 'dup', sourceId: 'start', targetId: 'a' });
    const issues = duplicateFlowRule(diagram);
    expect(issues).toHaveLength(1);
    expect(issues[0].edgeId).toBe('dup');
  });

  it('event endpoint rules are errors', () => {
    const diagram = base();
    diagram.edges.bad = createEdge({ id: 'bad', sourceId: 'end', targetId: 'a' });
    const issues = eventEndpointsRule(diagram);
    expect(issues.map((i) => i.code)).toEqual(['LINT_END_WITH_OUTGOING']);
    expect(lintDiagram(diagram).valid).toBe(false);
  });
});

describe('executability rules', () => {
  it('EXEC_MISSING_IMPLEMENTATION accepts any known binding spelling', () => {
    const diagram = base();
    diagram.nodes.s1 = createNode({ id: 's1', type: 'serviceTask', label: 'S1', x: 0, y: 200 });
    diagram.nodes.s2 = createNode({
      id: 's2',
      type: 'serviceTask',
      label: 'S2',
      x: 200,
      y: 200,
      properties: { 'zeebe:taskDefinitionType': 'payment' },
    });
    const issues = serviceTaskImplementationRule(diagram);
    expect(issues.map((i) => i.nodeId)).toEqual(['s1']);
  });

  it('EXEC_UNCONDITIONED_FLOWS tolerates one implicit default', () => {
    const diagram = base();
    diagram.nodes.g = createNode({ id: 'g', type: 'exclusiveGateway', label: 'G', x: 300, y: 0 });
    diagram.nodes.b = createNode({ id: 'b', type: 'task', label: 'B', x: 500, y: 100 });
    diagram.edges.e2 = createEdge({ id: 'e2', sourceId: 'a', targetId: 'g' });
    diagram.edges.o1 = createEdge({
      id: 'o1',
      sourceId: 'g',
      targetId: 'end',
      properties: { conditionExpression: 'ok' },
    });
    diagram.edges.o2 = createEdge({ id: 'o2', sourceId: 'g', targetId: 'b' });
    expect(conditionalFlowsRule(diagram)).toEqual([]);
    // A second conditionless fork is ambiguous.
    diagram.nodes.c = createNode({ id: 'c', type: 'task', label: 'C', x: 500, y: 200 });
    diagram.edges.o3 = createEdge({ id: 'o3', sourceId: 'g', targetId: 'c' });
    expect(conditionalFlowsRule(diagram).map((i) => i.code)).toEqual(['EXEC_UNCONDITIONED_FLOWS']);
  });
});
