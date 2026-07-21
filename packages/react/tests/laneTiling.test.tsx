import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import {
  createDefaultRegistry,
  createDiagram,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { BpmnDesigner } from '../src/index.js';
import { laneResizeAdjust, poolResizeReflow } from '../src/canvas/laneTiling.js';
import { paletteInsertCommand } from '../src/ui/paletteInsert.js';
import { BUILT_IN_PALETTE } from '../src/ui/paletteItems.js';

/**
 * #154 — design-time lane snap+tiling. Creating or resizing a lane snaps it
 * to the pool body (x = pool.x + 30, width = pool.width − 30) and tiles the
 * body vertically with no gap/overlap/remainder; resizing the pool reflows
 * its lanes in the SAME gesture (one composite → one undo). Import is never
 * touched (covered on the lint side with the modelar-em-60s fixture).
 */

const registry = createDefaultRegistry();

function poolDiagram(lanes: Array<{ id: string; x: number; y: number; width: number; height: number }> = []): BpmnDiagram {
  const diagram = createDiagram({ name: 'Lanes' });
  diagram.nodes.pool = createNode(
    { id: 'pool', type: 'pool', label: 'Pool', x: 200, y: 200, width: 600, height: 250 },
    registry,
  );
  for (const lane of lanes) {
    diagram.nodes[lane.id] = createNode({ type: 'lane', label: lane.id, ...lane }, registry);
  }
  return diagram;
}

const laneItem = BUILT_IN_PALETTE.find((item) => item.id === 'lane')!;
const t = (key: string) => key;

function insertLane(diagram: BpmnDiagram, x: number, y: number) {
  const result = paletteInsertCommand(laneItem, { diagram, registry, x, y, t });
  if ('veto' in result) throw new Error(result.veto);
  return { after: result.command.execute(diagram), command: result.command, laneId: result.selectId };
}

describe('lane creation snaps + tiles (palette build)', () => {
  it('the first lane dropped in a pool fills the whole body', () => {
    const { after, laneId } = insertLane(poolDiagram(), 400, 300);
    expect(after.nodes[laneId]).toMatchObject({ x: 230, y: 200, width: 570, height: 250 });
  });

  it('a second lane splits the body with no gap and no remainder; undo is ONE step', () => {
    const first = insertLane(poolDiagram(), 400, 300);
    // Drop below the existing lane's center → the new lane goes underneath.
    const second = insertLane(first.after, 400, 340);
    const laneA = second.after.nodes[first.laneId];
    const laneB = second.after.nodes[second.laneId];
    expect(laneA).toMatchObject({ x: 230, y: 200, width: 570, height: 125 });
    expect(laneB).toMatchObject({ x: 230, y: 325, width: 570, height: 125 });
    // One undo restores the pre-insert state entirely (composite).
    const undone = second.command.undo(second.after);
    expect(undone.nodes[second.laneId]).toBeUndefined();
    expect(undone.nodes[first.laneId]).toMatchObject({ x: 230, y: 200, width: 570, height: 250 });
  });

  it('a lane dropped OUTSIDE any pool keeps the plain default insert', () => {
    const { after, laneId } = insertLane(poolDiagram(), 1200, 900);
    expect(after.nodes[laneId]).toMatchObject({ x: 1200, y: 900, width: 570, height: 120 });
  });
});

describe('laneResizeAdjust (resize-gesture planner)', () => {
  it('snaps x/width to the body and gives siblings the remainder — Σ heights = pool height', () => {
    const diagram = poolDiagram([
      { id: 'a', x: 230, y: 200, width: 570, height: 125 },
      { id: 'b', x: 230, y: 325, width: 570, height: 125 },
    ]);
    // The user drags lane a's bottom edge to 160 tall (and off-x — it snaps).
    const adjust = laneResizeAdjust(diagram, 'a', { x: 210, y: 200, width: 500, height: 160 })!;
    expect(adjust.snapped).toMatchObject({ x: 230, y: 200, width: 570, height: 160 });
    const after = adjust.commands.reduce((d, cmd) => cmd.execute(d), diagram);
    expect(after.nodes.b).toMatchObject({ x: 230, y: 360, width: 570, height: 90 });
  });

  it('a single lane resized inside its pool re-fills the whole body', () => {
    const diagram = poolDiagram([{ id: 'a', x: 230, y: 200, width: 570, height: 250 }]);
    const adjust = laneResizeAdjust(diagram, 'a', { x: 230, y: 200, width: 570, height: 120 })!;
    expect(adjust.snapped).toMatchObject({ x: 230, y: 200, width: 570, height: 250 });
    expect(adjust.commands).toEqual([]);
  });

  it('returns null outside any pool — free resize stays untouched', () => {
    const diagram = poolDiagram();
    diagram.nodes.free = createNode(
      { id: 'free', type: 'lane', label: 'free', x: 1200, y: 900, width: 570, height: 120 },
      registry,
    );
    expect(laneResizeAdjust(diagram, 'free', { x: 1200, y: 900, width: 500, height: 100 })).toBeNull();
  });
});

describe('poolResizeReflow (pool gesture reflows lanes)', () => {
  it('lanes keep their proportions over the new body', () => {
    const from = { x: 200, y: 200, width: 600, height: 250 };
    const to = { x: 200, y: 200, width: 800, height: 300 };
    const diagram = poolDiagram([
      { id: 'a', x: 230, y: 200, width: 570, height: 100 },
      { id: 'b', x: 230, y: 300, width: 570, height: 150 },
    ]);
    const after = poolResizeReflow(diagram, from, to).reduce((d, cmd) => cmd.execute(d), diagram);
    expect(after.nodes.a).toMatchObject({ x: 230, y: 200, width: 770, height: 120 });
    expect(after.nodes.b).toMatchObject({ x: 230, y: 320, width: 770, height: 180 });
  });

  it('no lanes → no commands', () => {
    expect(
      poolResizeReflow(poolDiagram(), { x: 200, y: 200, width: 600, height: 250 }, { x: 0, y: 0, width: 300, height: 100 }),
    ).toEqual([]);
  });
});

describe('resize gesture end-to-end (Designer DOM)', () => {
  it('dragging a lane handle re-tiles the pool and ONE undo restores everything', () => {
    const diagram = poolDiagram([
      { id: 'a', x: 230, y: 200, width: 570, height: 125 },
      { id: 'b', x: 230, y: 325, width: 570, height: 125 },
    ]);
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={diagram} onChange={onChange} />);
    // Select lane a, then drag its SE resize handle 40px up (height 125→85,
    // the gesture's dy grid-snaps to −40).
    const laneEl = container.querySelector('[data-node-id="a"]')!;
    fireEvent.pointerDown(laneEl, { button: 0, clientX: 500, clientY: 260 });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0, clientX: 500, clientY: 260 });
    const handle = container.querySelector('[data-resize-corner="se"]')!;
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    fireEvent.pointerDown(handle, { button: 0, clientX: 800, clientY: 325 });
    fireEvent.pointerMove(svg, { clientX: 800, clientY: 285 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 800, clientY: 285 });
    const latest = onChange.mock.calls.at(-1)![0] as BpmnDiagram;
    // Lane a keeps the requested height (snapped to the body), lane b absorbs
    // the remainder — no gap, no overlap, Σ = 250.
    expect(latest.nodes.a).toMatchObject({ x: 230, y: 200, width: 570, height: 85 });
    expect(latest.nodes.b).toMatchObject({ x: 230, y: 285, width: 570, height: 165 });
  });

  it('resizing the POOL reflows the lanes inside the same single command', () => {
    const diagram = poolDiagram([
      { id: 'a', x: 230, y: 200, width: 570, height: 125 },
      { id: 'b', x: 230, y: 325, width: 570, height: 125 },
    ]);
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={diagram} onChange={onChange} />);
    const poolEl = container.querySelector('[data-node-id="pool"]')!;
    fireEvent.pointerDown(poolEl, { button: 0, clientX: 210, clientY: 210 });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0, clientX: 210, clientY: 210 });
    const handle = container.querySelector('[data-resize-corner="se"]')!;
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    // Grow the pool 100px right and 60px down: 600×250 → 700×310.
    fireEvent.pointerDown(handle, { button: 0, clientX: 800, clientY: 450 });
    fireEvent.pointerMove(svg, { clientX: 900, clientY: 510 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 900, clientY: 510 });
    const latest = onChange.mock.calls.at(-1)![0] as BpmnDiagram;
    expect(latest.nodes.pool).toMatchObject({ x: 200, y: 200, width: 700, height: 310 });
    expect(latest.nodes.a).toMatchObject({ x: 230, y: 200, width: 670, height: 155 });
    expect(latest.nodes.b).toMatchObject({ x: 230, y: 355, width: 670, height: 155 });
  });
});
