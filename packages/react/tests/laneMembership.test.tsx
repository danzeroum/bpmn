import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import {
  createDiagram,
  createNode,
  laneFlowNodeRefs,
  type BpmnDiagram,
} from '@bpmn-react/core';
import { BpmnDesigner } from '../src/index.js';

/**
 * Interactive lane membership: dropping a flow node inside a lane joins it
 * (updating `lane.properties.flowNodeRefs`), dragging it out leaves it, and
 * the whole gesture — move + membership — is a single undoable command.
 *
 * jsdom has no getScreenCTM/layout, so screenToWorld falls back to client
 * coordinates: clientX/clientY below ARE world coordinates.
 */
function build(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Lanes' });
  diagram.nodes = {
    laneA: createNode({
      type: 'lane', id: 'laneA', label: 'Authors',
      x: 0, y: 0, width: 400, height: 200,
    }),
    laneB: createNode({
      type: 'lane', id: 'laneB', label: 'Editors',
      x: 0, y: 200, width: 400, height: 200,
      properties: { flowNodeRefs: ['task1'] },
    }),
    // Center (560, 100) — outside both lanes.
    task1: createNode({ type: 'task', id: 'task1', label: 'Write', x: 500, y: 70 }),
  };
  return diagram;
}

function drag(container: HTMLElement, nodeId: string, from: [number, number], to: [number, number]) {
  const node = container.querySelector(`[data-node-id="${nodeId}"]`)!;
  const svg = container.querySelector('svg.bpmnr-canvas')!;
  fireEvent.pointerDown(node, { button: 0, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(svg, { clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(svg, { button: 0, clientX: to[0], clientY: to[1] });
}

function refsOf(diagram: BpmnDiagram, laneId: string): string[] {
  return laneFlowNodeRefs(diagram.nodes[laneId]);
}

describe('interactive lane membership', () => {
  it('dropping a node inside a lane adds it to flowNodeRefs', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={build()} onChange={onChange} />);
    // Grab task1 at its center (560, 100) and drop it inside laneA (100, 100).
    drag(container, 'task1', [560, 100], [100, 100]);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(refsOf(latest, 'laneA')).toEqual(['task1']);
    expect(latest.nodes.task1.x).not.toBe(500); // it really moved
  });

  it('moving a node between lanes leaves the old one and joins the new one', () => {
    const onChange = vi.fn();
    const diagram = build();
    // Start inside laneB.
    diagram.nodes.task1 = { ...diagram.nodes.task1, x: 100, y: 250 };
    const { container } = render(<BpmnDesigner diagram={diagram} onChange={onChange} />);
    // Center (160, 280) → drop at (160, 80): inside laneA.
    drag(container, 'task1', [160, 280], [160, 80]);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(refsOf(latest, 'laneB')).toEqual([]);
    expect(refsOf(latest, 'laneA')).toEqual(['task1']);
  });

  it('dragging a node out of every lane clears its membership', () => {
    const onChange = vi.fn();
    const diagram = build();
    diagram.nodes.task1 = { ...diagram.nodes.task1, x: 100, y: 250 }; // inside laneB
    const { container } = render(<BpmnDesigner diagram={diagram} onChange={onChange} />);
    drag(container, 'task1', [160, 280], [600, 300]); // well outside both lanes

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(refsOf(latest, 'laneB')).toEqual([]);
  });

  it('the move + membership change undoes as a single step', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={build()} onChange={onChange} />);
    drag(container, 'task1', [560, 100], [100, 100]);
    let latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(refsOf(latest, 'laneA')).toEqual(['task1']);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(refsOf(latest, 'laneA')).toEqual([]);
    expect(latest.nodes.task1.x).toBe(500); // position restored by the same undo
  });

  it('dragging a lane itself never creates membership entries', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={build()} onChange={onChange} />);
    // Drag laneB upward so it overlaps laneA.
    drag(container, 'laneB', [200, 300], [200, 160]);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(refsOf(latest, 'laneA')).toEqual([]); // laneB did not "join" laneA
    expect(refsOf(latest, 'laneB')).toEqual(['task1']); // its own refs untouched
  });

  it('refs of nodes that were not dragged are preserved', () => {
    const onChange = vi.fn();
    const diagram = build();
    diagram.nodes.task2 = createNode({ type: 'task', id: 'task2', label: 'Edit', x: 40, y: 240 });
    diagram.nodes.laneB = {
      ...diagram.nodes.laneB,
      properties: { flowNodeRefs: ['task2', 'task1'] },
    };
    diagram.nodes.task1 = { ...diagram.nodes.task1, x: 200, y: 250 }; // also in laneB
    const { container } = render(<BpmnDesigner diagram={diagram} onChange={onChange} />);
    // Move only task1 (center 260, 280) up into laneA.
    drag(container, 'task1', [260, 280], [260, 80]);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(refsOf(latest, 'laneB')).toEqual(['task2']);
    expect(refsOf(latest, 'laneA')).toEqual(['task1']);
  });
});
