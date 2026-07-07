import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  computeDiff,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@bpmn-react/core';
import { BpmnEditor, DiffView, StatusBadge, BpmnDesigner } from '../src/index.js';

function buildDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'UI flow' });
  const start = createNode({ type: 'startEvent', id: 'start', label: 'Begin', x: 40, y: 40 });
  const task = createNode({ type: 'task', id: 'task1', label: 'Work', x: 160, y: 30 });
  diagram.nodes = { start, task1: task };
  diagram.edges = { e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'task1' }) };
  return diagram;
}

describe('BpmnEditor chrome', () => {
  it('renders toolbar, palette, inspector, minimap and status badge', () => {
    render(<BpmnEditor diagram={buildDiagram()} />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Element palette')).toBeInTheDocument();
    expect(screen.getByLabelText('Properties')).toBeInTheDocument();
    expect(screen.getByLabelText('Diagram overview')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /Version 0\.1\.0/ })).toHaveTextContent('Draft');
  });

  it('adds a node from the palette', () => {
    const { container } = render(<BpmnEditor diagram={buildDiagram()} />);
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Add User Task' }));
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(3);
    expect(container.querySelector('[data-node-type="userTask"]')).toBeInTheDocument();
  });

  it('drives undo/redo from the toolbar', () => {
    const { container } = render(<BpmnEditor diagram={buildDiagram()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(3);
  });

  it('validates and lists issues', () => {
    const diagram = buildDiagram();
    diagram.edges.bad = createEdge({ id: 'bad', sourceId: 'ghost', targetId: 'task1' });
    render(<BpmnEditor diagram={diagram} />);
    fireEvent.click(screen.getByRole('button', { name: 'Validate diagram' }));
    const panel = screen.getByRole('status', { name: 'Validation result' });
    expect(within(panel).getByText(/missing node/)).toBeInTheDocument();
  });

  it('edits the selected node label through the inspector', () => {
    const { container } = render(<BpmnEditor diagram={buildDiagram()} />);
    fireEvent.pointerDown(container.querySelector('[data-node-id="task1"]')!, { button: 0 });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });

    const input = screen.getByLabelText('Label') as HTMLInputElement;
    expect(input.value).toBe('Work');
    fireEvent.change(input, { target: { value: 'Reworked' } });
    fireEvent.blur(input);
    expect(screen.getAllByText('Reworked').length).toBeGreaterThan(0);
  });

  it('edits edge purpose through the inspector', () => {
    const { container } = render(<BpmnEditor diagram={buildDiagram()} />);
    fireEvent.pointerDown(container.querySelector('[data-edge-id="e1"]')!, { button: 0 });
    const input = screen.getByLabelText('Purpose') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'handoff to review' } });
    fireEvent.blur(input);
    // Purpose is rendered as the edge tooltip <title>
    expect(container.querySelector('[data-edge-id="e1"] title')).toHaveTextContent(
      'handoff to review',
    );
  });

  it('shows a veto message when editing a locked diagram', () => {
    const diagram = buildDiagram();
    diagram.version.status = 'active';
    render(<BpmnEditor diagram={diagram} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));
    expect(screen.getByText(/immutable/)).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('reflects each lifecycle status', () => {
    const diagram = buildDiagram();
    diagram.version.status = 'active';
    diagram.version.semanticVersion = '2.1.0';
    render(
      <BpmnDesigner diagram={diagram}>
        <StatusBadge />
      </BpmnDesigner>,
    );
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Active');
    expect(badge).toHaveTextContent('v2.1.0');
  });
});

describe('DiffView', () => {
  it('lists structured operations', () => {
    const before = buildDiagram();
    const after = structuredClone(before);
    after.nodes.task1.label = 'Renamed';
    const added = createNode({ type: 'endEvent', id: 'end', label: 'Fim' });
    after.nodes.end = added;
    after.edges.e1 = { ...after.edges.e1, removedInVersion: 'v2' };
    after.edges.e2 = createEdge({
      id: 'e2',
      sourceId: 'task1',
      targetId: 'end',
      supersedesEdgeId: 'e1',
    });

    render(<DiffView diff={computeDiff(before, after)} diagram={after} />);
    expect(screen.getByText(/endEvent “Fim”/)).toBeInTheDocument();
    expect(screen.getByText(/label: Work → Renamed/)).toBeInTheDocument();
    expect(screen.getByText(/superseded by e2/)).toBeInTheDocument();
  });

  it('renders an empty state', () => {
    const diagram = buildDiagram();
    render(<DiffView diff={computeDiff(diagram, diagram)} />);
    expect(screen.getByText('No changes.')).toBeInTheDocument();
  });
});

describe('resize handles', () => {
  it('appear for a selected node', () => {
    const { container } = render(<BpmnEditor diagram={buildDiagram()} />);
    fireEvent.pointerDown(container.querySelector('[data-node-id="task1"]')!, { button: 0 });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
    expect(container.querySelector('[data-resize-handles]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-resize-corner]')).toHaveLength(4);
  });
});
