import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner, BpmnViewer } from '../src/index.js';

function buildDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Pad flow' });
  diagram.nodes = {
    a: createNode({ type: 'task', id: 'a', label: 'A', x: 40, y: 40 }),
    b: createNode({ type: 'task', id: 'b', label: 'B', x: 400, y: 40 }),
  };
  diagram.edges = { ab: createEdge({ id: 'ab', sourceId: 'a', targetId: 'b' }) };
  return diagram;
}

function selectNode(container: HTMLElement, id: string) {
  const node = container.querySelector(`[data-node-id="${id}"]`)!;
  fireEvent.pointerDown(node, { button: 0 });
  fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
}

describe('context pad (referência item 1 — quick-add)', () => {
  it('appears beside a single selected node with the quick actions', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    expect(container.querySelector('[data-context-pad]')).toBeNull();
    selectNode(container, 'a');
    const pad = container.querySelector('[data-context-pad]');
    expect(pad).not.toBeNull();
    for (const action of ['task', 'gateway', 'end', 'connect', 'delete']) {
      expect(pad!.querySelector(`[data-context-pad-action="${action}"]`)).not.toBeNull();
    }
  });

  it('one click appends a connected task and selects it', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    selectNode(container, 'a');
    fireEvent.click(container.querySelector('[data-context-pad-action="task"]')!);
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-edge-id]')).toHaveLength(2);
    // The new node is selected (and gets the pad, ready to chain).
    const selected = container.querySelector('[data-node-id][data-selected="true"]');
    expect(selected).not.toBeNull();
    expect(selected!.getAttribute('data-node-id')).not.toBe('a');
    expect(selected!.getAttribute('data-node-type')).toBe('task');
  });

  it('append is one atomic undo (node + edge revert together)', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    selectNode(container, 'a');
    fireEvent.click(container.querySelector('[data-context-pad-action="gateway"]')!);
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(3);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-edge-id]')).toHaveLength(1);
  });

  it('quick-added element avoids the occupied slot to the right', () => {
    const diagram = buildDiagram();
    // `blocker` sits exactly where a quick-add from `a` would land.
    diagram.nodes.blocker = createNode({
      type: 'task',
      id: 'blocker',
      label: 'Blocker',
      x: 40 + 120 + 72,
      y: 40,
    });
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    selectNode(container, 'a');
    fireEvent.click(container.querySelector('[data-context-pad-action="task"]')!);
    const nodes = [...container.querySelectorAll('[data-node-id]')];
    const added = nodes.find(
      (n) => !['a', 'b', 'blocker'].includes(n.getAttribute('data-node-id')!),
    )!;
    const transform = added.getAttribute('transform')!;
    const [, , y] = transform.match(/translate\(([-\d.]+), ([-\d.]+)\)/)!.map(Number);
    expect(y).toBeGreaterThan(40 + 60); // pushed below the blocker
  });

  it('delete action removes the node and hides the pad', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    selectNode(container, 'a');
    fireEvent.click(container.querySelector('[data-context-pad-action="delete"]')!);
    expect(container.querySelector('[data-node-id="a"]')).toBeNull();
    expect(container.querySelector('[data-context-pad]')).toBeNull();
  });

  it('connect action starts the connection gesture', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    selectNode(container, 'a');
    fireEvent.pointerDown(
      container.querySelector('[data-context-pad-action="connect"]')!,
      { button: 0 },
    );
    expect(container.querySelector('[data-connection-preview]')).not.toBeNull();
  });

  it('never shows on multi-selection, read-only or closed nodes', () => {
    const diagram = buildDiagram();
    diagram.nodes.old = {
      ...createNode({ type: 'task', id: 'old', label: 'Old', x: 40, y: 200 }),
      removedInVersion: 'v9',
    };
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    selectNode(container, 'a');
    const nodeB = container.querySelector('[data-node-id="b"]')!;
    fireEvent.pointerDown(nodeB, { button: 0, shiftKey: true });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
    expect(container.querySelector('[data-context-pad]')).toBeNull();

    const viewer = render(<BpmnViewer diagram={buildDiagram()} />);
    expect(viewer.container.querySelector('[data-context-pad]')).toBeNull();
  });
});
