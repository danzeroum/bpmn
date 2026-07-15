import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner } from '../src/index.js';
import { searchElements } from '../src/ui/SearchPanel.js';

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
