import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@bpmn-react/core';
import { BpmnDesigner } from '../src/index.js';

/**
 * Production-readiness (v1.0) checks: StrictMode double-invocation safety,
 * rendering at the documented scale ceiling, and listener cleanup on unmount.
 */

function smallDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Strict' });
  diagram.nodes = {
    task1: createNode({ type: 'task', id: 'task1', label: 'Original', x: 40, y: 40 }),
  };
  return diagram;
}

describe('React StrictMode', () => {
  it('applies an edit exactly once under double-invoked effects/renders', () => {
    const onChange = vi.fn();
    const { container } = render(
      <StrictMode>
        <BpmnDesigner diagram={smallDiagram()} onChange={onChange} />
      </StrictMode>,
    );

    fireEvent.doubleClick(container.querySelector('[data-node-id="task1"]')!);
    const input = container.querySelector<HTMLInputElement>('[data-node-label-editor="task1"]')!;
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const label = container.querySelector('[data-node-id="task1"]')!.textContent;
    expect(label).toContain('Renamed');
    expect(label).not.toContain('RenamedRenamed');

    // A single undo fully restores — proof the command executed once.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(container.querySelector('[data-node-id="task1"]')!.textContent).toContain('Original');
  });

  it('deleting a node under StrictMode removes it exactly once and undo restores it', () => {
    const { container } = render(
      <StrictMode>
        <BpmnDesigner diagram={smallDiagram()} />
      </StrictMode>,
    );
    fireEvent.pointerDown(container.querySelector('[data-node-id="task1"]')!, { button: 0 });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(container.querySelector('[data-node-id="task1"]')).toBeNull();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(container.querySelector('[data-node-id="task1"]')).not.toBeNull();
  });
});

describe('scale ceiling', () => {
  it('virtualizes the documented ~350-node scale (renders only the visible subset)', () => {
    const diagram = createDiagram({ name: 'Big' });
    const COUNT = 350;
    for (let i = 0; i < COUNT; i++) {
      const id = `n${i}`;
      diagram.nodes[id] = createNode({
        type: i % 5 === 0 ? 'exclusiveGateway' : 'task',
        id,
        label: `Step ${i}`,
        x: (i % 20) * 160,
        y: Math.floor(i / 20) * 110,
      });
      if (i > 0) {
        diagram.edges[`e${i}`] = createEdge({ id: `e${i}`, sourceId: `n${i - 1}`, targetId: id });
      }
    }

    const { container } = render(<BpmnDesigner diagram={diagram} />);
    // Viewport culling: the 350-node model renders without error, but only the
    // on-screen subset is mounted in the DOM (not all COUNT nodes/edges).
    const renderedNodes = container.querySelectorAll('[data-node-id]').length;
    expect(renderedNodes).toBeGreaterThan(0);
    expect(renderedNodes).toBeLessThan(COUNT);
    expect(container.querySelectorAll('[data-edge-id]').length).toBeLessThan(COUNT - 1);
    // Culling is a render concern only — the full model is intact.
    expect(Object.keys(diagram.nodes)).toHaveLength(COUNT);
  });
});

describe('unmount cleanup', () => {
  it('removes window listeners — keyboard events after unmount neither throw nor mutate', () => {
    const onChange = vi.fn();
    const { container, unmount } = render(
      <BpmnDesigner diagram={smallDiagram()} onChange={onChange} />,
    );
    fireEvent.pointerDown(container.querySelector('[data-node-id="task1"]')!, { button: 0 });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
    unmount();
    onChange.mockClear();

    expect(() => {
      fireEvent.keyDown(window, { key: 'Delete' });
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
      fireEvent.keyDown(window, { key: ' ' });
    }).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});
