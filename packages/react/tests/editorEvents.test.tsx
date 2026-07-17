import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import {
  createDiagram,
  createNode,
  removeNodeCommand,
  updateNodeCommand,
  type BpmnDiagram,
} from '@buildtovalue/core';
import type { BpmnPlugin, EditorEvent } from '../src/index.js';
import {
  BpmnDesigner,
  BpmnEditor,
  DEPRECATED_EVENT_ALIASES,
  EDITOR_EVENTS,
  PromotionPanel,
  PT_BR,
  resolveEditorConfig,
  useCanvasStore,
  useDiagram,
} from '../src/index.js';
import type { DiagramContextValue } from '../src/contexts/DiagramContext.js';
import type { CanvasStore } from '../src/state/canvasStore.js';

/**
 * Handoff 11 N-3 — the PUBLIC event bus: complete typed catalog on the
 * existing `onEditorEvent` channel (no global emitter), deprecated aliases
 * emitting alongside for one minor with a SINGLE console warning, and the
 * semver stability contract frozen by EDITOR_EVENTS + the apiSurface test.
 * Every catalog event is exercised below.
 */
function buildDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Events' });
  diagram.nodes = { t1: createNode({ type: 'task', id: 't1', label: 'Work', x: 40, y: 40 }) };
  return diagram;
}

function capture(): { events: EditorEvent[]; plugin: BpmnPlugin } {
  const events: EditorEvent[] = [];
  return { events, plugin: { id: 'obs/capture', onEditorEvent: (e) => events.push(e) } };
}

/** Exposes the diagram context + canvas store to the test body. */
function Driver({ onReady }: { onReady: (api: DiagramContextValue & { store: CanvasStore }) => void }) {
  const diagram = useDiagram();
  const store = useCanvasStore();
  useEffect(() => {
    onReady({ ...diagram, store });
  });
  return null;
}

const of = (events: EditorEvent[], type: string) => events.filter((e) => e.type === type);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('onEditorEvent (observability, zero deps)', () => {
  it('fans out to every plugin handler with a shared timestamped event', () => {
    const first = vi.fn();
    const second = vi.fn();
    const config = resolveEditorConfig([
      { id: 'obs/one', onEditorEvent: first },
      { id: 'obs/two', onEditorEvent: second },
    ]);
    config.emitEditorEvent('render.slow', { frameMs: 40 });

    expect(first).toHaveBeenCalledTimes(1);
    const event = first.mock.calls[0][0] as EditorEvent;
    expect(event.type).toBe('render.slow');
    expect(typeof event.ts).toBe('number');
    expect(event.meta).toEqual({ frameMs: 40 });
    expect(second).toHaveBeenCalledWith(event);
  });

  it('is a safe no-op when no plugin registers a handler', () => {
    const config = resolveEditorConfig([]);
    expect(() => config.emitEditorEvent('render.slow', { frameMs: 40 })).not.toThrow();
  });
});

describe('N-3 — the complete typed catalog', () => {
  it('freezes the 16 catalog names and the deprecated alias map', () => {
    expect([...EDITOR_EVENTS]).toEqual([
      'diagram.loaded',
      'element.added',
      'element.changed',
      'element.removed',
      'edge.connected',
      'selection.changed',
      'command.executed',
      'command.undone',
      'validation.changed',
      'promotion.completed',
      'import.warning',
      'render.slow',
      'shape.render.error',
      // Handoff 15 (V-0 decision 5) — the three review.* events, all minor.
      'review.thread.opened',
      'review.thread.resolved',
      'review.changes.requested',
    ]);
    expect(DEPRECATED_EVENT_ALIASES).toEqual({ 'node.created': 'element.added' });
  });

  it('diagram.loaded fires on mount and again on replaceDiagram (import)', async () => {
    const { events, plugin } = capture();
    let api!: DiagramContextValue & { store: CanvasStore };
    render(
      <BpmnDesigner diagram={buildDiagram()} plugins={[plugin]}>
        <Driver onReady={(value) => (api = value)} />
      </BpmnDesigner>,
    );
    await waitFor(() => expect(of(events, 'diagram.loaded')).toHaveLength(1));
    expect(of(events, 'diagram.loaded')[0].meta).toMatchObject({ name: 'Events', nodes: 1, edges: 0 });

    api.replaceDiagram(createDiagram({ name: 'Imported' }));
    await waitFor(() => expect(of(events, 'diagram.loaded')).toHaveLength(2));
    expect(of(events, 'diagram.loaded')[1].meta).toMatchObject({ name: 'Imported', nodes: 0 });
  });

  it('palette insert → element.added + command.executed + deprecated node.created with ONE warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { events, plugin } = capture();
    render(<BpmnEditor diagram={buildDiagram()} plugins={[plugin]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add User Task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    const added = of(events, 'element.added');
    expect(added).toHaveLength(2);
    expect(added[0].meta).toMatchObject({ elementType: 'userTask', kind: 'node' });
    const executed = of(events, 'command.executed');
    expect(executed.length).toBeGreaterThanOrEqual(2);
    expect(executed[0].meta).toMatchObject({ auditType: 'NODE_ADDED' });
    expect(typeof executed[0].meta?.commandId).toBe('string');

    // Deprecation grace: the old name emits alongside, with a SINGLE warning.
    const legacy = of(events, 'node.created');
    expect(legacy).toHaveLength(2);
    expect(legacy[0].meta).toEqual({ nodeType: 'userTask' });
    const deprecationWarnings = warn.mock.calls.filter((call) =>
      String(call[0]).includes("'node.created' está deprecado"),
    );
    expect(deprecationWarnings).toHaveLength(1);
  });

  it('element.changed / element.removed / command.undone flow through the command channel', async () => {
    const { events, plugin } = capture();
    let api!: DiagramContextValue & { store: CanvasStore };
    render(
      <BpmnDesigner diagram={buildDiagram()} plugins={[plugin]}>
        <Driver onReady={(value) => (api = value)} />
      </BpmnDesigner>,
    );
    await waitFor(() => expect(api).toBeDefined());

    api.execute(updateNodeCommand('t1', { label: 'Renamed' }));
    expect(of(events, 'element.changed')[0]?.meta).toMatchObject({ id: 't1' });

    api.execute(removeNodeCommand('t1'));
    expect(of(events, 'element.removed')[0]?.meta).toMatchObject({ id: 't1', kind: 'node' });

    api.undo();
    expect(of(events, 'command.undone')).toHaveLength(1);
  });

  it('selection.changed fires once per distinct selection', async () => {
    const { events, plugin } = capture();
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} plugins={[plugin]} />);
    const node = container.querySelector('[data-node-id="t1"]')!;
    fireEvent.pointerDown(node, { button: 0, clientX: 60, clientY: 60 });
    await waitFor(() => expect(of(events, 'selection.changed')).toHaveLength(1));
    expect(of(events, 'selection.changed')[0].meta).toEqual({ selectedIds: ['t1'] });
  });

  it('edge.connected fires on the connect gesture', () => {
    const { events, plugin } = capture();
    const diagram = buildDiagram();
    diagram.nodes.t2 = createNode({ type: 'task', id: 't2', label: 'Next', x: 300, y: 40 });
    const { container } = render(<BpmnDesigner diagram={diagram} plugins={[plugin]} />);

    const port = container.querySelector('[data-node-id="t1"] [data-port]')!;
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    fireEvent.pointerDown(port, { button: 0, clientX: 160, clientY: 70 });
    fireEvent.pointerMove(svg, { clientX: 360, clientY: 70 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 360, clientY: 70 });

    expect(of(events, 'edge.connected')[0]?.meta).toMatchObject({
      edgeType: 'sequenceFlow',
      sourceId: 't1',
      targetId: 't2',
    });
  });

  it('validation.changed carries counts + stable codes after Validate', () => {
    const { events, plugin } = capture();
    render(<BpmnEditor diagram={buildDiagram()} plugins={[plugin]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Validate diagram' }));

    const [event] = of(events, 'validation.changed');
    expect(event).toBeDefined();
    expect(typeof event.meta?.errors).toBe('number');
    expect(typeof event.meta?.warnings).toBe('number');
    expect(Array.isArray(event.meta?.codes)).toBe(true);
  });

  it('promotion.completed fires when the formal flow activates a version', async () => {
    const { events, plugin } = capture();
    const diagram = buildDiagram();
    diagram.version.status = 'candidate';
    diagram.version.semanticVersion = '2.1.0';
    diagram.version.changeSummary = 'A change summary long enough for promotion.';
    render(
      <BpmnDesigner diagram={diagram} plugins={[plugin]} messages={PT_BR}>
        <PromotionPanel
          open
          onClose={() => {}}
          actor={{ id: 'u-owner', role: 'owner' }}
          approvers={[
            { actor: { id: 'u-owner', role: 'owner' }, label: 'Owner' },
            { actor: { id: 'u-comp', role: 'compliance' }, label: 'Compliance' },
          ]}
          baseline={structuredClone(diagram)}
        />
      </BpmnDesigner>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar como Owner' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar como Compliance' }));
    const activate = screen.getByRole('button', { name: 'Ativar v2.1.0' });
    await waitFor(() => expect(activate).toBeEnabled());
    fireEvent.click(activate);

    await waitFor(() => expect(of(events, 'promotion.completed')).toHaveLength(1));
    expect(of(events, 'promotion.completed')[0].meta).toMatchObject({
      semanticVersion: '2.1.0',
      status: 'active',
    });
  });

  it('import.warning is the host-emitted member of the SAME typed channel', () => {
    const handler = vi.fn();
    const config = resolveEditorConfig([{ id: 'obs/h', onEditorEvent: handler }]);
    config.emitEditorEvent('import.warning', { message: 'Ignored unsupported element <foo>' });
    expect(handler.mock.calls[0][0]).toMatchObject({
      type: 'import.warning',
      meta: { message: 'Ignored unsupported element <foo>' },
    });
  });

  it('render.slow fires when a panning frame blows the 32ms budget', async () => {
    const { events, plugin } = capture();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(0);

    let api!: DiagramContextValue & { store: CanvasStore };
    render(
      <BpmnDesigner diagram={buildDiagram()} plugins={[plugin]}>
        <Driver onReady={(value) => (api = value)} />
      </BpmnDesigner>,
    );
    await waitFor(() => expect(api).toBeDefined());
    api.store.setState({ isPanning: true });
    await waitFor(() => expect(frames.length).toBeGreaterThan(0));
    now.mockReturnValue(100); // next frame arrives 100ms later
    frames[frames.length - 1](100);

    expect(of(events, 'render.slow')[0]?.meta).toEqual({ frameMs: 100 });
    vi.unstubAllGlobals();
  });

  it('shape.render.error fires when a plugin shape throws (boundary caught)', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { events, plugin } = capture();
    const Bomb = () => {
      throw new Error('shape exploded');
    };
    const bombPlugin: BpmnPlugin = {
      id: 'obs/bomb',
      nodeTypes: [
        { type: 'x:bomb', label: 'Bomb', category: 'activity', defaultSize: { width: 100, height: 60 }, xml: { tag: 'task' } },
      ],
      shapes: { 'x:bomb': Bomb },
    };
    const diagram = createDiagram({ name: 'Boom' });
    diagram.nodes = {
      b1: {
        id: 'b1',
        type: 'x:bomb',
        label: 'B',
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        properties: {},
        createdInVersion: diagram.version.id,
        audit: { createdBy: 't', createdAt: '2026-01-01T00:00:00.000Z', history: [] },
      },
    };
    render(<BpmnDesigner diagram={diagram} plugins={[plugin, bombPlugin]} />);

    expect(of(events, 'shape.render.error')[0]?.meta).toMatchObject({
      nodeId: 'b1',
      nodeType: 'x:bomb',
      message: 'shape exploded',
    });
    consoleError.mockRestore();
  });
});
