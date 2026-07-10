import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner } from '../src/index.js';

/**
 * Handoff 10 R-4 — edge case 4. An A* edge whose target ports are all enclosed
 * by an obstacle routes to the honest "sem corredor" fallback (⚠). When the
 * obstacle is dragged away it must self-heal — no explicit action.
 */
function build(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Fallback' });
  diagram.metadata.router = 'astar';
  diagram.nodes = {
    a: createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 200 }),
    b: createNode({ type: 'task', id: 'b', label: 'B', x: 300, y: 200, width: 40, height: 40 }),
    // A cage that swallows b and all of its ports → no corridor.
    cage: createNode({ type: 'task', id: 'cage', label: 'Cage', x: 268, y: 168, width: 104, height: 104 }),
  };
  diagram.edges = { fb: createEdge({ id: 'fb', sourceId: 'a', targetId: 'b' }) };
  return diagram;
}

describe('fallback recovery — edge case 4 (Handoff 10 R-4)', () => {
  it('flags ⚠ with no corridor, then self-heals when the obstacle is moved away', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={build()} onChange={onChange} />);

    // On load the route has no corridor → dashed error fallback.
    expect(container.querySelector('[data-edge-id="fb"] path[stroke-dasharray="5,4"]')).not.toBeNull();

    // Drag the cage far below, opening space around b.
    const cage = container.querySelector('[data-node-id="cage"]')!;
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    fireEvent.pointerDown(cage, { button: 0, clientX: 320, clientY: 220 });
    fireEvent.pointerMove(svg, { clientX: 320, clientY: 700 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 320, clientY: 700 });

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    // The route self-healed: fallback flag cleared, a real corridor cached.
    expect(latest.edges.fb.properties.routeFallback).toBeUndefined();
    expect(latest.edges.fb.properties.routeMode).toBe('auto');
    expect(latest.edges.fb.waypoints!.length).toBeGreaterThanOrEqual(2);
  });
});
