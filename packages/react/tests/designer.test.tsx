import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  addNodeCommand,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { BpmnDesigner, BpmnViewer, useDiagram } from '../src/index.js';

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

describe('swimlanes (pools & lanes)', () => {
  function swimlaneDiagram(): BpmnDiagram {
    const diagram = createDiagram({ name: 'Swimlane' });
    diagram.nodes = {
      pool1: createNode({ type: 'pool', id: 'pool1', label: 'Editorial', x: 0, y: 0, width: 500, height: 240 }),
      lane1: createNode({ type: 'lane', id: 'lane1', label: 'Authors', x: 30, y: 0, width: 470, height: 240 }),
      task1: createNode({ type: 'task', id: 'task1', label: 'Write', x: 120, y: 60 }),
    };
    return diagram;
  }

  it('renders pools and lanes behind flow nodes (containers first in the node layer)', () => {
    const { container } = render(<BpmnDesigner diagram={swimlaneDiagram()} />);
    const layer = container.querySelector('[data-layer="nodes"]')!;
    const ids = [...layer.querySelectorAll(':scope > [data-node-id]')].map((el) =>
      el.getAttribute('data-node-id'),
    );
    // Pool paints first, then lane, then the flow node on top.
    expect(ids).toEqual(['pool1', 'lane1', 'task1']);
    expect(screen.getByText('Editorial')).toBeInTheDocument();
    expect(screen.getByText('Authors')).toBeInTheDocument();
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

  it('ignores Delete and arrow-key shortcuts entirely', () => {
    const { container } = render(<BpmnViewer diagram={buildDiagram()} />);
    const before = container.querySelectorAll('[data-node-id]').length;
    fireEvent.keyDown(window, { key: 'Delete' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(before);
  });

  it('does not undo pre-existing history via Ctrl+Z (regression: undo/redo bypassed the readOnly gate)', () => {
    // <BpmnViewer> is exactly <BpmnDesigner readOnly> (see BpmnDesigner.tsx)
    // but doesn't forward children, so BpmnDesigner is used directly here to
    // reach useDiagram() and seed undo history — exactly what a host app
    // would have if it fed a diagram with prior edits into a read-only view.
    // UI gestures can't produce that history themselves (they're already
    // blocked), which is precisely why the keyboard shortcut path needs its
    // own explicit proof.
    let addedNodeId = '';
    function Seed() {
      const { execute } = useDiagram();
      useEffect(() => {
        const node = createNode({ type: 'task', label: 'Seeded' });
        addedNodeId = node.id;
        execute(addNodeCommand(node));
      }, [execute]);
      return null;
    }
    const { container } = render(
      <BpmnDesigner diagram={buildDiagram()} readOnly>
        <Seed />
      </BpmnDesigner>,
    );
    expect(queryNode(container, addedNodeId)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    // Before the fix, this undid the seeded command even in read-only mode.
    expect(queryNode(container, addedNodeId)).toBeInTheDocument();
  });

  it('still allows Space to arm panning (a viewport op, not a mutation)', () => {
    render(<BpmnViewer diagram={buildDiagram()} />);
    // No assertion beyond "doesn't throw" — panning has no observable DOM
    // side effect by itself, this just proves readOnly doesn't block it.
    expect(() => fireEvent.keyDown(window, { key: ' ' })).not.toThrow();
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

describe('data associations (F7-3)', () => {
  it('renders the built-in dotted style with an open arrowhead', () => {
    const diagram = createDiagram({ name: 'Data' });
    diagram.nodes = {
      doc: createNode({ type: 'dataObject', id: 'doc', label: 'Order', x: 40, y: 40 }),
      work: createNode({ type: 'task', id: 'work', label: 'Handle', x: 200, y: 40 }),
    };
    diagram.edges = {
      d1: createEdge({ id: 'd1', sourceId: 'doc', targetId: 'work', type: 'dataAssociation' }),
    };
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    const line = container.querySelector('[data-edge-id="d1"] path[marker-end]')!;
    expect(line.getAttribute('stroke-dasharray')).toBe('2,4');
    expect(line.getAttribute('marker-end')).toBe('url(#bpmnr-edge-open)');
  });
});
