import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  createDiagram,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { fixCommandFor, laneBodyTilingRule, lintFindings } from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(HERE, 'fixtures', 'modelar-em-60s.bpmn'), 'utf8');

/**
 * LANE_BODY_TILING (#154): a lane is expected to partition the pool body
 * (x = pool.x + 30-band, the body's full width, contiguous heights covering
 * the pool). The rule POINTS at violations; the quick-fix re-tiles. Import
 * stays sovereign — the fixture proves imported DI arrives untouched.
 */

function poolWith(lanes: Array<{ id: string; x: number; y: number; width: number; height: number }>): BpmnDiagram {
  const diagram = createDiagram({ name: 'Lanes' });
  diagram.nodes.pool = createNode({
    id: 'pool', type: 'pool', label: 'Pool', x: 200, y: 200, width: 600, height: 250,
  });
  for (const lane of lanes) {
    diagram.nodes[lane.id] = createNode({ type: 'lane', label: lane.id, ...lane });
  }
  return diagram;
}

describe('LANE_BODY_TILING detection', () => {
  it('a lane tiling the body exactly is clean', () => {
    const diagram = poolWith([{ id: 'lane1', x: 230, y: 200, width: 570, height: 250 }]);
    expect(laneBodyTilingRule(diagram)).toEqual([]);
  });

  it('flags the modelar-em-60s shape: wrong x/width and a vertical gap below', () => {
    const diagram = poolWith([{ id: 'lane1', x: 240, y: 200, width: 550, height: 120 }]);
    const issues = laneBodyTilingRule(diagram);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'LANE_BODY_TILING', severity: 'warning', nodeId: 'lane1' });
  });

  it('flags a vertical gap between two lanes and an overlap', () => {
    const gap = poolWith([
      { id: 'a', x: 230, y: 200, width: 570, height: 100 },
      { id: 'b', x: 230, y: 320, width: 570, height: 130 },
    ]);
    expect(gap.nodes && laneBodyTilingRule(gap).map((i) => i.nodeId)).toContain('b');
    const overlap = poolWith([
      { id: 'a', x: 230, y: 200, width: 570, height: 150 },
      { id: 'b', x: 230, y: 320, width: 570, height: 130 },
    ]);
    expect(laneBodyTilingRule(overlap).map((i) => i.nodeId)).toContain('b');
  });

  it('two lanes partitioning the body exactly are clean; a pool without lanes too', () => {
    const clean = poolWith([
      { id: 'a', x: 230, y: 200, width: 570, height: 100 },
      { id: 'b', x: 230, y: 300, width: 570, height: 150 },
    ]);
    expect(laneBodyTilingRule(clean)).toEqual([]);
    expect(laneBodyTilingRule(poolWith([]))).toEqual([]);
  });
});

describe('LANE_BODY_TILING quick-fix', () => {
  it('re-tiles the single lane to the pool body (the issue #154 reference case)', () => {
    const diagram = poolWith([{ id: 'lane1', x: 240, y: 200, width: 550, height: 120 }]);
    const finding = lintFindings(diagram).find((f) => f.code === 'LANE_BODY_TILING')!;
    expect(finding.fixable).toBe(true);
    const command = fixCommandFor(diagram, finding)!;
    const fixed = command.execute(diagram);
    expect(fixed.nodes.lane1).toMatchObject({ x: 230, y: 200, width: 570, height: 250 });
    expect(laneBodyTilingRule(fixed)).toEqual([]);
    // one composite → one undo restores the original bounds
    const undone = command.undo(fixed);
    expect(undone.nodes.lane1).toMatchObject({ x: 240, y: 200, width: 550, height: 120 });
  });

  it('re-tiles N lanes proportionally, contiguous, summing to the pool height', () => {
    const diagram = poolWith([
      { id: 'a', x: 240, y: 200, width: 550, height: 100 },
      { id: 'b', x: 230, y: 330, width: 570, height: 100 },
    ]);
    const finding = lintFindings(diagram).find((f) => f.code === 'LANE_BODY_TILING')!;
    const fixed = fixCommandFor(diagram, finding)!.execute(diagram);
    expect(fixed.nodes.a).toMatchObject({ x: 230, y: 200, width: 570, height: 125 });
    expect(fixed.nodes.b).toMatchObject({ x: 230, y: 325, width: 570, height: 125 });
    expect(laneBodyTilingRule(fixed)).toEqual([]);
  });
});

describe('imported DI is sovereign (fixture: modelar-em-60s.bpmn)', () => {
  it('import preserves the gap byte-for-byte in the model and the lint points at it', () => {
    const converter = new BpmnXmlConverter();
    const { diagram, warnings } = converter.fromXml(FIXTURE);
    expect(warnings).toEqual([]);
    // Geometry arrives EXACTLY as authored — no re-seating on import.
    expect(diagram.nodes.pool1).toMatchObject({ x: 200, y: 200, width: 600, height: 250 });
    expect(diagram.nodes.lane1).toMatchObject({ x: 240, y: 200, width: 550, height: 120 });
    const issues = laneBodyTilingRule(diagram);
    expect(issues.map((i) => i.nodeId)).toEqual(['lane1']);
  });

  it('round-trips untouched: our export re-imports to the SAME sovereign geometry', () => {
    const converter = new BpmnXmlConverter();
    const first = converter.fromXml(FIXTURE).diagram;
    const exported = converter.toXml(first);
    const second = converter.fromXml(exported).diagram;
    expect(second.nodes.pool1).toMatchObject({ x: 200, y: 200, width: 600, height: 250 });
    expect(second.nodes.lane1).toMatchObject({ x: 240, y: 200, width: 550, height: 120 });
    // Byte-stable between OUR OWN exports (the passthrough contract).
    expect(converter.toXml(second)).toBe(exported);
  });
});
