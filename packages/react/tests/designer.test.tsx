import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@bpmn-react/core';
import { BpmnDesigner, BpmnViewer } from '../src/index.js';

function buildDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Test flow' });
  const start = createNode({ type: 'startEvent', id: 'start', label: 'Begin', x: 40, y: 40 });
  const task = createNode({ type: 'userTask', id: 'task1', label: 'Review', x: 160, y: 30 });
  const end = createNode({ type: 'endEvent', id: 'end', label: 'Done', x: 360, y: 40 });
  diagram.nodes = { start, task1: task, end };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'task1', label: 'go' }),
    e2: { ...createEdge({ id: 'e2', sourceId: 'task1', targetId: 'end' }), removedInVersion: 'v9' },
  };
  return diagram;
}

function queryNode(container: HTMLElement, id: string) {
  return container.querySelector(`[data-node-id="${id}"]`);
}

describe('BpmnDesigner rendering', () => {
  it('renders nodes and edges as SVG', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    expect(container.querySelector('svg.bpmnr-canvas')).toBeInTheDocument();
    expect(queryNode(container, 'start')).toBeInTheDocument();
    expect(queryNode(container, 'task1')).toBeInTheDocument();
    expect(container.querySelector('[data-edge-id="e1"]')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('go')).toBeInTheDocument();
  });

  it('renders closed edges dashed and can hide them', () => {
    const diagram = buildDiagram();
    const { container, rerender } = render(<BpmnDesigner diagram={diagram} />);
    const closedPath = container.querySelector('[data-edge-id="e2"] path[stroke-dasharray]');
    expect(closedPath).toBeInTheDocument();

    rerender(<BpmnDesigner diagram={diagram} showClosed={false} />);
    expect(container.querySelector('[data-edge-id="e2"]')).not.toBeInTheDocument();
  });

  it('exposes an accessible application role', () => {
    render(<BpmnDesigner diagram={buildDiagram()} />);
    expect(screen.getByRole('application')).toHaveAccessibleName('BPMN diagram: Test flow');
  });
});

describe('selection and editing', () => {
  it('selects a node on pointer down and shows ports', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} />);
    const node = queryNode(container, 'task1')!;
    fireEvent.pointerDown(node, { button: 0 });
    expect(container.querySelector('[data-node-id="task1"] [data-ports]')).toBeInTheDocument();
  });

  it('deletes the selection and undoes with keyboard shortcuts', () => {
    const onChange = vi.fn();
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} onChange={onChange} />);
    const node = queryNode(container, 'task1')!;
    fireEvent.pointerDown(node, { button: 0 });
    fireEvent.pointerUp(container.querySelector('svg')!, { button: 0 });

    fireEvent.keyDown(window, { key: 'Delete' });
    expect(queryNode(container, 'task1')).not.toBeInTheDocument();
    // Draft semantics: connected edges hard-deleted with the node
    expect(container.querySelector('[data-edge-id="e1"]')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(queryNode(container, 'task1')).toBeInTheDocument();
    expect(container.querySelector('[data-edge-id="e1"]')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true }); // redo
    expect(queryNode(container, 'task1')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalled();
  });

  it('locks editing on active diagrams (default rules)', () => {
    const diagram = buildDiagram();
    diagram.version.status = 'active';
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    const node = queryNode(container, 'task1')!;
    fireEvent.pointerDown(node, { button: 0 });
    fireEvent.keyDown(window, { key: 'Delete' });
    // Node still present — command was vetoed
    expect(queryNode(container, 'task1')).toBeInTheDocument();
  });
});

describe('BpmnViewer', () => {
  it('does not select nodes in read-only mode', () => {
    const { container } = render(<BpmnViewer diagram={buildDiagram()} />);
    const node = queryNode(container, 'task1')!;
    fireEvent.pointerDown(node, { button: 0 });
    expect(container.querySelector('[data-ports]')).not.toBeInTheDocument();
  });
});

describe('plugins', () => {
  it('renders custom node types with custom shapes', () => {
    const diagram = createDiagram({ name: 'P' });
    diagram.nodes = {
      p1: {
        ...createNode({ type: 'task', id: 'p1', label: 'Persona X' }),
        type: 'demo:persona',
      },
    };
    const { container } = render(
      <BpmnDesigner
        diagram={diagram}
        plugins={[
          {
            id: 'demo',
            nodeTypes: [
              {
                type: 'demo:persona',
                label: 'Persona',
                category: 'custom',
                defaultSize: { width: 120, height: 80 },
                xml: { tag: 'userTask' },
              },
            ],
            shapes: {
              'demo:persona': ({ node }) => (
                <rect data-testid="persona-shape" width={node.width} height={node.height} />
              ),
            },
          },
        ]}
      />,
    );
    expect(container.querySelector('[data-testid="persona-shape"]')).toBeInTheDocument();
  });
});
