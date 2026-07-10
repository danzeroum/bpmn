import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner, PropertiesPanel } from '../src/index.js';

/**
 * Handoff 10 R-3 — manual routes. Authoring (drag a segment → bend → manual)
 * is ONE undoable command; a manual route translates rigidly with its moved
 * anchor and is NEVER re-routed (edge case 6); "back to auto" resets it in one
 * atomic step. jsdom: screenToWorld falls back to client coordinates.
 */
function selectEdge(container: HTMLElement, edgeId: string) {
  const g = container.querySelector(`[data-edge-id="${edgeId}"]`)!;
  fireEvent.pointerDown(g, { button: 0, clientX: 5, clientY: 5 });
}

function drag(container: HTMLElement, nodeId: string, from: [number, number], to: [number, number]) {
  const node = container.querySelector(`[data-node-id="${nodeId}"]`)!;
  const svg = container.querySelector('svg.bpmnr-canvas')!;
  fireEvent.pointerDown(node, { button: 0, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(svg, { clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(svg, { button: 0, clientX: to[0], clientY: to[1] });
}

/** Straight/bezier diagram — edge e has no waypoints until authored. */
function simple(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Manual' });
  diagram.nodes = {
    a: createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 0 }),
    b: createNode({ type: 'task', id: 'b', label: 'B', x: 300, y: 0 }),
  };
  diagram.edges = { e: createEdge({ id: 'e', sourceId: 'a', targetId: 'b' }) };
  return diagram;
}

/** A pre-authored manual route (as if imported / user-drawn). */
function withManualEdge(): BpmnDiagram {
  const diagram = createDiagram({ name: 'ManualPre' });
  diagram.nodes = {
    a: createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 0 }),
    b: createNode({ type: 'task', id: 'b', label: 'B', x: 400, y: 0 }),
  };
  diagram.edges = {
    e: createEdge({
      id: 'e',
      sourceId: 'a',
      targetId: 'b',
      waypoints: [
        { x: 40, y: 30 },
        { x: 200, y: 30 },
        { x: 440, y: 30 },
      ],
      properties: { routeMode: 'manual' },
    }),
  };
  return diagram;
}

describe('manual route authoring (Handoff 10 R-3)', () => {
  it('dragging a segment authors a bend and turns the edge manual — one undoable step', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={simple()} onChange={onChange} />);
    selectEdge(container, 'e');

    const seg = container.querySelector('[data-edge-id="e"] line')!;
    const x1 = Number(seg.getAttribute('x1'));
    const y1 = Number(seg.getAttribute('y1'));
    const x2 = Number(seg.getAttribute('x2'));
    const y2 = Number(seg.getAttribute('y2'));
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    fireEvent.pointerDown(seg, { button: 0, clientX: mx, clientY: my });
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    fireEvent.pointerMove(svg, { clientX: mx, clientY: my + 60 });
    fireEvent.pointerUp(svg, { button: 0, clientX: mx, clientY: my + 60 });

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(latest.edges.e.properties.routeMode).toBe('manual');
    expect(latest.edges.e.waypoints).toHaveLength(3); // a bend was inserted

    // Undo restores the auto route (no waypoints) atomically.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    const undone = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(undone.edges.e.waypoints).toBeUndefined();
    expect(undone.edges.e.properties.routeMode).toBeUndefined();
  });

  it('double-clicking an interior waypoint removes it (stays manual, undoable)', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withManualEdge()} onChange={onChange} />);
    selectEdge(container, 'e');

    // The interior waypoint carries a 44px (r=22) invisible hit target.
    const hit = [...container.querySelectorAll('[data-edge-id="e"] circle')].find(
      (c) => c.getAttribute('r') === '22',
    )!;
    fireEvent.doubleClick(hit);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(latest.edges.e.waypoints).toHaveLength(2);
    expect(latest.edges.e.properties.routeMode).toBe('manual');
  });
});

describe('manual route on host move — edge case 6 (Handoff 10 R-3)', () => {
  it('translates the manual route rigidly with the moved anchor, never re-routing', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={withManualEdge()} onChange={onChange} />);
    // Move source `a` down by 100 (its center is 40,30 → 40,130).
    drag(container, 'a', [40, 30], [40, 130]);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    const wp = latest.edges.e.waypoints!;
    expect(latest.edges.e.properties.routeMode).toBe('manual'); // still manual
    expect(wp[0]).toEqual({ x: 40, y: 130 }); // endpoint followed the anchor
    expect(wp[1]).toEqual({ x: 200, y: 30 }); // interior bend preserved (NOT re-routed)
    expect(wp[2]).toEqual({ x: 440, y: 30 });
  });

  it('a manual route flagged as colliding shows the ⚠ chip but keeps its route', () => {
    const diagram = withManualEdge();
    diagram.edges.e = createEdge({
      id: 'e',
      sourceId: 'a',
      targetId: 'b',
      waypoints: [
        { x: 40, y: 30 },
        { x: 200, y: 30 },
        { x: 440, y: 30 },
      ],
      properties: { routeMode: 'manual', routeCollision: true },
    });
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    const group = container.querySelector('[data-edge-id="e"]')!;
    // ⚠ disc present…
    expect(group.querySelector('title')?.textContent).toMatch(/no obstacle-free route/i);
    // …but the route is NOT painted as the dashed auto-fallback error line.
    expect(group.querySelector('path[stroke-dasharray="5,4"]')).toBeNull();
  });

  it('never touches a manual route when an unrelated node moves (§8.3)', () => {
    const diagram = withManualEdge();
    diagram.nodes.c = createNode({ type: 'task', id: 'c', label: 'C', x: 0, y: 400 });
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={diagram} onChange={onChange} />);
    const before = JSON.stringify(diagram.edges.e.waypoints);
    drag(container, 'c', [40, 430], [200, 430]);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(JSON.stringify(latest.edges.e.waypoints)).toBe(before);
  });
});

describe('manual route reset (Handoff 10 R-3)', () => {
  it('the inspector "Voltar ao automático" clears the manual route, undoable', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BpmnDesigner diagram={withManualEdge()} onChange={onChange}>
        <PropertiesPanel />
      </BpmnDesigner>,
    );
    selectEdge(container, 'e');

    const button = container.querySelector('[data-action="route-back-to-auto"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    fireEvent.click(button);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    // Non-astar diagram → back to auto clears the waypoints; routeMode = auto.
    expect(latest.edges.e.waypoints).toBeUndefined();
    expect(latest.edges.e.properties.routeMode).toBe('auto');

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    const undone = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(undone.edges.e.waypoints).toHaveLength(3); // manual route restored
    expect(undone.edges.e.properties.routeMode).toBe('manual');
  });
});
