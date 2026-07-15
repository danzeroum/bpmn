import { describe, expect, it } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import {
  CommandStack,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { BpmnDesigner } from '../src/index.js';
import {
  buildPasteCommand,
  collectClipboardPayload,
} from '../src/gestures/clipboard.js';

function buildDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Clipboard flow' });
  diagram.nodes = {
    a: createNode({ type: 'task', id: 'a', label: 'A', x: 40, y: 40 }),
    b: createNode({ type: 'userTask', id: 'b', label: 'B', x: 240, y: 40 }),
    c: createNode({ type: 'endEvent', id: 'c', label: 'C', x: 440, y: 40 }),
  };
  diagram.edges = {
    ab: createEdge({ id: 'ab', sourceId: 'a', targetId: 'b', label: 'go' }),
    bc: createEdge({ id: 'bc', sourceId: 'b', targetId: 'c' }),
  };
  return diagram;
}

describe('clipboard payload collection', () => {
  it('collects selected nodes plus edges fully inside the selection', () => {
    const diagram = buildDiagram();
    const payload = collectClipboardPayload(diagram, ['a', 'b']);
    expect(payload).not.toBeNull();
    expect(payload!.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
    // `ab` is inside the selection; `bc` leaves it and must not be copied.
    expect(payload!.edges.map((e) => e.id)).toEqual(['ab']);
  });

  it('returns null for an empty or edge-only selection', () => {
    const diagram = buildDiagram();
    expect(collectClipboardPayload(diagram, [])).toBeNull();
    expect(collectClipboardPayload(diagram, ['ab'])).toBeNull();
  });
});

describe('paste command', () => {
  it('inserts fresh ids, remaps edge endpoints and offsets positions', () => {
    const diagram = buildDiagram();
    const payload = collectClipboardPayload(diagram, ['a', 'b'])!;
    const paste = buildPasteCommand(diagram, payload)!;
    const stack = new CommandStack(diagram);
    stack.execute(paste.command);
    const after = stack.current;

    expect(Object.keys(after.nodes)).toHaveLength(5);
    expect(Object.keys(after.edges)).toHaveLength(3);
    const [newA, newB] = paste.newIds;
    expect(after.nodes[newA]).toBeDefined();
    expect(after.nodes[newA].label).toBe('A');
    expect(after.nodes[newA].x).toBe(diagram.nodes.a.x + 24);
    const newEdge = paste.newIds[2];
    expect(after.edges[newEdge].sourceId).toBe(newA);
    expect(after.edges[newEdge].targetId).toBe(newB);
    // Fresh elements are stamped with the current version, not the source's.
    expect(after.nodes[newA].createdInVersion).toBe(diagram.version.id);
  });

  it('is atomically undoable', () => {
    const diagram = buildDiagram();
    const payload = collectClipboardPayload(diagram, ['a', 'b'])!;
    const paste = buildPasteCommand(diagram, payload)!;
    const stack = new CommandStack(diagram);
    stack.execute(paste.command);
    expect(Object.keys(stack.current.nodes)).toHaveLength(5);
    stack.undo();
    expect(Object.keys(stack.current.nodes)).toHaveLength(3);
    expect(Object.keys(stack.current.edges)).toHaveLength(2);
  });

  it('drops boundary events whose host is not part of the payload or diagram', () => {
    const diagram = buildDiagram();
    diagram.nodes.bound = createNode({
      type: 'boundaryEvent',
      id: 'bound',
      label: 'Timer',
      x: 60,
      y: 80,
      properties: { attachedToRef: 'ghost' },
    });
    const payload = collectClipboardPayload(diagram, ['bound'])!;
    expect(buildPasteCommand(diagram, payload)).toBeNull();
  });

  it('remaps boundary attachment when the host is copied along', () => {
    const diagram = buildDiagram();
    diagram.nodes.bound = createNode({
      type: 'boundaryEvent',
      id: 'bound',
      label: 'Timer',
      x: 60,
      y: 80,
      properties: { attachedToRef: 'a' },
    });
    const payload = collectClipboardPayload(diagram, ['a', 'bound'])!;
    const paste = buildPasteCommand(diagram, payload)!;
    const stack = new CommandStack(diagram);
    stack.execute(paste.command);
    const after = stack.current;
    const [newA, newBound] = paste.newIds;
    expect(after.nodes[newBound].properties.attachedToRef).toBe(newA);
  });
});

describe('clipboard shortcuts (Ctrl+A / Ctrl+D)', () => {
  it('Ctrl+A selects every active element', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    expect(container.querySelectorAll('[data-selected="true"]').length).toBeGreaterThanOrEqual(3);
  });

  it('Ctrl+D duplicates the selected node', async () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    const node = container.querySelector('[data-node-id="a"]')!;
    fireEvent.pointerDown(node, { button: 0 });
    fireEvent.pointerUp(node, { button: 0 });
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    await waitFor(() => {
      expect(container.querySelectorAll('[data-node-id]').length).toBe(4);
    });
  });

  it('Ctrl+C / Ctrl+V round-trips through the clipboard fallback', async () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    const node = container.querySelector('[data-node-id="b"]')!;
    fireEvent.pointerDown(node, { button: 0 });
    fireEvent.pointerUp(node, { button: 0 });
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    await waitFor(() => {
      expect(container.querySelectorAll('[data-node-id]').length).toBe(4);
    });
  });
});
