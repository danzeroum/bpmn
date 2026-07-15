import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnViewer } from '../src/viewer.js';

/**
 * Deterministic SVG-markup regression net (melhorias F10): the serialized
 * viewer canvas for a representative diagram is snapshotted, so unintended
 * changes to shape geometry, markers, tokens or attribute plumbing show up as
 * a reviewable diff. Markup snapshots are stable under jsdom (no layout, no
 * rasterization), unlike screenshot tests on CI software rendering.
 */
function referenceDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Snapshot reference', id: 'snap' });
  diagram.nodes = {
    start: createNode({ type: 'startEvent', id: 'start', label: 'Start', x: 40, y: 80 }),
    review: createNode({ type: 'userTask', id: 'review', label: 'Review', x: 140, y: 60 }),
    gate: createNode({ type: 'exclusiveGateway', id: 'gate', label: 'OK?', x: 320, y: 70 }),
    done: createNode({ type: 'endEvent', id: 'done', label: 'Done', x: 440, y: 80 }),
    old: {
      ...createNode({ type: 'task', id: 'old', label: 'Legacy', x: 140, y: 200 }),
      removedInVersion: 'v9',
    },
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'review' }),
    e2: createEdge({ id: 'e2', sourceId: 'review', targetId: 'gate', label: 'go' }),
    e3: createEdge({ id: 'e3', sourceId: 'gate', targetId: 'done' }),
  };
  return diagram;
}

describe('SVG markup snapshot', () => {
  it('viewer canvas markup is stable for the reference diagram', () => {
    const { container } = render(<BpmnViewer diagram={referenceDiagram()} />);
    const svg = container.querySelector('svg.bpmnr-canvas');
    expect(svg).not.toBeNull();
    expect(svg!.outerHTML).toMatchSnapshot();
  });
});
