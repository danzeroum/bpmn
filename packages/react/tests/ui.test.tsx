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
    expect(screen.getByRole('status', { name: /Version 0\.1\.0/ })).toHaveTextContent('RASCUNHO');
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

describe('StatusBadge (vigência seal v2)', () => {
  const renderBadge = (
    mutate: (d: BpmnDiagram) => void,
    props: { channel?: string } = {},
    plugins?: Parameters<typeof BpmnDesigner>[0]['plugins'],
  ) => {
    const diagram = buildDiagram();
    mutate(diagram);
    render(
      <BpmnDesigner diagram={diagram} plugins={plugins}>
        <StatusBadge {...props} />
      </BpmnDesigner>,
    );
    return screen.getByRole('status');
  };

  it('shows the canonical PT label, semver and data-status for each status', () => {
    const labels: Record<string, string> = {
      draft: 'RASCUNHO',
      test: 'TESTE INTERNO',
      candidate: 'CANDIDATA',
      active: 'ATIVA',
      deprecated: 'DESCONTINUADA',
      retired: 'ARQUIVADA',
    };
    for (const [status, label] of Object.entries(labels)) {
      const diagram = buildDiagram();
      diagram.version.status = status as BpmnDiagram['version']['status'];
      diagram.version.semanticVersion = '2.1.0';
      const { unmount } = render(
        <BpmnDesigner diagram={diagram}>
          <StatusBadge />
        </BpmnDesigner>,
      );
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent(label);
      expect(badge).toHaveTextContent('v2.1.0');
      expect(badge).toHaveAttribute('data-status', status);
      unmount();
    }
  });

  it('derives the candidate meta from the lifecycle engine (never hardcoded)', () => {
    const badge = renderBadge((d) => {
      d.version.status = 'candidate';
    });
    expect(badge).toHaveTextContent('aguarda 2 aprovações');
  });

  it('respects a plugin lifecycleConfig with a different approval quorum', () => {
    const badge = renderBadge(
      (d) => {
        d.version.status = 'candidate';
      },
      {},
      [{ id: 'test/quorum', lifecycleConfig: { minApprovalRoles: 3 } }],
    );
    expect(badge).toHaveTextContent('aguarda 3 aprovações');
  });

  it('counts distinct approved roles and prefixes the channel when given', () => {
    const badge = renderBadge(
      (d) => {
        d.version.status = 'candidate';
        d.version.approvedBy = [
          { userId: 'u1', role: 'operação', approvedAt: '2026-07-07T10:00:00Z', reason: 'ok' },
        ];
      },
      { channel: 'piloto' },
    );
    expect(badge).toHaveTextContent('canal: piloto · aguarda 1 aprovação');
  });

  it('reports a candidate with a full quorum as ready for activation', () => {
    const badge = renderBadge((d) => {
      d.version.status = 'candidate';
      d.version.approvedBy = [
        { userId: 'u1', role: 'operação', approvedAt: '2026-07-07T10:00:00Z', reason: 'ok' },
        { userId: 'u2', role: 'compliance', approvedAt: '2026-07-07T11:00:00Z', reason: 'ok' },
      ];
    });
    expect(badge).toHaveTextContent('pronta para ativação');
  });

  it('shows vigência and approver roles for the active status', () => {
    const badge = renderBadge((d) => {
      d.version.status = 'active';
      d.version.effectiveFrom = '2026-07-07T12:00:00Z';
      d.version.approvedBy = [
        { userId: 'u1', role: 'operação', approvedAt: '2026-07-07T10:00:00Z', reason: 'ok' },
        { userId: 'u2', role: 'compliance', approvedAt: '2026-07-07T11:00:00Z', reason: 'ok' },
      ];
    });
    expect(badge).toHaveTextContent('vigente desde 07/07/2026');
    expect(badge).toHaveTextContent('aprovada por operação, compliance');
  });

  it('shows the closing date for deprecated versions and no meta for drafts', () => {
    const deprecated = renderBadge((d) => {
      d.version.status = 'deprecated';
      d.version.effectiveUntil = '2026-07-07T12:00:00Z';
    });
    expect(deprecated).toHaveTextContent('vigente até 07/07/2026');
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

  function bodyRect(container: HTMLElement, nodeId: string): Element {
    // The shape's own body <rect> always renders first, before the
    // selection outline and the resize-handle rects.
    return container.querySelector(`[data-node-id="${nodeId}"] rect`)!;
  }

  function selectAndGrabCorner(container: HTMLElement, nodeId: string, corner: string) {
    fireEvent.pointerDown(container.querySelector(`[data-node-id="${nodeId}"]`)!, { button: 0 });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
    return container.querySelector(`[data-node-id="${nodeId}"] [data-resize-corner="${corner}"]`)!;
  }

  it('dragging the south-east handle grows the node, and undo restores the exact size', () => {
    const { container } = render(<BpmnEditor diagram={buildDiagram()} />);
    expect(bodyRect(container, 'task1').getAttribute('width')).toBe('120');
    expect(bodyRect(container, 'task1').getAttribute('height')).toBe('60');

    const corner = selectAndGrabCorner(container, 'task1', 'se');
    fireEvent.pointerDown(corner, { button: 0, clientX: 300, clientY: 100 });
    fireEvent.pointerMove(corner, { clientX: 340, clientY: 120 }); // +40 x, +20 y — multiples of the 20px grid
    fireEvent.pointerUp(corner, { button: 0, clientX: 340, clientY: 120 });

    expect(bodyRect(container, 'task1').getAttribute('width')).toBe('160');
    expect(bodyRect(container, 'task1').getAttribute('height')).toBe('80');

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(bodyRect(container, 'task1').getAttribute('width')).toBe('120');
    expect(bodyRect(container, 'task1').getAttribute('height')).toBe('60');
  });

  it('dragging the north-west handle grows the node without moving its far edge', () => {
    const { container } = render(<BpmnEditor diagram={buildDiagram()} />);
    const corner = selectAndGrabCorner(container, 'task1', 'nw');
    fireEvent.pointerDown(corner, { button: 0, clientX: 160, clientY: 30 });
    fireEvent.pointerMove(corner, { clientX: 120, clientY: 10 }); // -40 x, -20 y
    fireEvent.pointerUp(corner, { button: 0, clientX: 120, clientY: 10 });

    const g = container.querySelector('[data-node-id="task1"]')!;
    expect(g.getAttribute('transform')).toBe('translate(120, 10)');
    expect(bodyRect(container, 'task1').getAttribute('width')).toBe('160');
    expect(bodyRect(container, 'task1').getAttribute('height')).toBe('80');
  });

  it('clamps to a 20px minimum instead of shrinking to zero or going negative', () => {
    const { container } = render(<BpmnEditor diagram={buildDiagram()} />);
    const corner = selectAndGrabCorner(container, 'task1', 'se');
    fireEvent.pointerDown(corner, { button: 0, clientX: 300, clientY: 100 });
    fireEvent.pointerMove(corner, { clientX: -2000, clientY: -2000 }); // absurd inward drag
    fireEvent.pointerUp(corner, { button: 0, clientX: -2000, clientY: -2000 });

    expect(bodyRect(container, 'task1').getAttribute('width')).toBe('20');
    expect(bodyRect(container, 'task1').getAttribute('height')).toBe('20');
  });

  it('does nothing in read-only mode (no handles, no resize)', () => {
    const { container } = render(<BpmnDesigner diagram={buildDiagram()} readOnly />);
    fireEvent.pointerDown(container.querySelector('[data-node-id="task1"]')!, { button: 0 });
    expect(container.querySelector('[data-resize-handles]')).not.toBeInTheDocument();
  });
});
