import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { activeEdges, activeNodes } from '@buildtovalue/core';
import { App } from '../src/App.js';
import {
  buildAstarDiagram,
  buildDeadlockDiagram,
  buildSampleDiagram,
  buildStressDiagram,
} from '../src/sampleDiagram.js';

describe('example app (melhorias F10 — the demo had zero unit tests)', () => {
  it('renders the full designer shell without crashing', () => {
    const { container } = render(<App />);
    expect(container.querySelector('svg.bpmnr-canvas')).not.toBeNull();
    expect(container.querySelectorAll('[data-node-id]').length).toBeGreaterThan(0);
  });

  it('sample diagrams are structurally coherent (edges reference live nodes)', () => {
    for (const build of [
      buildSampleDiagram,
      buildDeadlockDiagram,
      buildAstarDiagram,
      () => buildStressDiagram(50, 5),
    ]) {
      const diagram = build();
      const nodeIds = new Set(Object.keys(diagram.nodes));
      for (const edge of activeEdges(diagram)) {
        expect(nodeIds.has(edge.sourceId), `${diagram.name}: ${edge.id} source`).toBe(true);
        expect(nodeIds.has(edge.targetId), `${diagram.name}: ${edge.id} target`).toBe(true);
      }
      expect(activeNodes(diagram).length).toBeGreaterThan(0);
    }
  });
});
