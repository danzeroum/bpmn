import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnEditor } from '../src/index.js';
import { computeGuideSnap } from '../src/canvas/smartGuides.js';

function messy(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Messy' });
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', x: 500, y: 500 }),
    a: createNode({ id: 'a', type: 'task', x: 90, y: 400 }),
    b: createNode({ id: 'b', type: 'task', x: 10, y: 10 }),
    end: createNode({ id: 'end', type: 'endEvent', x: 5, y: 700 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'a' }),
    e2: createEdge({ id: 'e2', sourceId: 'a', targetId: 'b' }),
    e3: createEdge({ id: 'e3', sourceId: 'b', targetId: 'end' }),
  };
  return diagram;
}

function nodeX(container: HTMLElement, id: string): number {
  const transform = container
    .querySelector(`[data-node-id="${id}"]`)!
    .getAttribute('transform')!;
  return Number(transform.match(/translate\(([-\d.]+),/)![1]);
}

describe('toolbar auto-arrange (referência item 2)', () => {
  it('lays the chain out left-to-right in one undoable command', () => {
    const { container } = render(<BpmnEditor diagram={messy()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Auto-arrange the diagram' }));
    expect(nodeX(container, 'start')).toBeLessThan(nodeX(container, 'a'));
    expect(nodeX(container, 'a')).toBeLessThan(nodeX(container, 'b'));
    expect(nodeX(container, 'b')).toBeLessThan(nodeX(container, 'end'));
    // One undo restores the mess.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(nodeX(container, 'start')).toBe(500);
  });
});

describe('align/distribute via context menu', () => {
  it('aligns top edges of a multi-selection', () => {
    const { container } = render(<BpmnEditor diagram={messy()} />);
    fireEvent.pointerDown(container.querySelector('[data-node-id="a"]')!, { button: 0 });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
    fireEvent.pointerDown(container.querySelector('[data-node-id="b"]')!, {
      button: 0,
      shiftKey: true,
    });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
    fireEvent.contextMenu(container.querySelector('[data-node-id="a"]')!);
    const item = container.querySelector('[data-menu-item="selection.align-top"]');
    expect(item).not.toBeNull();
    fireEvent.click(item!);
    const y = (id: string) =>
      Number(
        container
          .querySelector(`[data-node-id="${id}"]`)!
          .getAttribute('transform')!
          .match(/, ([-\d.]+)\)/)![1],
      );
    expect(y('a')).toBe(y('b'));
  });
});

describe('smart guide snapping (pure)', () => {
  it('magnetizes within the threshold and emits a guide', () => {
    const diagram = messy();
    // Drag `a` so its top would land 4px off `b`'s top: 10 - 400 = -390 → dy -386.
    const snap = computeGuideSnap(diagram, null, diagram.nodes.a, 0, -386, new Set(['a']));
    expect(snap.dy).toBe(-390);
    expect(snap.guides.some((g) => g.axis === 'h' && g.position === 10)).toBe(true);
  });

  it('leaves the offset alone outside the threshold', () => {
    const diagram = messy();
    const snap = computeGuideSnap(diagram, null, diagram.nodes.a, 0, -300, new Set(['a']));
    expect(snap.dy).toBe(-300);
  });
});
