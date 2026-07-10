import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { BpmnDesigner, BpmnViewer } from '../src/index.js';

/**
 * Handoff 11 N-7 — render equivalence (step 1, written BEFORE the viewer
 * realignment). The lightweight `<BpmnViewer>` must paint the exact same canvas
 * as the heavy read-only path (`<BpmnDesigner readOnly>`): same diagram → same
 * render. We compare the `svg.bpmnr-canvas` subtree only, isolating the drawing
 * from editor/viewer chrome (banners, menus) that lives as siblings.
 *
 * While both exports share the heavy implementation this is trivially green;
 * once `BpmnViewer` becomes the tree-shakeable lightweight entry it becomes the
 * proof that the realignment did not change a single painted pixel.
 */
function governedDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Governed' });
  diagram.nodes = {
    start: createNode({ type: 'startEvent', id: 'start', label: 'Início', x: 40, y: 80 }),
    task: createNode({ type: 'task', id: 'task', label: 'Analisar', x: 160, y: 60 }),
    gate: createNode({ type: 'exclusiveGateway', id: 'gate', label: 'OK?', x: 340, y: 70 }),
    done: createNode({ type: 'endEvent', id: 'done', label: 'Fim', x: 500, y: 80 }),
    // A closed element carries a governance seal (hatch + FECHADO treatment).
    legacy: createNode({ type: 'task', id: 'legacy', label: 'Antigo', x: 160, y: 200 }),
  };
  diagram.nodes.legacy.removedInVersion = '2.0.0';
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'task' }),
    e2: createEdge({ id: 'e2', sourceId: 'task', targetId: 'gate' }),
    e3: createEdge({ id: 'e3', sourceId: 'gate', targetId: 'done', label: 'sim' }),
  };
  return diagram;
}

function canvasSvg(container: HTMLElement): string {
  const svg = container.querySelector('svg.bpmnr-canvas');
  if (!svg) throw new Error('canvas svg not found');
  return svg.outerHTML;
}

describe('BpmnViewer render equivalence (N-7)', () => {
  it('paints the same canvas as <BpmnDesigner readOnly> for a governed diagram', () => {
    const diagram = governedDiagram();
    const heavy = render(<BpmnDesigner diagram={diagram} readOnly />);
    const light = render(<BpmnViewer diagram={diagram} />);

    expect(canvasSvg(light.container)).toBe(canvasSvg(heavy.container));
  });

  it('renders every node and edge of the governed diagram (seals included)', () => {
    const diagram = governedDiagram();
    const { container } = render(<BpmnViewer diagram={diagram} />);

    for (const id of Object.keys(diagram.nodes)) {
      expect(container.querySelector(`[data-node-id="${id}"]`)).not.toBeNull();
    }
    for (const id of Object.keys(diagram.edges)) {
      expect(container.querySelector(`[data-edge-id="${id}"]`)).not.toBeNull();
    }
    // The closed element paints its governance treatment (hatch), not just a color.
    expect(
      container.querySelector('[data-node-id="legacy"] [data-node-closed-hatch]'),
    ).not.toBeNull();
  });
});
