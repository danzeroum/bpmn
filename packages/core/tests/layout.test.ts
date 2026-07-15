import { describe, expect, it } from 'vitest';
import {
  alignPositions,
  computeLayeredLayout,
  createDiagram,
  createEdge,
  createNode,
  distributePositions,
  type BpmnDiagram,
} from '../src/index.js';

function chainDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'L' });
  const make = (id: string, type = 'task', x = 0, y = 0) =>
    (diagram.nodes[id] = createNode({ id, type, x, y }));
  make('start', 'startEvent', 500, 500);
  make('a', 'task', 90, 400);
  make('b', 'task', 10, 10);
  make('gate', 'exclusiveGateway', 700, 20);
  make('c', 'task', 300, 800);
  make('end', 'endEvent', 0, 0);
  const link = (id: string, s: string, t: string) =>
    (diagram.edges[id] = createEdge({ id, sourceId: s, targetId: t }));
  link('e1', 'start', 'a');
  link('e2', 'a', 'gate');
  link('e3', 'gate', 'b');
  link('e4', 'gate', 'c');
  link('e5', 'b', 'end');
  link('e6', 'c', 'end');
  return diagram;
}

describe('computeLayeredLayout', () => {
  it('ranks a chain left-to-right with branches sharing a column', () => {
    const diagram = chainDiagram();
    const layout = computeLayeredLayout(diagram)!;
    expect(layout).not.toBeNull();
    const x = (id: string) => layout.get(id)!.x;
    expect(x('start')).toBeLessThan(x('a'));
    expect(x('a')).toBeLessThan(x('gate'));
    expect(x('gate')).toBeLessThan(x('b'));
    // Branches b and c share the same layer; end comes after both.
    expect(x('b')).toBe(x('c') + (0)); // same column start (widths equal)
    expect(x('end')).toBeGreaterThan(x('b'));
    // No two nodes overlap.
    const rects = [...layout.entries()].map(([id, p]) => ({
      ...p,
      width: diagram.nodes[id].width,
      height: diagram.nodes[id].height,
    }));
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap =
          a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap).toBe(false);
      }
  });

  it('is deterministic — same graph → same layout, 10×', () => {
    const first = computeLayeredLayout(chainDiagram())!;
    for (let run = 0; run < 10; run++) {
      const next = computeLayeredLayout(chainDiagram())!;
      expect([...next.entries()]).toEqual([...first.entries()]);
    }
  });

  it('survives cycles without hanging and ranks every node', () => {
    const diagram = chainDiagram();
    diagram.edges.back = createEdge({ id: 'back', sourceId: 'c', targetId: 'a' });
    const layout = computeLayeredLayout(diagram)!;
    expect(layout.size).toBeGreaterThanOrEqual(6);
  });

  it('returns null for swimlane diagrams (v1 scope)', () => {
    const diagram = chainDiagram();
    diagram.nodes.pool = createNode({ id: 'pool', type: 'pool', x: 0, y: 0 });
    expect(computeLayeredLayout(diagram)).toBeNull();
  });

  it('boundary events follow their host', () => {
    const diagram = chainDiagram();
    diagram.nodes.bound = createNode({
      id: 'bound',
      type: 'boundaryEvent',
      x: diagram.nodes.a.x + 20,
      y: diagram.nodes.a.y + 50,
      properties: { attachedToRef: 'a' },
    });
    const layout = computeLayeredLayout(diagram)!;
    const host = layout.get('a')!;
    const bound = layout.get('bound')!;
    expect(bound.x - host.x).toBe(20);
  });
});

describe('alignPositions / distributePositions', () => {
  const nodes = [
    createNode({ id: 'n1', type: 'task', x: 0, y: 0 }),
    createNode({ id: 'n2', type: 'task', x: 200, y: 55 }),
    createNode({ id: 'n3', type: 'task', x: 900, y: 130 }),
  ];

  it('aligns tops and horizontal centers', () => {
    const tops = alignPositions(nodes, 'top');
    expect(tops.get('n2')!.y).toBe(0);
    expect(tops.get('n3')!.y).toBe(0);
    const centers = alignPositions(nodes, 'centerY');
    const cy = (id: string) => centers.get(id)!.y + 30;
    expect(cy('n1')).toBe(cy('n2'));
  });

  it('distributes horizontally with even gaps', () => {
    const moved = distributePositions(nodes, 'horizontal');
    // Outer nodes stay; middle re-gaps evenly: span 0..1020, widths 3*120.
    expect(moved.has('n1')).toBe(false);
    expect(moved.has('n3')).toBe(false);
    expect(moved.get('n2')!.x).toBe(450);
  });

  it('needs 2+ to align and 3+ to distribute', () => {
    expect(alignPositions([nodes[0]], 'top').size).toBe(0);
    expect(distributePositions(nodes.slice(0, 2), 'vertical').size).toBe(0);
  });
});
