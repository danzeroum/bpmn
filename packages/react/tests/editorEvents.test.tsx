import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import type { BpmnPlugin, EditorEvent } from '../src/index.js';
import { BpmnEditor, resolveEditorConfig } from '../src/index.js';

function buildDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Events' });
  diagram.nodes = { t1: createNode({ type: 'task', id: 't1', label: 'Work', x: 40, y: 40 }) };
  return diagram;
}

describe('onEditorEvent (observability, zero deps)', () => {
  it('fans out to every plugin handler with a shared timestamped event', () => {
    const first = vi.fn();
    const second = vi.fn();
    const config = resolveEditorConfig([
      { id: 'obs/one', onEditorEvent: first },
      { id: 'obs/two', onEditorEvent: second },
    ]);
    config.emitEditorEvent('node.created', { nodeType: 'task' });

    expect(first).toHaveBeenCalledTimes(1);
    const event = first.mock.calls[0][0] as EditorEvent;
    expect(event.type).toBe('node.created');
    expect(typeof event.ts).toBe('number');
    expect(event.meta).toEqual({ nodeType: 'task' });
    // Same event object reaches every handler.
    expect(second).toHaveBeenCalledWith(event);
  });

  it('is a safe no-op when no plugin registers a handler', () => {
    const config = resolveEditorConfig([]);
    expect(() => config.emitEditorEvent('render.slow', { frameMs: 40 })).not.toThrow();
  });

  it('emits node.created when a palette item is used', () => {
    const events: EditorEvent[] = [];
    const plugin: BpmnPlugin = { id: 'obs/capture', onEditorEvent: (e) => events.push(e) };
    render(<BpmnEditor diagram={buildDiagram()} plugins={[plugin]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add User Task' }));

    const created = events.filter((e) => e.type === 'node.created');
    expect(created).toHaveLength(1);
    expect(created[0].meta).toEqual({ nodeType: 'userTask' });
  });
});
