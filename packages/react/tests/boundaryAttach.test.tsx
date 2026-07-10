import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner } from '../src/index.js';

/**
 * Handoff 11 N-1 — boundary drag-to-attach: dragging a lone event into the
 * 12px snap zone of an activity border highlights the border and the drop
 * ATTACHES as ONE undoable command (type → boundaryEvent + attachedToRef +
 * parametric side/t + move). Dragging an attached boundary out DETACHES; a
 * host resize REFLOWS the boundary by t inside the same command. jsdom:
 * screenToWorld falls back to client coordinates.
 */
const HOST = { x: 100, y: 100, width: 120, height: 60 }; // bottom border at y=160

function withLooseEvent(): BpmnDiagram {
  const diagram = createDiagram({ name: 'B' });
  diagram.nodes = {
    host: createNode({ type: 'task', id: 'host', label: 'Processar', ...HOST }),
    timer: createNode({ type: 'intermediateCatchEvent', id: 'timer', label: 'Timeout', x: 400, y: 300 }),
  };
  return diagram;
}

function withAttachedBoundary(): BpmnDiagram {
  const diagram = createDiagram({ name: 'B' });
  diagram.nodes = {
    host: createNode({ type: 'task', id: 'host', label: 'Processar', ...HOST }),
    timer: createNode({
      type: 'boundaryEvent',
      id: 'timer',
      label: 'Timeout',
      x: 160 - 18,
      y: 160 - 18,
      properties: { attachedToRef: 'host', boundarySide: 'bottom', boundaryT: 0.5 },
    }),
  };
  return diagram;
}

async function dragNode(
  container: HTMLElement,
  nodeId: string,
  from: [number, number],
  to: [number, number],
  { assertHighlightMidway = false } = {},
) {
  const node = container.querySelector(`[data-node-id="${nodeId}"]`)!;
  const svg = container.querySelector('svg.bpmnr-canvas')!;
  fireEvent.pointerDown(node, { button: 0, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(svg, { clientX: to[0], clientY: to[1] });
  if (assertHighlightMidway) {
    // Pointer moves flush through requestAnimationFrame — poll for the frame.
    await waitFor(() =>
      expect(container.querySelector('[data-testid="boundary-snap-highlight"]')).not.toBeNull(),
    );
  }
  fireEvent.pointerUp(svg, { button: 0, clientX: to[0], clientY: to[1] });
}

describe('boundary drag-to-attach (Handoff 11 N-1)', () => {
  it('drop inside the snap zone attaches: highlight, ONE command, side/t written', async () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withLooseEvent()} onChange={onChange} />);

    // Drag the timer's center onto the host's bottom border midpoint (160,160).
    await dragNode(container, 'timer', [418, 318], [160, 160], { assertHighlightMidway: true });

    // The highlight clears on drop; the gesture committed exactly ONE command.
    expect(container.querySelector('[data-testid="boundary-snap-highlight"]')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    const timer = latest.nodes.timer;
    expect(timer.type).toBe('boundaryEvent');
    expect(timer.properties.attachedToRef).toBe('host');
    expect(timer.properties.boundarySide).toBe('bottom');
    expect(timer.properties.boundaryT as number).toBeCloseTo(0.5, 2);
    // Centered on the border anchor.
    expect(timer.x + timer.width / 2).toBeCloseTo(160, 5);
    expect(timer.y + timer.height / 2).toBeCloseTo(160, 5);
  });

  it('no snap zone → a normal move, nothing attaches', async () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withLooseEvent()} onChange={onChange} />);
    await dragNode(container, 'timer', [418, 318], [500, 420]);
    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(latest.nodes.timer.type).toBe('intermediateCatchEvent');
    expect(latest.nodes.timer.properties.attachedToRef).toBeUndefined();
  });

  it('dragging an attached boundary OUT detaches in one command (→ intermediate)', async () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withAttachedBoundary()} onChange={onChange} />);
    await dragNode(container, 'timer', [160, 160], [420, 380]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    const timer = latest.nodes.timer;
    expect(timer.type).toBe('intermediateCatchEvent');
    expect(timer.properties.attachedToRef).toBeUndefined();
    expect(timer.properties.boundarySide).toBeUndefined();
  });

  it('sliding along the border re-attaches with a new t (still one command)', async () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withAttachedBoundary()} onChange={onChange} />);
    // From bottom t=0.5 (160,160) to bottom t≈0.25 (130,160).
    await dragNode(container, 'timer', [160, 160], [130, 160]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    const timer = latest.nodes.timer;
    expect(timer.type).toBe('boundaryEvent');
    expect(timer.properties.boundaryT as number).toBeCloseTo(0.25, 2);
  });

  it('host resize REFLOWS the attached boundary proportionally (t preserved, one command)', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withAttachedBoundary()} onChange={onChange} />);
    const svg = container.querySelector('svg.bpmnr-canvas')!;

    // Select the host, then drag its SE resize handle +80px to the right.
    const host = container.querySelector('[data-node-id="host"]')!;
    fireEvent.pointerDown(host, { button: 0, clientX: 130, clientY: 120 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 130, clientY: 120 });
    const handle = container.querySelector('[data-resize-corner="se"]')!;
    fireEvent.pointerDown(handle, { button: 0, clientX: 220, clientY: 160 });
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 160 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 300, clientY: 160 });

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(latest.nodes.host.width).toBe(200);
    // t = 0.5 over the NEW width: center lands on x = 100 + 200/2 = 200.
    const timer = latest.nodes.timer;
    expect(timer.x + timer.width / 2).toBeCloseTo(200, 5);
    expect(timer.y + timer.height / 2).toBeCloseTo(160, 5);
    // The resize + reflow ride ONE command: a single change notification.
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
