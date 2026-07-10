import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner, BpmnViewer, Toolbar } from '../src/index.js';
import { hiddenNodeIds, isNodeVisible } from '../src/canvas/visibility.js';

/** Sub-process "Fulfil order" with two children, next to a top-level task. */
function nestedDiagram(expanded = false): BpmnDiagram {
  const diagram = createDiagram({ name: 'Nested flow' });
  diagram.nodes = {
    sub: createNode({
      type: 'subProcess',
      id: 'sub',
      label: 'Fulfil order',
      x: 100,
      y: 100,
      width: 320,
      height: 160,
      properties: expanded ? { isExpanded: true } : {},
    }),
    childA: createNode({
      type: 'task',
      id: 'childA',
      label: 'Pick items',
      x: 120,
      y: 150,
      properties: { parentId: 'sub' },
    }),
    childB: createNode({
      type: 'task',
      id: 'childB',
      label: 'Pack box',
      x: 270,
      y: 150,
      properties: { parentId: 'sub' },
    }),
    top: createNode({ type: 'task', id: 'top', label: 'Ship', x: 520, y: 100 }),
  };
  diagram.edges = {
    inner: createEdge({ id: 'inner', sourceId: 'childA', targetId: 'childB' }),
    e1: createEdge({ id: 'e1', sourceId: 'sub', targetId: 'top' }),
  };
  return diagram;
}

function queryNode(container: HTMLElement, id: string) {
  return container.querySelector(`[data-node-id="${id}"]`);
}

describe('sub-process rendering (F7-2)', () => {
  it('hides children and inner edges of a collapsed sub-process', () => {
    const { container } = render(<BpmnDesigner diagram={nestedDiagram(false)} />);
    expect(queryNode(container, 'sub')).toBeInTheDocument();
    expect(queryNode(container, 'childA')).not.toBeInTheDocument();
    expect(container.querySelector('[data-edge-id="inner"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-edge-id="e1"]')).toBeInTheDocument();
    // Collapsed marker is a [+] (no data-expanded stamp).
    const toggle = container.querySelector('[data-subprocess-toggle]');
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toHaveAttribute('data-expanded');
  });

  it('shows children of an expanded sub-process, container painting first', () => {
    const { container } = render(<BpmnDesigner diagram={nestedDiagram(true)} />);
    expect(queryNode(container, 'childA')).toBeInTheDocument();
    expect(container.querySelector('[data-edge-id="inner"]')).toBeInTheDocument();
    const layer = container.querySelector('[data-layer="nodes"]')!;
    const ids = [...layer.querySelectorAll(':scope > [data-node-id]')].map((el) =>
      el.getAttribute('data-node-id'),
    );
    // The container paints before its children so the flow stays on top.
    expect(ids.indexOf('sub')).toBeLessThan(ids.indexOf('childA'));
    expect(container.querySelector('[data-subprocess-toggle]')).toHaveAttribute('data-expanded');
  });

  it('toggles expansion through the command stack (undoable)', () => {
    const { container } = render(<BpmnDesigner diagram={nestedDiagram(false)} />);
    fireEvent.click(container.querySelector('[data-subprocess-toggle]')!);
    expect(queryNode(container, 'childA')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(queryNode(container, 'childA')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(queryNode(container, 'childA')).toBeInTheDocument();
  });

  it('does not toggle in a read-only viewer', () => {
    const { container } = render(<BpmnViewer diagram={nestedDiagram(false)} />);
    fireEvent.click(container.querySelector('[data-subprocess-toggle]')!);
    expect(queryNode(container, 'childA')).not.toBeInTheDocument();
  });
});

describe('drill-down with breadcrumb (F7-2)', () => {
  it('drills into a sub-process and navigates back via the breadcrumb', () => {
    const { container } = render(
      <BpmnDesigner diagram={nestedDiagram(false)}>
        <Toolbar />
      </BpmnDesigner>,
    );
    expect(screen.queryByRole('navigation', { name: 'Sub-process navigation' })).toBeNull();

    fireEvent.click(container.querySelector('[data-subprocess-drill]')!);
    // Only the sub-process contents are on the canvas now.
    expect(queryNode(container, 'childA')).toBeInTheDocument();
    expect(queryNode(container, 'childB')).toBeInTheDocument();
    expect(queryNode(container, 'sub')).not.toBeInTheDocument();
    expect(queryNode(container, 'top')).not.toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Sub-process navigation' });
    expect(nav).toHaveTextContent('Nested flow');
    expect(nav).toHaveTextContent('Fulfil order');

    fireEvent.click(screen.getByRole('button', { name: 'Back to process' }));
    expect(queryNode(container, 'sub')).toBeInTheDocument();
    expect(queryNode(container, 'top')).toBeInTheDocument();
    // Still collapsed after coming back up.
    expect(queryNode(container, 'childA')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sub-process navigation' })).toBeNull();
  });

  it('offers no drill affordance on an empty sub-process', () => {
    const diagram = nestedDiagram(false);
    delete diagram.nodes.childA;
    delete diagram.nodes.childB;
    delete diagram.edges.inner;
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    expect(container.querySelector('[data-subprocess-drill]')).not.toBeInTheDocument();
  });
});

describe('visibility model', () => {
  it('hides descendants through nested collapsed containers', () => {
    const diagram = nestedDiagram(true);
    diagram.nodes.inner = createNode({
      type: 'subProcess',
      id: 'inner',
      label: 'Inner',
      x: 140,
      y: 150,
      properties: { parentId: 'sub' },
    });
    diagram.nodes.deep = createNode({
      type: 'task',
      id: 'deep',
      label: 'Deep',
      x: 150,
      y: 170,
      properties: { parentId: 'inner' },
    });
    // Outer expanded, inner collapsed: 'deep' hides, 'inner' shows.
    expect(hiddenNodeIds(diagram, null)).toEqual(new Set(['deep']));
    // Drilling into 'sub' keeps the collapsed inner container opaque.
    expect(hiddenNodeIds(diagram, 'sub')).toEqual(new Set(['sub', 'top', 'deep']));
    // Drilling into the collapsed inner container reveals its contents.
    expect(isNodeVisible(diagram, diagram.nodes.deep, 'inner')).toBe(true);
  });

  it('treats a stale drill id like no drill', () => {
    const diagram = nestedDiagram(false);
    expect(hiddenNodeIds(diagram, 'ghost')).toEqual(hiddenNodeIds(diagram, null));
  });
});
