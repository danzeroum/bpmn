import { describe, expect, it } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner } from '../src/index.js';
import { computeGuideSnap, GUIDE_THRESHOLD } from '../src/canvas/smartGuides.js';
import type { BpmnPlugin } from '../src/index.js';

const VIEWPORT = { x: 0, y: 0, width: 1200, height: 800 };

/** Three tasks on one row: a (0..120), b (170..290) — gap 50 — dragged `c`. */
function rowDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Row' });
  diagram.nodes = {
    a: createNode({ id: 'a', type: 'task', label: 'A', x: 0, y: 100 }),
    b: createNode({ id: 'b', type: 'task', label: 'B', x: 170, y: 100 }),
    c: createNode({ id: 'c', type: 'task', label: 'C', x: 700, y: 100 }),
  };
  return diagram;
}

describe('smart guides — spec 1b', () => {
  it('threshold is the spec ±4px (adopted over the U-1 6px)', () => {
    expect(GUIDE_THRESHOLD).toBe(4);
  });

  it('chain case: dragging c to ~50px after b snaps to the a→b rhythm with two badges', () => {
    const diagram = rowDiagram();
    // c.left target = b.right + 50 = 340; place it 3px off (343 → dx -357).
    const snap = computeGuideSnap(diagram, null, VIEWPORT, diagram.nodes.c, -357, 0, new Set(['c']));
    expect(snap.dx).toBe(-360); // c.left = 340 → equal 50px gaps
    expect(snap.badges).toHaveLength(2);
    expect(snap.badges.every((b) => b.value === 50 && b.axis === 'h')).toBe(true);
  });

  it('between case: centering c between two nodes equalizes both gaps', () => {
    const diagram = createDiagram({ name: 'Between' });
    diagram.nodes = {
      a: createNode({ id: 'a', type: 'task', label: 'A', x: 0, y: 100 }),
      b: createNode({ id: 'b', type: 'task', label: 'B', x: 400, y: 100 }),
      c: createNode({ id: 'c', type: 'task', label: 'C', x: 700, y: 300 }),
    };
    // Gap total = 400 - 120 - 120 = 160 → 80 each; target c.left = 200.
    // Place c 3px off (203,100): dx = -497, dy = -200.
    const snap = computeGuideSnap(diagram, null, VIEWPORT, diagram.nodes.c, -497, -200, new Set(['c']));
    expect(snap.dx).toBe(-500);
    expect(snap.badges).toHaveLength(2);
    expect(snap.badges.every((b) => b.value === 80)).toBe(true);
  });

  it('viewport filter: off-screen nodes never attract (spec 1b)', () => {
    const diagram = rowDiagram();
    // Same geometry, but a viewport that excludes a and b entirely.
    const farViewport = { x: 5000, y: 5000, width: 1200, height: 800 };
    const snap = computeGuideSnap(
      diagram,
      null,
      farViewport,
      diagram.nodes.c,
      -357,
      0,
      new Set(['c']),
    );
    expect(snap.dx).toBe(-357); // untouched — no candidates in view
    expect(snap.badges).toHaveLength(0);
    expect(snap.guides).toHaveLength(0);
  });

  it('spy: a guided drag never recalculates unrelated edges (padrão H10)', async () => {
    const diagram = createDiagram({ name: 'Spy' });
    diagram.nodes = {
      a: createNode({ id: 'a', type: 'task', label: 'A', x: 0, y: 100 }),
      b: createNode({ id: 'b', type: 'task', label: 'B', x: 170, y: 100 }),
      c: createNode({ id: 'c', type: 'task', label: 'C', x: 600, y: 400 }),
      d: createNode({ id: 'd', type: 'task', label: 'D', x: 900, y: 400 }),
    };
    // `unrelated` connects a→b; the drag moves ONLY c.
    diagram.edges = { unrelated: createEdge({ id: 'unrelated', sourceId: 'a', targetId: 'b' }) };
    // The router context is deliberately narrow (no edge id) — identify the
    // unrelated a→b edge by its source rect (a sits at x=0).
    const routed: string[] = [];
    const routerSpy: BpmnPlugin = {
      id: 'test/router-spy',
      edgeRouter: (source, target) => {
        routed.push(`${source.x}->${target.x}`);
        // Straight-line stub — geometry is irrelevant to the spy.
        const start = { x: source.x + source.width, y: source.y + source.height / 2 };
        const end = { x: target.x, y: target.y + target.height / 2 };
        return {
          path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
          start,
          end,
          midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
        };
      },
    };
    const { container } = render(<BpmnDesigner diagram={diagram} plugins={[routerSpy]} />);
    routed.length = 0; // ignore the initial render pass

    const svg = container.querySelector('svg.bpmnr-canvas')!;
    const node = container.querySelector('[data-node-id="c"]')!;
    fireEvent.pointerDown(node, { button: 0, clientX: 660, clientY: 430 });
    // Two guided frames: near b's row (guides fire), then near the rhythm.
    fireEvent.pointerMove(svg, { clientX: 660, clientY: 132 });
    await waitFor(() =>
      expect(container.querySelector('[data-alignment-guides]')).not.toBeNull(),
    );
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 132 });

    // The unrelated a→b edge's route was NEVER recomputed DURING the guided
    // drag (it has no dragged endpoint — a sits at x=0). The measurement
    // window closes before the drop: the post-commit render legitimately
    // re-renders every edge against the new diagram.
    expect(routed.filter((key) => key.startsWith('0->'))).toHaveLength(0);
    fireEvent.pointerUp(svg, { button: 0 });
  });

  it('badges and guides never reach the export (spec 1b)', async () => {
    const diagram = rowDiagram();
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    const svg = container.querySelector<SVGSVGElement>('svg.bpmnr-canvas')!;
    const node = container.querySelector('[data-node-id="c"]')!;
    fireEvent.pointerDown(node, { button: 0, clientX: 760, clientY: 130 });
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 132 });
    await waitFor(() =>
      expect(container.querySelector('[data-alignment-guides]')).not.toBeNull(),
    );
    // Mid-drag export: the exporter strips the transient overlay artifacts.
    const { svgToString } = await import('../src/ui/exporters.js');
    const markup = svgToString(svg);
    expect(markup).not.toContain('data-alignment-guides');
    expect(markup).not.toContain('data-spacing-badge');
    expect(markup).not.toContain('data-context-pad');
    // Guides vanish on drop.
    fireEvent.pointerUp(svg, { button: 0 });
    expect(container.querySelector('[data-alignment-guides]')).toBeNull();
  });

  it('render path: dragging into rhythm draws the badge pills', async () => {
    const diagram = rowDiagram();
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    const node = container.querySelector('[data-node-id="c"]')!;
    // Grab c (center ~760,130) and move so c.left lands at 343 → snaps to 340.
    fireEvent.pointerDown(node, { button: 0, clientX: 760, clientY: 130 });
    fireEvent.pointerMove(svg, { clientX: 403, clientY: 130 });
    await waitFor(() =>
      expect(container.querySelectorAll('[data-spacing-badge="50"]').length).toBe(2),
    );
    fireEvent.pointerUp(svg, { button: 0 });
  });
});
