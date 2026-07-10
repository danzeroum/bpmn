import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner, Toolbar, PT_BR } from '../src/index.js';

/**
 * Handoff 10 R-4 — "Limpar roteamento". ONE undoable command re-optimizes the
 * automatic A* routes and preserves manual routes by default; the total reset
 * (including manual) is gated behind an explicit confirmation. The toast
 * reports the real counts.
 */
function build(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Clear' });
  diagram.metadata.router = 'astar';
  diagram.nodes = {
    a: createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 0 }),
    b: createNode({ type: 'task', id: 'b', label: 'B', x: 400, y: 0 }),
    obs: createNode({ type: 'task', id: 'obs', label: 'M', x: 200, y: 20 }),
    c: createNode({ type: 'task', id: 'c', label: 'C', x: 0, y: 300 }),
    d: createNode({ type: 'task', id: 'd', label: 'D', x: 400, y: 300 }),
  };
  diagram.edges = {
    // A STALE auto route (load derivation leaves edges with waypoints alone),
    // so re-optimization has real work to do.
    e: createEdge({
      id: 'e',
      sourceId: 'a',
      targetId: 'b',
      waypoints: [
        { x: 40, y: 30 },
        { x: 440, y: 30 },
      ],
      properties: { routeMode: 'auto' },
    }),
    m: createEdge({
      id: 'm',
      sourceId: 'c',
      targetId: 'd',
      waypoints: [
        { x: 40, y: 330 },
        { x: 200, y: 360 },
        { x: 440, y: 330 },
      ],
      properties: { routeMode: 'manual' },
    }),
  };
  return diagram;
}

afterEach(() => {
  // @ts-expect-error — test-only teardown of an optional global.
  delete window.confirm;
});

describe('clear routing toolbar (Handoff 10 R-4)', () => {
  it('re-optimizes auto routes, preserves manual, and toasts the counts — undoable', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BpmnDesigner diagram={build()} onChange={onChange} messages={PT_BR}>
        <Toolbar />
      </BpmnDesigner>,
    );
    const mBefore = JSON.stringify(build().edges.m.waypoints);

    fireEvent.click(container.querySelector('[data-action="clear-routing"]')!);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    // The stale auto route was re-optimized (it now avoids the obstacle → bends).
    expect(latest.edges.e.waypoints!.length).toBeGreaterThan(2);
    expect(latest.edges.e.properties.routeMode).toBe('auto');
    // The manual route is untouched.
    expect(JSON.stringify(latest.edges.m.waypoints)).toBe(mBefore);
    expect(latest.edges.m.properties.routeMode).toBe('manual');
    // Toast reports the preserved manual route.
    expect(container.querySelector('[data-testid="routing-toast"]')?.textContent).toMatch(
      /manual preservada/i,
    );

    // The whole re-optimization undoes in ONE step.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    const undone = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(undone.edges.e.waypoints).toHaveLength(2); // back to the stale route
  });

  it('total reset folds manual routes back to auto only after confirmation', () => {
    window.confirm = vi.fn(() => true) as unknown as typeof window.confirm;
    const onChange = vi.fn();
    const { container } = render(
      <BpmnDesigner diagram={build()} onChange={onChange}>
        <Toolbar />
      </BpmnDesigner>,
    );
    fireEvent.click(container.querySelector('[data-action="clear-routing-all"]')!);

    expect(window.confirm).toHaveBeenCalled();
    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(latest.edges.m.properties.routeMode).toBe('auto'); // manual folded to auto
  });

  it('total reset is a no-op when the confirmation is declined', () => {
    window.confirm = vi.fn(() => false) as unknown as typeof window.confirm;
    const onChange = vi.fn();
    const { container } = render(
      <BpmnDesigner diagram={build()} onChange={onChange}>
        <Toolbar />
      </BpmnDesigner>,
    );
    fireEvent.click(container.querySelector('[data-action="clear-routing-all"]')!);

    expect(window.confirm).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled(); // nothing executed
  });
});
