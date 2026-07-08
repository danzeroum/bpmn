import { describe, expect, it } from 'vitest';
import { decisionThumbnail, diagramThumbnail } from '../src/index.js';
import { diagramAt } from './fixtures.js';

describe('diagramThumbnail — headless mini-flow SVG', () => {
  it('renders one shape per active node and paths for edges', async () => {
    const diagram = await diagramAt({
      versionId: 'v1',
      semver: '1.0.0',
      nodes: [
        { id: 'start', type: 'startEvent', x: 0, y: 40 },
        { id: 'work', type: 'task', x: 100, y: 30 },
        { id: 'gw', type: 'exclusiveGateway', x: 240, y: 35 },
        { id: 'p', type: 'btv:persona', x: 100, y: 120 },
        { id: 'g', type: 'btv:gate', x: 240, y: 120 },
        { id: 'd', type: 'btv:deliverable', x: 360, y: 40 },
        { id: 'gone', type: 'task', x: 500, y: 40, removedInVersion: 'v1' },
      ],
    });
    diagram.edges['e1'] = {
      id: 'e1',
      type: 'sequenceFlow',
      sourceId: 'start',
      targetId: 'work',
      properties: {},
      createdInVersion: 'v1',
      audit: { createdBy: 'alice', createdAt: '2026-01-01T00:00:00.000Z' },
    } as (typeof diagram.edges)[string];
    const spec = diagramThumbnail(diagram);
    expect(spec.kind).toBe('svg');
    const svg = (spec as { kind: 'svg'; svg: string }).svg;
    expect(svg).toContain('viewBox=');
    expect(svg.match(/<circle/g)).toHaveLength(1); // startEvent
    expect(svg.match(/<polygon/g)).toHaveLength(3); // gateway + gate + deliverable
    expect(svg.match(/<rect/g)).toHaveLength(2); // task + persona pill
    expect(svg).toContain('rx="'); // persona pill radius
    expect(svg.match(/<path/g)).toHaveLength(1); // the edge
    expect(svg).not.toContain('x="500"'); // removed node is not drawn
    expect(svg).toContain('var(--btv-gold, #9a7b1e)'); // themable tokens, no bare hex only
  });

  it('an empty diagram yields no thumbnail', async () => {
    const diagram = await diagramAt({ versionId: 'v1', semver: '1.0.0', nodes: [] });
    expect(diagramThumbnail(diagram)).toEqual({ kind: 'none' });
  });

  it('skips edges pointing at missing nodes', async () => {
    const diagram = await diagramAt({
      versionId: 'v1',
      semver: '1.0.0',
      nodes: [{ id: 'a', type: 'task' }],
    });
    diagram.edges['broken'] = {
      id: 'broken',
      type: 'sequenceFlow',
      sourceId: 'a',
      targetId: 'ghost',
      properties: {},
      createdInVersion: 'v1',
      audit: { createdBy: 'alice', createdAt: '2026-01-01T00:00:00.000Z' },
    } as (typeof diagram.edges)[string];
    const spec = diagramThumbnail(diagram);
    expect((spec as { svg: string }).svg).not.toContain('<path');
  });

  it('prefers explicit waypoints when the edge has them', async () => {
    const diagram = await diagramAt({
      versionId: 'v1',
      semver: '1.0.0',
      nodes: [
        { id: 'a', type: 'task', x: 0, y: 0 },
        { id: 'b', type: 'task', x: 200, y: 0 },
      ],
    });
    diagram.edges['e'] = {
      id: 'e',
      type: 'sequenceFlow',
      sourceId: 'a',
      targetId: 'b',
      waypoints: [
        { x: 60, y: 20 },
        { x: 130, y: 90 },
        { x: 200, y: 20 },
      ],
      properties: {},
      createdInVersion: 'v1',
      audit: { createdBy: 'alice', createdAt: '2026-01-01T00:00:00.000Z' },
    } as (typeof diagram.edges)[string];
    const spec = diagramThumbnail(diagram) as { svg: string };
    expect(spec.svg).toContain('L 130 90');
  });
});

describe('decisionThumbnail', () => {
  it('draws one line per rule, clamped to 4', () => {
    const two = decisionThumbnail(2) as { kind: 'svg'; svg: string };
    expect(two.kind).toBe('svg');
    expect(two.svg.match(/<line/g)).toHaveLength(3); // header + 2 rules
    const many = decisionThumbnail(40) as { svg: string };
    expect(many.svg.match(/<line/g)).toHaveLength(5); // header + 4 clamped
    const none = decisionThumbnail(0) as { svg: string };
    expect(none.svg.match(/<line/g)).toHaveLength(2); // header + 1 minimum row
  });
});
