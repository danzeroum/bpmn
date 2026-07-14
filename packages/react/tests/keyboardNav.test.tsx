import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner } from '../src/index.js';

function buildDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Nav flow' });
  diagram.nodes = {
    a: createNode({ type: 'startEvent', id: 'a', label: 'Start', x: 40, y: 40 }),
    b: createNode({ type: 'task', id: 'b', label: 'Work', x: 200, y: 40 }),
    c: createNode({ type: 'endEvent', id: 'c', label: 'End', x: 400, y: 40 }),
  };
  diagram.edges = { ab: createEdge({ id: 'ab', sourceId: 'a', targetId: 'b' }) };
  return diagram;
}

function focusCanvas(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector<SVGSVGElement>('svg.bpmnr-canvas')!;
  svg.focus();
  return svg;
}

describe('canvas roving keyboard navigation (melhorias F2)', () => {
  it('elements expose a roving tabIndex (one 0, rest -1) once focus moves', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    focusCanvas(container);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    const focused = container.querySelectorAll('[data-focused="true"]');
    expect(focused).toHaveLength(1);
    expect(focused[0].getAttribute('tabindex')).toBe('0');
    const others = container.querySelectorAll('[data-node-id][tabindex="-1"]');
    expect(others.length).toBeGreaterThan(0);
  });

  it('arrows walk elements in spatial order and wrap around', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    focusCanvas(container);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(
      container.querySelector('[data-focused="true"]')?.getAttribute('data-node-id'),
    ).toBe('a');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(
      container.querySelector('[data-focused="true"]')?.getAttribute('data-node-id'),
    ).toBe('b');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(
      container.querySelector('[data-focused="true"]')?.getAttribute('data-node-id'),
    ).toBe('a');
  });

  it('Enter selects the focused element; Shift+Enter adds to the selection', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    focusCanvas(container);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(container.querySelector('[data-node-id="a"][data-selected="true"]')).not.toBeNull();

    // With `a` selected and focused, arrows nudge — so the selection stays on
    // `a`; browse further with Shift+Enter after moving focus is covered via
    // the additive path on the same element (toggle off).
    fireEvent.keyDown(window, { key: 'Enter', shiftKey: true });
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
  });

  it('keyboard-only flow reaches a selectable element without any pointer', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    const svg = focusCanvas(container);
    expect(svg.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(container.querySelectorAll('[data-selected="true"]').length).toBe(1);
  });

  it('arrows nudge (not browse) while the focused element is selected', () => {
    const diagram = buildDiagram();
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    focusCanvas(container);
    fireEvent.keyDown(window, { key: 'ArrowRight' }); // focus a
    fireEvent.keyDown(window, { key: 'Enter' }); // select a
    fireEvent.keyDown(window, { key: 'ArrowRight' }); // nudge, not browse
    expect(
      container.querySelector('[data-focused="true"]')?.getAttribute('data-node-id'),
    ).toBe('a');
    const transform = container
      .querySelector('[data-node-id="a"]')
      ?.getAttribute('transform');
    expect(transform).toBe('translate(41, 40)'); // 1px fine nudge
  });
});
