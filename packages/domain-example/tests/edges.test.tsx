import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createDefaultRegistry, createDiagram, createEdge, createNode } from '@buildtovalue/core';
import { BpmnViewer } from '@buildtovalue/react';
import { DOMAIN_NODE_TYPES, domainExamplePlugin } from '../src/index.js';

/**
 * Renders each domain edge type through the plugin's `edgeStyles` and asserts
 * the resulting stroke/dash/marker plus the mid-segment decorations (handoff
 * purpose chip, approval check disc). Guards the declarative edge-style seam
 * so a change to the EdgeRenderer composition can't silently drop a style.
 */
function registryWithDomain() {
  const registry = createDefaultRegistry();
  for (const def of DOMAIN_NODE_TYPES) registry.register(def);
  return registry;
}

function diagramWithEdge(type: string, purpose?: string) {
  const registry = registryWithDomain();
  const diagram = createDiagram({ name: 'Edges' });
  const v = diagram.version.id;
  diagram.nodes = {
    a: createNode({ type: 'btv:squad', id: 'a', label: 'A', x: 20, y: 20, versionId: v }, registry),
    b: createNode({ type: 'btv:persona', id: 'b', label: 'B', x: 260, y: 60, versionId: v }, registry),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'a', targetId: 'b', type, purpose, versionId: v }),
  };
  return diagram;
}

function renderEdge(type: string, purpose?: string) {
  const { container } = render(
    <BpmnViewer diagram={diagramWithEdge(type, purpose)} plugins={[domainExamplePlugin]} />,
  );
  const root = container.querySelector('[data-edge-id="e1"]')!;
  expect(root).toBeInTheDocument();
  // The visible line is the styled path (the hit-area path has no marker).
  const path = root.querySelector('path[marker-end]')!;
  return { root, path };
}

describe('domain-example edge styles render correctly', () => {
  it('handoff: ink filled arrow with a purpose chip', () => {
    const { root, path } = renderEdge('handoff', 'draft');
    expect(path.getAttribute('stroke')).toContain('--btv-edge-handoff');
    expect(path.getAttribute('marker-end')).toBe('url(#bpmnr-edge-filled)');
    // Purpose chip: a pill (rect) carrying the (short, untruncated) purpose.
    expect(root.querySelector('rect')).toBeInTheDocument();
    expect(root.textContent).toContain('draft');
  });

  it('handoff without a purpose: error-colored placeholder chip', () => {
    const { root } = renderEdge('handoff');
    expect(root.textContent).toContain('sem purpose');
    const chipText = [...root.querySelectorAll('text')].find((t) =>
      t.textContent?.includes('sem purpose'),
    )!;
    expect(chipText.getAttribute('fill')).toContain('--btv-error');
  });

  it('approval: green solid arrow with a check disc', () => {
    const { root, path } = renderEdge('approval');
    expect(path.getAttribute('stroke')).toContain('--btv-edge-approval');
    expect(path.getAttribute('stroke-width')).toBe('2');
    expect(path.getAttribute('marker-end')).toBe('url(#bpmnr-edge-filled)');
    expect(root.querySelector('circle[r="8"]')).toBeInTheDocument();
  });

  it('feedback: dashed plum line with an open arrow', () => {
    const { path } = renderEdge('feedback');
    expect(path.getAttribute('stroke')).toContain('--btv-edge-feedback');
    expect(path.getAttribute('stroke-dasharray')).toBe('5,4');
    expect(path.getAttribute('marker-end')).toBe('url(#bpmnr-edge-open)');
  });

  it('escalation: red line with a double chevron', () => {
    const { path } = renderEdge('escalation');
    expect(path.getAttribute('stroke')).toContain('--btv-edge-escalation');
    expect(path.getAttribute('marker-end')).toBe('url(#bpmnr-edge-chevron)');
  });

  it('unstyled core edge (sequenceFlow) keeps the default ink arrow', () => {
    const { path } = renderEdge('sequenceFlow');
    expect(path.getAttribute('marker-end')).toBe('url(#bpmnr-arrow)');
  });
});
