import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import {
  createDiagram,
  createEdge,
  createNode,
  crossScopeEdgeRule,
  nodeParentId,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { BpmnDesigner } from '../src/index.js';

/**
 * F7 reparent-on-drop: dropping a node over an EXPANDED sub-process writes the
 * node's parentId in one undoable command fused with the move; dragging it out
 * clears the parentId the same way. A container highlight arms during the drag
 * (reusing the boundary-snap affordance), and boundary snap takes precedence
 * over reparent so the N-1 attach gesture is never hijacked. Coordinates are
 * absolute — reparent never translates them.
 *
 * jsdom has no layout, so screenToWorld falls back to client coordinates:
 * clientX/clientY below ARE world coordinates. Pointer moves flush through
 * requestAnimationFrame, so mid-drag assertions poll via waitFor.
 */

// Expanded sub-process spanning 100..500 × 100..400, with one seed child.
function withOutsideTask(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Reparent' });
  diagram.nodes = {
    sub: createNode({
      type: 'subProcess', id: 'sub', label: 'Fulfil',
      x: 100, y: 100, width: 400, height: 300, properties: { isExpanded: true },
    }),
    seed: createNode({
      type: 'startEvent', id: 'seed', x: 140, y: 150, properties: { parentId: 'sub' },
    }),
    A: createNode({ type: 'task', id: 'A', label: 'Pick', x: 560, y: 140 }),
  };
  return diagram;
}

// Same sub-process, but task A already lives inside it.
function withInsideChild(): BpmnDiagram {
  const diagram = withOutsideTask();
  diagram.nodes.A = { ...diagram.nodes.A, x: 200, y: 200, properties: { parentId: 'sub' } };
  return diagram;
}

function dragHandle(container: HTMLElement, nodeId: string) {
  const node = container.querySelector(`[data-node-id="${nodeId}"]`)!;
  const svg = container.querySelector('svg.bpmnr-canvas')!;
  return {
    down: (x: number, y: number) => fireEvent.pointerDown(node, { button: 0, clientX: x, clientY: y }),
    move: (x: number, y: number) => fireEvent.pointerMove(svg, { clientX: x, clientY: y }),
    up: (x: number, y: number) => fireEvent.pointerUp(svg, { button: 0, clientX: x, clientY: y }),
  };
}

function drag(container: HTMLElement, nodeId: string, from: [number, number], to: [number, number]) {
  const h = dragHandle(container, nodeId);
  h.down(...from);
  h.move(...to);
  h.up(...to);
}

describe('reparent-on-drop (F7)', () => {
  it('dropping a node into an expanded sub-process sets its parentId (and it moves)', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withOutsideTask()} onChange={onChange} />);
    // A center (620,170) → cursor (300,250), inside the sub-process.
    drag(container, 'A', [620, 170], [300, 250]);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(nodeParentId(latest.nodes.A)).toBe('sub');
    // Absolute DI: position = original + drag delta, no extra translation.
    expect(latest.nodes.A.x).toBe(560 + (300 - 620));
    expect(latest.nodes.A.y).toBe(140 + (250 - 170));
  });

  it('dragging a child out of the sub-process clears its parentId', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withInsideChild()} onChange={onChange} />);
    // A center (260,230) → cursor (700,600), well outside every container.
    drag(container, 'A', [260, 230], [700, 600]);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(nodeParentId(latest.nodes.A)).toBeUndefined();
  });

  it('reparent + move is ONE undoable command', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withOutsideTask()} onChange={onChange} />);
    drag(container, 'A', [620, 170], [300, 250]);
    expect(onChange).toHaveBeenCalledTimes(1); // one composite, not two
    expect(nodeParentId((onChange.mock.lastCall![0] as BpmnDiagram).nodes.A)).toBe('sub');

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    const undone = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(nodeParentId(undone.nodes.A)).toBeUndefined(); // parentId restored…
    expect(undone.nodes.A.x).toBe(560); // …and position, by the same undo
  });

  it('highlights the candidate container mid-drag, and clears it on drop', async () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withOutsideTask()} onChange={onChange} />);
    const h = dragHandle(container, 'A');
    h.down(620, 170);
    h.move(300, 250);
    await waitFor(() =>
      expect(container.querySelector('[data-testid="reparent-target-highlight"]')).not.toBeNull(),
    );
    h.up(300, 250);
    expect(container.querySelector('[data-testid="reparent-target-highlight"]')).toBeNull();
  });

  it('no highlight when the cursor is over no container → no reparent on drop', async () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withOutsideTask()} onChange={onChange} />);
    const h = dragHandle(container, 'A');
    h.down(620, 170);
    h.move(700, 600); // empty canvas
    await waitFor(() =>
      expect(container.querySelector('[data-node-id="A"]')).not.toBeNull(),
    );
    expect(container.querySelector('[data-testid="reparent-target-highlight"]')).toBeNull();
    h.up(700, 600);
    expect(nodeParentId((onChange.mock.lastCall![0] as BpmnDiagram).nodes.A)).toBeUndefined();
  });

  it('boundary snap takes precedence: near the border it attaches, never reparents', async () => {
    const onChange = vi.fn();
    const diagram = withOutsideTask();
    diagram.nodes.ev = createNode({
      type: 'intermediateCatchEvent', id: 'ev', label: 'Timeout', x: 560, y: 300,
    });
    const { container } = render(<BpmnDesigner diagram={diagram} onChange={onChange} />);
    const h = dragHandle(container, 'ev');
    h.down(578, 318);
    // (300,396): INSIDE the sub rect AND 4px from its bottom border (y=400).
    h.move(300, 396);
    await waitFor(() =>
      expect(container.querySelector('[data-testid="boundary-snap-highlight"]')).not.toBeNull(),
    );
    // Boundary snap wins — the reparent highlight never lights up.
    expect(container.querySelector('[data-testid="reparent-target-highlight"]')).toBeNull();
    h.up(300, 396);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(latest.nodes.ev.type).toBe('boundaryEvent'); // attached, not reparented
    expect(latest.nodes.ev.properties.attachedToRef).toBe('sub');
    expect(nodeParentId(latest.nodes.ev)).toBeUndefined();
  });

  it('a flow crossing the boundary after reparent is flagged, never silenced or deleted', () => {
    const onChange = vi.fn();
    const diagram = withOutsideTask();
    // A and B both top-level, joined by a flow; reparent A into the sub-process.
    diagram.nodes.B = createNode({ type: 'task', id: 'B', label: 'Ship', x: 720, y: 140 });
    diagram.edges = { F: createEdge({ id: 'F', sourceId: 'A', targetId: 'B' }) };
    const { container } = render(<BpmnDesigner diagram={diagram} onChange={onChange} />);
    drag(container, 'A', [620, 170], [300, 250]);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(nodeParentId(latest.nodes.A)).toBe('sub');
    // The edge is untouched — reparent never deletes it…
    expect(latest.edges.F).toMatchObject({ sourceId: 'A', targetId: 'B' });
    // …and the existing validation now surfaces the cross-boundary flow.
    const issues = crossScopeEdgeRule(latest);
    expect(issues.some((i) => i.code === 'CROSS_SCOPE_EDGE' && i.edgeId === 'F')).toBe(true);
  });
});

describe('the original symptom: two connected nodes dragged in (F7)', () => {
  // Two top-level tasks joined by a flow, both outside the sub-process.
  function withPair(): BpmnDiagram {
    const diagram = withOutsideTask();
    delete diagram.nodes.A;
    diagram.nodes.P = createNode({ type: 'task', id: 'P', label: 'P', x: 560, y: 140 });
    diagram.nodes.Q = createNode({ type: 'task', id: 'Q', label: 'Q', x: 720, y: 140 });
    diagram.edges = { PQ: createEdge({ id: 'PQ', sourceId: 'P', targetId: 'Q' }) };
    return diagram;
  }

  it('reparenting BOTH endpoints keeps their flow internal and visible (not a cross-scope error)', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withPair()} onChange={onChange} />);
    // Multi-select P then Q, then drag the selection into the sub-process.
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    const p = container.querySelector('[data-node-id="P"]')!;
    const q = container.querySelector('[data-node-id="Q"]')!;
    fireEvent.pointerDown(p, { button: 0, clientX: 620, clientY: 170 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 620, clientY: 170 });
    fireEvent.pointerDown(q, { button: 0, clientX: 780, clientY: 170, shiftKey: true });
    fireEvent.pointerUp(svg, { button: 0, clientX: 780, clientY: 170, shiftKey: true });
    // Drag the (still-selected) pair by P into the sub-process interior.
    fireEvent.pointerDown(p, { button: 0, clientX: 620, clientY: 170 });
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 250 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 300, clientY: 250 });

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(nodeParentId(latest.nodes.P)).toBe('sub');
    expect(nodeParentId(latest.nodes.Q)).toBe('sub');
    // Both endpoints share the sub-process scope: the flow is internal, valid,
    // and still rendered — the original bug was it vanishing under the body.
    expect(crossScopeEdgeRule(latest)).toEqual([]);
    expect(container.querySelector('[data-edge-id="PQ"]')).toBeInTheDocument();

    // Collapsing hides the pair AND their flow (real containment now).
    fireEvent.click(container.querySelector('[data-subprocess-toggle]')!);
    expect(container.querySelector('[data-node-id="P"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-edge-id="PQ"]')).not.toBeInTheDocument();
  });
});

describe('reparent interacts with collapse & drill (F7-2)', () => {
  it('a freshly reparented child hides on collapse and shows on drill', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withOutsideTask()} onChange={onChange} />);
    drag(container, 'A', [620, 170], [300, 250]); // A becomes a child of sub

    // Collapse the sub-process: the new child disappears with the rest.
    fireEvent.click(container.querySelector('[data-subprocess-toggle]')!);
    expect(container.querySelector('[data-node-id="A"]')).not.toBeInTheDocument();

    // Drill into the sub-process: the new child is among its contents.
    fireEvent.click(container.querySelector('[data-subprocess-drill]')!);
    expect(container.querySelector('[data-node-id="A"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-id="sub"]')).not.toBeInTheDocument();
  });
});
