import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner } from '../src/index.js';

/**
 * Handoff 10 R-2b — drag settlement. On load the astar edges get cached
 * waypoints (a presentation derivation, not an edit); on drop the edges
 * touching the moved node are re-routed and cached INSIDE the same move command
 * (atomic + undoable), unrelated edges are never recomputed, and a settle
 * crossfade overlay plays unless reduced-motion is preferred.
 *
 * jsdom: screenToWorld falls back to client coordinates, so clientX/clientY
 * below are world coordinates.
 */
function build(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Astar' });
  diagram.metadata.router = 'astar';
  diagram.nodes = {
    a: createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 0 }),
    b: createNode({ type: 'task', id: 'b', label: 'B', x: 400, y: 0 }),
    mid: createNode({ type: 'task', id: 'mid', label: 'M', x: 200, y: -20 }),
    // Unrelated pair, far from the drag — must never be re-routed.
    c: createNode({ type: 'task', id: 'c', label: 'C', x: 0, y: 400 }),
    d: createNode({ type: 'task', id: 'd', label: 'D', x: 400, y: 400 }),
  };
  diagram.edges = {
    e: createEdge({ id: 'e', sourceId: 'a', targetId: 'b' }),
    e2: createEdge({ id: 'e2', sourceId: 'c', targetId: 'd' }),
  };
  return diagram;
}

function drag(container: HTMLElement, nodeId: string, from: [number, number], to: [number, number]) {
  const node = container.querySelector(`[data-node-id="${nodeId}"]`)!;
  const svg = container.querySelector('svg.bpmnr-canvas')!;
  fireEvent.pointerDown(node, { button: 0, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(svg, { clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(svg, { button: 0, clientX: to[0], clientY: to[1] });
}

function edgePath(container: HTMLElement, edgeId: string): string {
  return container.querySelector(`[data-edge-id="${edgeId}"] path`)!.getAttribute('d')!;
}

afterEach(() => {
  // Reset any matchMedia stub between cases.
  // @ts-expect-error — test-only teardown of an optional global.
  delete window.matchMedia;
});

describe('drag settlement (Handoff 10 R-2b)', () => {
  it('caches fresh waypoints for the moved node’s edge with routeMode auto', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={build()} onChange={onChange} />);
    drag(container, 'b', [440, 30], [700, 30]);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(latest.nodes.b.x).toBe(660); // it really moved (dx 260)
    expect(latest.edges.e.waypoints?.length).toBeGreaterThanOrEqual(2);
    expect(latest.edges.e.properties.routeMode).toBe('auto');
  });

  it('the move and the reroute undo as a single step', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={build()} onChange={onChange} />);
    const beforePath = edgePath(container, 'e');
    drag(container, 'b', [440, 30], [700, 30]);
    expect(edgePath(container, 'e')).not.toBe(beforePath); // route settled

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(latest.nodes.b.x).toBe(400); // position restored…
    expect(edgePath(container, 'e')).toBe(beforePath); // …and the route, in one undo
  });

  it('never re-routes an edge that does not touch the moved node', () => {
    const { container } = render(<BpmnDesigner diagram={build()} />);
    const before = edgePath(container, 'e2');
    drag(container, 'b', [440, 30], [700, 30]);
    // e2 connects c→d, untouched by moving b — its cached path is identical.
    expect(edgePath(container, 'e2')).toBe(before);
  });

  it('plays the settle crossfade overlay on drop', () => {
    const { container } = render(<BpmnDesigner diagram={build()} />);
    drag(container, 'b', [440, 30], [700, 30]);
    const overlay = container.querySelector('[data-layer="settling"]');
    expect(overlay).not.toBeNull();
    expect(overlay!.querySelector('path')).not.toBeNull();
  });

  it('flags a fallback (no-corridor) route with a dashed error stroke + ⚠ chip', () => {
    const diagram = build();
    diagram.edges.e = createEdge({
      id: 'e',
      sourceId: 'a',
      targetId: 'b',
      waypoints: [
        { x: 40, y: 30 },
        { x: 440, y: 30 },
      ],
      properties: { routeMode: 'auto', routeFallback: true },
    });
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    const group = container.querySelector('[data-edge-id="e"]')!;
    const dashed = group.querySelector('path[stroke-dasharray="5,4"]');
    expect(dashed).not.toBeNull();
    // The ⚠ disc carries an explanatory <title>.
    expect(group.querySelector('title')?.textContent).toMatch(/no obstacle-free route/i);
  });

  it('suppresses the crossfade under prefers-reduced-motion', () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    })) as unknown as typeof window.matchMedia;

    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={build()} onChange={onChange} />);
    drag(container, 'b', [440, 30], [700, 30]);
    // The waypoints are still cached — only the visual crossfade is skipped.
    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(latest.edges.e.properties.routeMode).toBe('auto');
    expect(container.querySelector('[data-layer="settling"]')).toBeNull();
  });
});
