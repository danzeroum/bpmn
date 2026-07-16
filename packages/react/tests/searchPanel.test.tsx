import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner } from '../src/index.js';
import { laneLabelOf, searchElements } from '../src/ui/SearchPanel.js';

function buildDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Find flow' });
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Início', x: 40, y: 40 }),
    review: createNode({ id: 'review', type: 'userTask', label: 'Revisar contrato', x: 200, y: 40 }),
    approve: createNode({ id: 'approve', type: 'userTask', label: 'Aprovar contrato', x: 400, y: 40 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'review', label: 'segue' }),
  };
  return diagram;
}

describe('searchElements (pure)', () => {
  it('matches label, id and type case-insensitively', () => {
    const diagram = buildDiagram();
    expect(searchElements(diagram, 'contrato').map((m) => m.id)).toEqual(['review', 'approve']);
    expect(searchElements(diagram, 'USERTASK')).toHaveLength(2);
    expect(searchElements(diagram, 'start').map((m) => m.id)).toContain('start');
    expect(searchElements(diagram, 'segue').map((m) => m.id)).toEqual(['e1']);
    expect(searchElements(diagram, '')).toHaveLength(0);
  });
});

describe('find bar (referência item 4)', () => {
  it('Ctrl+F opens the bar; typing shows the match count', () => {
    render(<BpmnDesigner diagram={buildDiagram()} />);
    expect(screen.queryByRole('search')).toBeNull();
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    const bar = screen.getByRole('search');
    expect(bar).toBeInTheDocument();
    fireEvent.change(bar.querySelector('input')!, { target: { value: 'contrato' } });
    expect(bar.textContent).toContain('1/2');
  });

  it('Enter selects and centers the first match; next Enter walks', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    const input = screen.getByRole('search').querySelector('input')!;
    fireEvent.change(input, { target: { value: 'contrato' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(
      container.querySelector('[data-node-id="review"][data-selected="true"]'),
    ).not.toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(
      container.querySelector('[data-node-id="approve"][data-selected="true"]'),
    ).not.toBeNull();
    // Wraps around.
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(
      container.querySelector('[data-node-id="review"][data-selected="true"]'),
    ).not.toBeNull();
  });

  it('Escape closes via the dismissal stack', () => {
    render(<BpmnDesigner diagram={buildDiagram()} />);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    expect(screen.getByRole('search')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('search')).toBeNull();
  });

  it('typing in the search input never triggers canvas shortcuts', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    const input = screen.getByRole('search').querySelector('input')!;
    const before = container.querySelectorAll('[data-node-id]').length;
    // 'a' with ctrl inside the input must not select-all / mutate.
    fireEvent.keyDown(input, { key: 'Delete' });
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(before);
  });
});


describe('search — spec 1c refinements (U-4)', () => {
  function richDiagram(): BpmnDiagram {
    const diagram = buildDiagram();
    diagram.nodes.svc = createNode({
      id: 'svc',
      type: 'serviceTask',
      label: 'Cobrar',
      x: 600,
      y: 40,
      properties: { 'zeebe:taskDefinitionType': 'verify-credit' },
    });
    diagram.nodes.dec = createNode({
      id: 'dec',
      type: 'businessRuleTask',
      label: 'Decidir',
      x: 800,
      y: 40,
      properties: { decisionRef: 'prm-aprov-gate' },
    });
    diagram.nodes.agent = createNode({
      id: 'agent',
      type: 'task',
      label: 'Pesquisar',
      x: 1000,
      y: 40,
      properties: { agentRef: 'agnt-rsch@1.2' },
    });
    diagram.nodes.lane1 = createNode({
      id: 'lane1',
      type: 'lane',
      label: 'Financeiro',
      x: 0,
      y: 0,
      properties: { flowNodeRefs: ['svc'] },
    });
    return diagram;
  }

  it('matches property/ref values — decisionRef, agent refs and job types', () => {
    const diagram = richDiagram();
    const byJobType = searchElements(diagram, 'verify-credit');
    expect(byJobType.map((m) => m.id)).toEqual(['svc']);
    expect(byJobType[0].matchedIn).toBe('property');
    expect(byJobType[0].propertyKey).toBe('zeebe:taskDefinitionType');

    expect(searchElements(diagram, 'prm-aprov').map((m) => m.id)).toEqual(['dec']);
    expect(searchElements(diagram, 'agnt-rsch@').map((m) => m.id)).toEqual(['agent']);
  });

  it('laneLabelOf resolves the containing lane', () => {
    const diagram = richDiagram();
    expect(laneLabelOf(diagram, 'svc')).toBe('Financeiro');
    expect(laneLabelOf(diagram, 'agent')).toBeNull();
  });

  it('renders the result list with glyph, lane and type per row', () => {
    render(<BpmnDesigner diagram={richDiagram()} />);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    const input = screen.getByRole('search').querySelector('input')!;
    fireEvent.change(input, { target: { value: 'cobrar' } });
    const list = screen.getByRole('listbox');
    const row = list.querySelector('[data-search-result="svc"]')!;
    expect(row.textContent).toContain('Cobrar');
    expect(row.textContent).toContain('serviceTask');
    expect(row.textContent).toContain('Financeiro');
    expect(row.querySelector('.bpmnr-search-glyph')!.textContent).toBe('☰');
  });

  it('property hits show key:value and the purple ref tag', () => {
    render(<BpmnDesigner diagram={richDiagram()} />);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    const input = screen.getByRole('search').querySelector('input')!;
    fireEvent.change(input, { target: { value: 'agnt-rsch' } });
    const row = screen.getByRole('listbox').querySelector('[data-search-result="agent"]')!;
    expect(row.getAttribute('data-search-matched-in')).toBe('property');
    expect(row.textContent).toContain('agentRef: agnt-rsch@1.2');
    expect(row.querySelector('[data-search-meta="property"]')).not.toBeNull();
  });

  it('clicking a result row navigates and selects it', () => {
    const { container } = render(<BpmnDesigner diagram={richDiagram()} />);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    const input = screen.getByRole('search').querySelector('input')!;
    fireEvent.change(input, { target: { value: 'decidir' } });
    fireEvent.click(screen.getByRole('listbox').querySelector('[data-search-result="dec"]')!);
    expect(container.querySelector('[data-node-id="dec"][data-selected="true"]')).not.toBeNull();
  });

  it('Enter pans (animated) until the target is centered and plays 2 pulse rings', async () => {
    const { container } = render(<BpmnDesigner diagram={richDiagram()} />);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    const input = screen.getByRole('search').querySelector('input')!;
    fireEvent.change(input, { target: { value: 'pesquisar' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Pulse overlay appears immediately (2 rings)…
    expect(container.querySelectorAll('[data-search-pulse] circle')).toHaveLength(2);
    // …and the animated pan converges on the node's center (agent at 1000,40;
    // default viewport 1200×800 → x = 1060-600 = 460).
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    await waitFor(
      () => {
        const [x] = svg.getAttribute('viewBox')!.split(' ').map(Number);
        expect(Math.abs(x - 460)).toBeLessThan(1);
      },
      // Generous under coverage instrumentation — rAF frames slow down there.
      { timeout: 5000 },
    );
  });

  it('prefers-reduced-motion: instant pan, ZERO pulses', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      const { container } = render(<BpmnDesigner diagram={richDiagram()} />);
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
      const input = screen.getByRole('search').querySelector('input')!;
      fireEvent.change(input, { target: { value: 'pesquisar' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(container.querySelector('[data-search-pulse]')).toBeNull();
      const svg = container.querySelector('svg.bpmnr-canvas')!;
      const [x] = svg.getAttribute('viewBox')!.split(' ').map(Number);
      expect(Math.abs(x - 460)).toBeLessThan(1); // instant, no animation needed
    } finally {
      window.matchMedia = original;
    }
  });

  it('↑/↓ in the input walk the matches', () => {
    const { container } = render(<BpmnDesigner diagram={richDiagram()} />);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    const input = screen.getByRole('search').querySelector('input')!;
    fireEvent.change(input, { target: { value: 'contrato' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(container.querySelector('[data-node-id="review"][data-selected="true"]')).not.toBeNull();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(
      container.querySelector('[data-node-id="approve"][data-selected="true"]'),
    ).not.toBeNull();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(container.querySelector('[data-node-id="review"][data-selected="true"]')).not.toBeNull();
  });
});
