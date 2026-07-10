import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner, BpmnViewer } from '../src/index.js';

function build(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Inline flow' });
  diagram.nodes = {
    task1: createNode({ type: 'task', id: 'task1', label: 'Original', x: 40, y: 40 }),
  };
  return diagram;
}

function editor(container: HTMLElement, id: string) {
  return container.querySelector<HTMLInputElement>(`[data-node-label-editor="${id}"]`);
}

describe('inline label editing', () => {
  it('opens an editor on double-click, prefilled with the current label', () => {
    const { container } = render(<BpmnDesigner diagram={build()} />);
    expect(editor(container, 'task1')).toBeNull();

    fireEvent.doubleClick(container.querySelector('[data-node-id="task1"]')!);
    const input = editor(container, 'task1')!;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Original');
  });

  it('commits the new label on Enter', () => {
    const { container } = render(<BpmnDesigner diagram={build()} />);
    fireEvent.doubleClick(container.querySelector('[data-node-id="task1"]')!);
    const input = editor(container, 'task1')!;
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(editor(container, 'task1')).toBeNull(); // closed
    expect(container.querySelector('[data-node-id="task1"]')!.textContent).toContain('Renamed');
  });

  it('commits on blur', () => {
    const { container } = render(<BpmnDesigner diagram={build()} />);
    fireEvent.doubleClick(container.querySelector('[data-node-id="task1"]')!);
    const input = editor(container, 'task1')!;
    fireEvent.change(input, { target: { value: 'Blurred' } });
    fireEvent.blur(input);
    expect(container.querySelector('[data-node-id="task1"]')!.textContent).toContain('Blurred');
  });

  it('cancels on Escape, keeping the original label', () => {
    const { container } = render(<BpmnDesigner diagram={build()} />);
    fireEvent.doubleClick(container.querySelector('[data-node-id="task1"]')!);
    const input = editor(container, 'task1')!;
    fireEvent.change(input, { target: { value: 'Discarded' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(editor(container, 'task1')).toBeNull();
    const text = container.querySelector('[data-node-id="task1"]')!.textContent;
    expect(text).toContain('Original');
    expect(text).not.toContain('Discarded');
  });

  it('the commit is undoable', () => {
    const { container } = render(<BpmnDesigner diagram={build()} />);
    fireEvent.doubleClick(container.querySelector('[data-node-id="task1"]')!);
    const input = editor(container, 'task1')!;
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(container.querySelector('[data-node-id="task1"]')!.textContent).toContain('Renamed');

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(container.querySelector('[data-node-id="task1"]')!.textContent).toContain('Original');
  });

  it('an empty label is ignored (keeps the original)', () => {
    const { container } = render(<BpmnDesigner diagram={build()} />);
    fireEvent.doubleClick(container.querySelector('[data-node-id="task1"]')!);
    const input = editor(container, 'task1')!;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(container.querySelector('[data-node-id="task1"]')!.textContent).toContain('Original');
  });

  it('does not open in read-only mode', () => {
    const { container } = render(<BpmnViewer diagram={build()} />);
    fireEvent.doubleClick(container.querySelector('[data-node-id="task1"]')!);
    expect(editor(container, 'task1')).toBeNull();
  });
});
