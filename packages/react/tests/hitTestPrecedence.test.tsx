import { describe, expect, it } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner } from '../src/index.js';

/**
 * Cerca §1.4 (Handoff 14) — the BINDING hit-test precedence map of the
 * canvas' five pointer systems:
 *
 *   1. resize handles (corners)
 *   2. context pad (right column, active selection)
 *   3. ports (borders)
 *   4. boundary-snap 12px (during drag)
 *   5. reparent (drop on container)
 *
 * Each test pins one ordering via observable outcomes (never internals):
 * which gesture actually starts / which overlay actually arms.
 */

function buildDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Precedence' });
  diagram.nodes = {
    a: createNode({ type: 'task', id: 'a', label: 'A', x: 200, y: 200 }),
  };
  return diagram;
}

function select(container: HTMLElement, id: string) {
  const node = container.querySelector(`[data-node-id="${id}"]`)!;
  fireEvent.pointerDown(node, { button: 0 });
  fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
}

describe('hit-test precedence (cerca §1.4 — binding)', () => {
  it('1>2/3: a resize-handle pointerdown starts a RESIZE — never a pad action, port connect or node drag', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    select(container, 'a');
    const handle = container.querySelector('[data-resize-corner="se"]')!;
    fireEvent.pointerDown(handle, { button: 0, clientX: 320, clientY: 260 });
    fireEvent.pointerMove(container.querySelector('svg.bpmnr-canvas')!, {
      clientX: 360,
      clientY: 300,
    });
    // No connection gesture began and no pad action fired (node count stable);
    // the node still exists and no new elements appeared.
    expect(container.querySelector('[data-connection-preview]')).toBeNull();
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(1);
  });

  it('2>3: pad buttons swallow the pointer — an append click never begins a port connection', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    select(container, 'a');
    const padTask = container.querySelector('[data-context-pad-action="task"]')!;
    fireEvent.pointerDown(padTask, { button: 0 });
    expect(container.querySelector('[data-connection-preview]')).toBeNull();
    fireEvent.click(padTask);
    // The pad action ran (append), proving the pad owned the pointer.
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(2);
  });

  it('2: pad pointerdown never starts a node drag or lasso behind it', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    select(container, 'a');
    const before = container.querySelector('[data-node-id="a"]')!.getAttribute('transform');
    const padMore = container.querySelector('[data-context-pad-action="more"]')!;
    fireEvent.pointerDown(padMore, { button: 0, clientX: 340, clientY: 230 });
    fireEvent.pointerMove(container.querySelector('svg.bpmnr-canvas')!, {
      clientX: 420,
      clientY: 300,
    });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
    expect(container.querySelector('[data-node-id="a"]')!.getAttribute('transform')).toBe(before);
    expect(container.querySelector('[data-selection-box]')).toBeNull();
  });

  it('3: a port pointerdown starts a CONNECTION — never a node drag', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    select(container, 'a');
    const before = container.querySelector('[data-node-id="a"]')!.getAttribute('transform');
    const port = container.querySelector('[data-port]')!;
    fireEvent.pointerDown(port, { button: 0 });
    fireEvent.pointerMove(container.querySelector('svg.bpmnr-canvas')!, {
      clientX: 500,
      clientY: 400,
    });
    expect(container.querySelector('[data-connection-preview]')).not.toBeNull();
    expect(container.querySelector('[data-node-id="a"]')!.getAttribute('transform')).toBe(before);
  });

  it('4>5: while a boundary snap is armed, the reparent target NEVER lights up', async () => {
    const diagram = createDiagram({ name: 'P2' });
    diagram.nodes = {
      sub: createNode({
        type: 'subProcess',
        id: 'sub',
        label: 'Sub',
        x: 100,
        y: 100,
        width: 320,
        height: 220,
        properties: { isExpanded: true },
      }),
      host: createNode({
        type: 'task',
        id: 'host',
        label: 'Host',
        x: 140,
        y: 160,
        properties: { parentId: 'sub' },
      }),
      ev: createNode({ type: 'intermediateCatchEvent', id: 'ev', label: 'Ev', x: 600, y: 400 }),
    };
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    const ev = container.querySelector('[data-node-id="ev"]')!;
    // Drag the lone event to the host's border INSIDE the expanded
    // sub-process: both systems are candidates; boundary-snap must win.
    fireEvent.pointerDown(ev, { button: 0, clientX: 618, clientY: 418 });
    fireEvent.pointerMove(svg, { clientX: 262, clientY: 162 }); // on host's top border
    // Pointer moves flush through requestAnimationFrame — poll for the frame.
    await waitFor(() =>
      expect(container.querySelector('[data-testid="boundary-snap-highlight"]')).not.toBeNull(),
    );
    expect(container.querySelector('[data-testid="reparent-target-highlight"]')).toBeNull();
    fireEvent.pointerUp(svg, { button: 0 });
  });

  it('5: without a boundary candidate, dropping inside the container arms reparent', async () => {
    const diagram = createDiagram({ name: 'P3' });
    diagram.nodes = {
      sub: createNode({
        type: 'subProcess',
        id: 'sub',
        label: 'Sub',
        x: 100,
        y: 100,
        width: 320,
        height: 220,
        properties: { isExpanded: true },
      }),
      task: createNode({ type: 'task', id: 'task', label: 'T', x: 600, y: 400 }),
    };
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    const task = container.querySelector('[data-node-id="task"]')!;
    fireEvent.pointerDown(task, { button: 0, clientX: 660, clientY: 430 });
    fireEvent.pointerMove(svg, { clientX: 260, clientY: 210 }); // empty area inside sub
    await waitFor(() =>
      expect(
        container.querySelector('[data-testid="reparent-target-highlight"]'),
      ).not.toBeNull(),
    );
    expect(container.querySelector('[data-testid="boundary-snap-highlight"]')).toBeNull();
    fireEvent.pointerUp(svg, { button: 0 });
  });
});
