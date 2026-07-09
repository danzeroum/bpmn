import { describe, expect, it } from 'vitest';
import type { BpmnEdge, BpmnNode } from '@bpmn-react/core';
import type { Viewport } from '../src/state/canvasStore.js';
import { CULL_THRESHOLD, cullToViewport } from '../src/canvas/culling.js';

const node = (id: string, x: number, y: number): BpmnNode => ({
  id,
  type: 'task',
  label: id,
  x,
  y,
  width: 100,
  height: 80,
  properties: {},
  createdInVersion: '0',
  audit: { createdAt: '', createdBy: 'test', history: [] },
});

const edge = (
  id: string,
  sourceId: string,
  targetId: string,
  waypoints?: Array<{ x: number; y: number }>,
): BpmnEdge => ({
  id,
  type: 'sequenceFlow',
  sourceId,
  targetId,
  properties: {},
  createdInVersion: '0',
  audit: { createdAt: '', createdBy: 'test', history: [] },
  ...(waypoints ? { waypoints } : {}),
});

const byId = (nodes: BpmnNode[]): Record<string, BpmnNode> =>
  Object.fromEntries(nodes.map((n) => [n.id, n]));

const viewport: Viewport = { x: 0, y: 0, width: 1000, height: 800 };

// Enough off-screen nodes to push past the culling threshold.
const pad = (n: number) => Array.from({ length: n }, (_, i) => node(`p${i}`, 100_000, i * 5));

describe('cullToViewport', () => {
  it('is a no-op below the threshold (returns the same arrays)', () => {
    const nodes = [node('a', 0, 0), node('b', 500_000, 0)];
    const result = cullToViewport(nodes, [], byId(nodes), viewport);
    expect(result.nodes).toBe(nodes);
    expect(result.edges).toEqual([]);
    expect(nodes.length).toBeLessThan(CULL_THRESHOLD);
  });

  it('drops off-screen nodes and keeps on-screen ones above the threshold', () => {
    const inside = node('inside', 100, 100);
    const nodes = [inside, ...pad(CULL_THRESHOLD)];
    const result = cullToViewport(nodes, [], byId(nodes), viewport);
    expect(result.nodes.map((n) => n.id)).toContain('inside');
    expect(result.nodes.some((n) => n.id.startsWith('p'))).toBe(false);
    expect(result.nodes.length).toBeLessThan(nodes.length);
  });

  it('keeps a long edge that crosses the viewport between two off-screen nodes', () => {
    const src = node('src', -5000, 400);
    const tgt = node('tgt', 6000, 400);
    const nodes = [src, tgt, ...pad(CULL_THRESHOLD)];
    const crossing = edge('cross', 'src', 'tgt'); // no waypoints → spans src..tgt centres
    const away = edge('away', 'p0', 'p1'); // both endpoints far off-screen
    const result = cullToViewport(nodes, [crossing, away], byId(nodes), viewport);
    expect(result.edges.map((e) => e.id)).toContain('cross');
    expect(result.edges.map((e) => e.id)).not.toContain('away');
  });

  it('culls an edge by its waypoints when present', () => {
    const nodes = [node('a', 0, 0), node('b', 0, 0), ...pad(CULL_THRESHOLD)];
    const offscreen = edge('wp', 'a', 'b', [
      { x: 90_000, y: 90_000 },
      { x: 91_000, y: 91_000 },
    ]);
    const result = cullToViewport(nodes, [offscreen], byId(nodes), viewport);
    expect(result.edges.map((e) => e.id)).not.toContain('wp');
  });
});
