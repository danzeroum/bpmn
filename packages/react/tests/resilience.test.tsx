import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  computeDiagramHash,
  createDefaultRegistry,
  createDiagram,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { updateNodeCommand } from '@buildtovalue/core';
import type { BpmnPlugin, EditorEvent } from '../src/index.js';
import { autosaveKey, BpmnDesigner, BpmnEditor, useDiagram } from '../src/index.js';

const BOOM_TYPE = {
  type: 'x:boom',
  label: 'Boom',
  category: 'custom' as const,
  defaultSize: { width: 100, height: 60 },
  xml: { tag: 'task' },
};

function buildDiagram(id = 'resilience-test'): BpmnDiagram {
  const registry = createDefaultRegistry();
  registry.register(BOOM_TYPE);
  const diagram = createDiagram({ id, name: 'Resilience' });
  diagram.nodes = {
    ok: createNode({ type: 'task', id: 'ok', label: 'Fine', x: 40, y: 40 }, registry),
    boom: createNode({ type: 'x:boom', id: 'boom', label: 'Broken', x: 220, y: 40 }, registry),
  };
  return diagram;
}

function boomPlugin(events: EditorEvent[]): BpmnPlugin {
  return {
    id: 'test/boom',
    nodeTypes: [BOOM_TYPE],
    shapes: {
      'x:boom': ({ node }) => {
        if (node.properties.defused !== true) throw new Error('sabotaged shape');
        return <rect width={node.width} height={node.height} />;
      },
    },
    onEditorEvent: (event) => events.push(event),
  };
}

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('D1 — shape error boundary', () => {
  beforeEach(() => {
    // React logs caught render errors — keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('replaces a throwing shape with a placeholder, keeps siblings alive, emits the event', () => {
    const events: EditorEvent[] = [];
    const { container } = render(
      <BpmnDesigner diagram={buildDiagram()} plugins={[boomPlugin(events)]} />,
    );

    const placeholder = container.querySelector('[data-node-id="boom"] [data-shape-error]')!;
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveTextContent('!');
    expect(placeholder).toHaveTextContent('x:boom');
    // Siblings and the canvas survive.
    expect(container.querySelector('[data-node-id="ok"]')).toBeInTheDocument();
    expect(container.querySelector('svg.bpmnr-canvas')).toBeInTheDocument();

    const reported = events.filter((e) => e.type === 'shape.render.error');
    expect(reported).toHaveLength(1);
    expect(reported[0].meta).toMatchObject({
      nodeId: 'boom',
      nodeType: 'x:boom',
      message: 'sabotaged shape',
    });
  });

  it('retries automatically when the node changes (immutable model)', () => {
    const events: EditorEvent[] = [];
    function Defuse() {
      const { execute } = useDiagram();
      return (
        <button
          type="button"
          onClick={() => execute(updateNodeCommand('boom', { properties: { defused: true } }))}
        >
          defuse
        </button>
      );
    }
    const { container } = render(
      <BpmnDesigner diagram={buildDiagram()} plugins={[boomPlugin(events)]}>
        <Defuse />
      </BpmnDesigner>,
    );
    expect(container.querySelector('[data-shape-error]')).toBeInTheDocument();

    // A property edit through the command bus produces a new node object —
    // the boundary resets and the real shape renders again.
    fireEvent.click(screen.getByRole('button', { name: 'defuse' }));
    expect(container.querySelector('[data-shape-error]')).toBeNull();
  });
});

describe('D2 — autosave and recovery', () => {
  it('autosaves after the debounce and marks the payload with the content hash', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const diagram = createDiagram({ id: 'autosave-write', name: 'A' });
    render(<BpmnEditor diagram={diagram} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));
    vi.advanceTimersByTime(2200);
    await vi.waitFor(() => {
      const raw = localStorage.getItem(autosaveKey('autosave-write'));
      expect(raw).toBeTruthy();
      const payload = JSON.parse(raw!);
      expect(Object.keys(payload.diagram.nodes)).toHaveLength(1);
      expect(typeof payload.hash).toBe('string');
      expect(typeof payload.savedAt).toBe('string');
    });
  });

  it('offers recovery when an autosave differs, restores through the command bus (undoable)', async () => {
    const diagram = createDiagram({ id: 'autosave-restore', name: 'R' });
    const saved = structuredClone(diagram);
    saved.nodes = { extra: createNode({ type: 'task', id: 'extra', label: 'Draft work', x: 10, y: 10 }) };
    localStorage.setItem(
      autosaveKey('autosave-restore'),
      JSON.stringify({
        savedAt: '2026-07-08T14:32:00Z',
        hash: await computeDiagramHash(saved),
        diagram: saved,
      }),
    );

    const { container } = render(<BpmnEditor diagram={diagram} />);
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Unsaved draft from');

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(container.querySelector('[data-node-id="extra"]')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    // The restore is a command: undo brings the loaded document back.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(container.querySelector('[data-node-id="extra"]')).toBeNull();
  });

  it('discard clears the stored draft', async () => {
    const diagram = createDiagram({ id: 'autosave-discard', name: 'D' });
    const saved = structuredClone(diagram);
    saved.nodes = { extra: createNode({ type: 'task', id: 'extra', label: 'X', x: 0, y: 0 }) };
    localStorage.setItem(
      autosaveKey('autosave-discard'),
      JSON.stringify({ savedAt: '2026-07-08T10:00:00Z', hash: 'different', diagram: saved }),
    );

    render(<BpmnEditor diagram={diagram} />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(localStorage.getItem(autosaveKey('autosave-discard'))).toBeNull();
  });

  it('honors the autosave opt-out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const diagram = createDiagram({ id: 'autosave-off', name: 'Off' });
    localStorage.setItem(
      autosaveKey('autosave-off'),
      JSON.stringify({ savedAt: '2026-07-08T10:00:00Z', hash: 'different', diagram }),
    );
    render(<BpmnEditor diagram={diagram} plugins={[{ id: 'test/no-autosave', autosave: false }]} />);

    // No recovery banner, and commands never write an autosave.
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));
    vi.advanceTimersByTime(2500);
    await Promise.resolve();
    expect(screen.queryByRole('alert')).toBeNull();
    const payload = JSON.parse(localStorage.getItem(autosaveKey('autosave-off'))!);
    expect(payload.hash).toBe('different'); // untouched
  });
});

describe('D3 — exit guard', () => {
  it('blocks beforeunload while dirty and releases after export', () => {
    // downloadFile touches URL/anchor APIs jsdom doesn't implement.
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const diagram = createDiagram({ id: 'guard', name: 'G' });
    render(<BpmnEditor diagram={diagram} />);

    // Clean: the guard lets the page go.
    let event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));
    event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    // An explicit export counts as a save.
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
