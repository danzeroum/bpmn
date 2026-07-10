import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  createDefaultRegistry,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import type { BpmnPlugin } from '../src/index.js';
import { BpmnDesigner, BpmnEditor, SHADOW_FILTER_ID, useCanvasStore } from '../src/index.js';

function buildDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Craft' });
  diagram.nodes = {
    start: createNode({ type: 'startEvent', id: 'start', label: 'Begin', x: 20, y: 40 }),
    task1: createNode({ type: 'userTask', id: 'task1', label: 'Review', x: 140, y: 30 }),
    gw: createNode({ type: 'exclusiveGateway', id: 'gw', label: 'Route', x: 320, y: 35 }),
    pool1: createNode({ type: 'pool', id: 'pool1', label: 'Pool', x: 0, y: 200, width: 500, height: 200 }),
  };
  diagram.edges = {
    e1: createEdge({
      id: 'e1',
      sourceId: 'start',
      targetId: 'task1',
      label: 'go',
      waypoints: [
        { x: 56, y: 58 },
        { x: 100, y: 58 },
        { x: 100, y: 60 },
        { x: 140, y: 60 },
      ],
    }),
  };
  return diagram;
}

const shadowPlugin: BpmnPlugin = {
  id: 'test/shadow-plugin',
  nodeTypes: [
    {
      type: 'x:card',
      label: 'Card',
      category: 'custom',
      defaultSize: { width: 100, height: 60 },
      xml: { tag: 'task' },
      visual: { shadow: true },
    },
  ],
};

/** Test helper: widens the viewport so zoom (1200/width) crosses a threshold. */
function ZoomOut({ width }: { width: number }) {
  const store = useCanvasStore();
  useEffect(() => {
    store.setState({ viewport: { ...store.getState().viewport, width } });
  }, [store, width]);
  return null;
}

describe('craft pack: selection', () => {
  it('replaces the dashed marquee with a soft halo and r4 ports', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    const node = container.querySelector('[data-node-id="task1"]')!;
    fireEvent.pointerDown(node, { button: 0 });

    const halo = node.querySelector('[data-selection-halo]')!;
    expect(halo).toBeInTheDocument();
    expect(halo.getAttribute('stroke-dasharray')).toBeNull();
    expect(halo.getAttribute('opacity')).toBe('0.35');
    expect(halo.getAttribute('stroke-width')).toBe('2');

    const port = node.querySelector('[data-port]')!;
    expect(port.getAttribute('r')).toBe('4');
  });

  it('keeps ports in the DOM for hover fade-in and flags selection for CSS', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    const node = container.querySelector('[data-node-id="task1"]')!;
    // Before selection: ports present (CSS hides them), no data-selected.
    expect(node.querySelector('[data-ports]')).toBeInTheDocument();
    expect(node.getAttribute('data-selected')).toBeNull();

    fireEvent.pointerDown(node, { button: 0 });
    expect(node.getAttribute('data-selected')).toBe('true');
    // Resize handles remain selection-only.
    expect(node.querySelector('[data-resize-handles]')).toBeInTheDocument();
  });

  it('plays the enter animation once on palette-created nodes', () => {
    const { container } = render(<BpmnEditor diagram={buildDiagram()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add User Task' }));
    const entering = container.querySelector('.bpmnr-node-enter')!;
    expect(entering).toBeInTheDocument();
    fireEvent.animationEnd(entering);
    expect(container.querySelector('.bpmnr-node-enter')).toBeNull();
  });
});

describe('craft pack: shadows', () => {
  it('applies the shared drop shadow to activities only', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    const filtered = (id: string) =>
      container.querySelector(`[data-node-id="${id}"] g[filter="url(#${SHADOW_FILTER_ID})"]`);
    expect(filtered('task1')).toBeInTheDocument();
    expect(filtered('start')).toBeNull();
    expect(filtered('gw')).toBeNull();
    expect(filtered('pool1')).toBeNull();
  });

  it('honors the plugin visual.shadow opt-in for custom types', () => {
    const registry = createDefaultRegistry();
    registry.register(shadowPlugin.nodeTypes![0]);
    const diagram = buildDiagram();
    diagram.nodes.card = createNode(
      { type: 'x:card', id: 'card', label: 'Card', x: 20, y: 140 },
      registry,
    );
    const { container } = render(<BpmnDesigner diagram={diagram} plugins={[shadowPlugin]} />);
    expect(
      container.querySelector(`[data-node-id="card"] g[filter="url(#${SHADOW_FILTER_ID})"]`),
    ).toBeInTheDocument();
  });

  it('drops shadows below the semantic-zoom threshold', () => {
    const { container } = render(
      <BpmnDesigner diagram={buildDiagram()}>
        <ZoomOut width={3000} />
      </BpmnDesigner>,
    );
    expect(container.querySelector(`g[filter="url(#${SHADOW_FILTER_ID})"]`)).toBeNull();
  });
});

describe('craft pack: edges', () => {
  it('rounds fixed-waypoint bends with quadratic corners', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    const path = container.querySelector('[data-edge-id="e1"] path[marker-end]')!;
    expect(path.getAttribute('d')).toContain(' Q ');
  });

  it('halos edge labels against the canvas (paint-order: stroke)', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    const label = [...container.querySelectorAll('[data-edge-id="e1"] text')].find(
      (el) => el.textContent === 'go',
    )!;
    expect(label.getAttribute('paint-order')).toBe('stroke');
    expect(label.getAttribute('stroke-width')).toBe('3');
  });
});

describe('craft pack: semantic zoom (A5)', () => {
  it('stamps the zoom band on the canvas root', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    expect(container.querySelector('svg.bpmnr-canvas')).toHaveAttribute('data-zoom-band', 'full');
  });

  it('switches to reduced below 60% zoom', () => {
    const { container } = render(
      <BpmnDesigner diagram={buildDiagram()}>
        <ZoomOut width={2100} />
      </BpmnDesigner>,
    );
    expect(container.querySelector('svg.bpmnr-canvas')).toHaveAttribute(
      'data-zoom-band',
      'reduced',
    );
    // Edge labels carry the class the reduced band fades out.
    expect(container.querySelector('.bpmnr-edge-label')).toBeInTheDocument();
  });
});

describe('craft pack: grouped palette', () => {
  const groupPlugin: BpmnPlugin = {
    id: 'test/palette-groups',
    paletteGroups: [
      {
        id: 'acme',
        label: 'Acme',
        headerColor: 'var(--acme, #123456)',
        itemBackground: 'var(--acme-bg, #fafafa)',
      },
    ],
    paletteItems: [
      { id: 'acme-task', label: 'Acme Task', nodeType: 'task', group: 'acme' },
      { id: 'legacy-item', label: 'Legacy Item', nodeType: 'task' },
    ],
  };

  it('renders built-in groups with headers and the F6 badge', () => {
    render(<BpmnEditor diagram={buildDiagram()} />);
    const palette = screen.getByLabelText('Element palette');
    const core = within(palette).getByRole('region', { name: 'Core BPMN' });
    const events = within(palette).getByRole('region', { name: 'Events' });
    expect(within(core).getByRole('button', { name: 'Add User Task' })).toBeInTheDocument();
    expect(within(events).getByRole('button', { name: 'Add Timer Event' })).toBeInTheDocument();
    expect(within(events).getByText('F6')).toBeInTheDocument();
  });

  it('renders plugin groups after built-ins and appends ungrouped items flat', () => {
    render(<BpmnEditor diagram={buildDiagram()} plugins={[groupPlugin]} />);
    const palette = screen.getByLabelText('Element palette');
    const acme = within(palette).getByRole('region', { name: 'Acme' });
    expect(within(acme).getByRole('button', { name: 'Add Acme Task' })).toBeInTheDocument();
    // Group color hooks surface as CSS custom properties on the section.
    expect(acme.getAttribute('style')).toContain('--bpmnr-palette-header-color');
    // The ungrouped item keeps the old flat behavior (outside any region).
    const legacy = within(palette).getByRole('button', { name: 'Add Legacy Item' });
    expect(legacy.closest('[data-palette-group]')).toBeNull();
  });
});
