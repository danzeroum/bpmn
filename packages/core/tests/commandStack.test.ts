import { describe, expect, it, vi } from 'vitest';
import {
  addEdgeCommand,
  addNodeCommand,
  CommandStack,
  compositeCommand,
  createDiagram,
  createEdge,
  createNode,
  moveNodeCommand,
  removeEdgeCommand,
  removeNodeCommand,
  resizeNodeCommand,
  restoreDiagramCommand,
  supersedeEdgeCommand,
  updateEdgeCommand,
  updateNodeCommand,
} from '../src/index.js';

function setup() {
  const diagram = createDiagram({ name: 'T' });
  const stack = new CommandStack(diagram);
  const node = createNode({ type: 'task', label: 'A', x: 0, y: 0 });
  return { diagram, stack, node };
}

describe('CommandStack', () => {
  it('executes, undoes and redoes commands', () => {
    const { stack, node } = setup();
    stack.execute(addNodeCommand(node));
    expect(stack.current.nodes[node.id]).toBeDefined();
    expect(stack.canUndo).toBe(true);

    stack.undo();
    expect(stack.current.nodes[node.id]).toBeUndefined();
    expect(stack.canRedo).toBe(true);

    stack.redo();
    expect(stack.current.nodes[node.id]).toBeDefined();
  });

  it('discards the future when executing after undo (git-like cursor)', () => {
    const { stack, node } = setup();
    const other = createNode({ type: 'task', label: 'B' });
    stack.execute(addNodeCommand(node));
    stack.execute(moveNodeCommand(node.id, { x: 0, y: 0 }, { x: 50, y: 50 }));
    stack.undo(); // back to just-added
    stack.execute(addNodeCommand(other)); // discards the move
    expect(stack.canRedo).toBe(false);
    expect(stack.current.nodes[node.id].x).toBe(0);
    expect(stack.current.nodes[other.id]).toBeDefined();
    // Undo twice returns to the empty diagram
    stack.undo();
    stack.undo();
    expect(Object.keys(stack.current.nodes)).toHaveLength(0);
    expect(stack.canUndo).toBe(false);
  });

  it('undo after multiple redos stays consistent', () => {
    const { stack, node } = setup();
    stack.execute(addNodeCommand(node));
    stack.execute(moveNodeCommand(node.id, { x: 0, y: 0 }, { x: 10, y: 10 }));
    stack.execute(moveNodeCommand(node.id, { x: 10, y: 10 }, { x: 20, y: 20 }));
    stack.undo();
    stack.undo();
    stack.redo();
    stack.redo();
    expect(stack.current.nodes[node.id].x).toBe(20);
    stack.undo();
    expect(stack.current.nodes[node.id].x).toBe(10);
  });

  it('respects the interceptor veto', () => {
    const diagram = createDiagram({ name: 'T' });
    const stack = new CommandStack(diagram, {
      interceptor: { evaluateCommand: () => ({ allowed: false, reason: 'locked' }) },
    });
    const verdict = stack.execute(addNodeCommand(createNode({ type: 'task' })));
    expect(verdict).toEqual({ allowed: false, reason: 'locked' });
    expect(Object.keys(stack.current.nodes)).toHaveLength(0);
    expect(stack.canUndo).toBe(false);
  });

  it('fires lifecycle events and notifies subscribers', () => {
    const { stack, node } = setup();
    const events: string[] = [];
    for (const name of ['command.pre', 'command.post', 'command.undone', 'command.redone']) {
      stack.bus.on(name, () => void events.push(name));
    }
    const listener = vi.fn();
    stack.subscribe(listener);

    stack.execute(addNodeCommand(node));
    stack.undo();
    stack.redo();

    expect(events).toEqual(['command.pre', 'command.post', 'command.undone', 'command.redone']);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('command.pre listeners can cancel execution', () => {
    const { stack, node } = setup();
    stack.bus.on('command.pre', () => false);
    const verdict = stack.execute(addNodeCommand(node));
    expect(verdict.allowed).toBe(false);
    expect(Object.keys(stack.current.nodes)).toHaveLength(0);
  });

  it('reset replaces state and clears history', () => {
    const { stack, node } = setup();
    stack.execute(addNodeCommand(node));
    const fresh = createDiagram({ name: 'fresh' });
    stack.reset(fresh);
    expect(stack.current.name).toBe('fresh');
    expect(stack.canUndo).toBe(false);
  });
});

describe('commands', () => {
  it('updateNodeCommand patches label/properties and restores on undo', () => {
    const { stack, node } = setup();
    stack.execute(addNodeCommand(node));
    stack.execute(updateNodeCommand(node.id, { label: 'New', properties: { k: 1 } }));
    expect(stack.current.nodes[node.id].label).toBe('New');
    expect(stack.current.nodes[node.id].properties).toEqual({ k: 1 });
    stack.undo();
    expect(stack.current.nodes[node.id].label).toBe('A');
    expect(stack.current.nodes[node.id].properties).toEqual({});
  });

  it('resizeNodeCommand changes the rect and restores the exact original on undo', () => {
    const { stack, node } = setup();
    stack.execute(addNodeCommand(node));
    const from = { x: node.x, y: node.y, width: node.width, height: node.height };
    const to = { x: node.x, y: node.y, width: node.width + 40, height: node.height + 20 };

    stack.execute(resizeNodeCommand(node.id, from, to));
    expect(stack.current.nodes[node.id]).toMatchObject(to);

    stack.undo();
    expect(stack.current.nodes[node.id]).toMatchObject(from);
  });

  it('resizeNodeCommand also relocates the node (north-west corner drag)', () => {
    const { stack, node } = setup();
    stack.execute(addNodeCommand(node));
    // Dragging the NW corner grows the box while moving its origin.
    const from = { x: 0, y: 0, width: 120, height: 60 };
    const to = { x: -30, y: -10, width: 150, height: 70 };

    stack.execute(resizeNodeCommand(node.id, from, to));
    expect(stack.current.nodes[node.id]).toMatchObject(to);
    stack.undo();
    expect(stack.current.nodes[node.id]).toMatchObject(from);
  });

  it('resizeNodeCommand is a no-op for an unknown node id', () => {
    const { stack } = setup();
    const before = stack.current;
    stack.execute(
      resizeNodeCommand('ghost', { x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 20, height: 20 }),
    );
    expect(stack.current).toBe(before);
  });

  it('resizeNodeCommand reports a NODE_RESIZED audit event with from/to', () => {
    const from = { x: 0, y: 0, width: 120, height: 60 };
    const to = { x: 0, y: 0, width: 160, height: 80 };
    const event = resizeNodeCommand('n1', from, to).toAuditEvent?.();
    expect(event).toEqual({ type: 'NODE_RESIZED', details: { nodeId: 'n1', from, to } });
  });

  it('updateEdgeCommand patches purpose and restores on undo', () => {
    const { stack, node } = setup();
    const target = createNode({ type: 'task', label: 'B' });
    const edge = createEdge({ sourceId: node.id, targetId: target.id });
    stack.execute(addNodeCommand(node));
    stack.execute(addNodeCommand(target));
    stack.execute(addEdgeCommand(edge));
    stack.execute(updateEdgeCommand(edge.id, { purpose: 'handoff', label: 'go' }));
    expect(stack.current.edges[edge.id].purpose).toBe('handoff');
    stack.undo();
    expect(stack.current.edges[edge.id].purpose).toBeUndefined();
    expect(stack.current.edges[edge.id].label).toBeUndefined();
  });

  it('removeNodeCommand hard-deletes in draft, including connected edges', () => {
    const { stack, node } = setup();
    const target = createNode({ type: 'task', label: 'B' });
    const edge = createEdge({ sourceId: node.id, targetId: target.id });
    stack.execute(addNodeCommand(node));
    stack.execute(addNodeCommand(target));
    stack.execute(addEdgeCommand(edge));

    stack.execute(removeNodeCommand(node.id));
    expect(stack.current.nodes[node.id]).toBeUndefined();
    expect(stack.current.edges[edge.id]).toBeUndefined();

    stack.undo();
    expect(stack.current.nodes[node.id]).toBeDefined();
    expect(stack.current.edges[edge.id]).toBeDefined();
  });

  it('removeNodeCommand closes (not deletes) outside draft', () => {
    const diagram = createDiagram({ name: 'T' });
    diagram.version.status = 'test';
    const node = createNode({ type: 'task' });
    const target = createNode({ type: 'task' });
    const edge = createEdge({ sourceId: node.id, targetId: target.id });
    diagram.nodes[node.id] = node;
    diagram.nodes[target.id] = target;
    diagram.edges[edge.id] = edge;
    const stack = new CommandStack(diagram);

    stack.execute(removeNodeCommand(node.id, { id: 'u1', role: 'editor' }));
    const closed = stack.current.nodes[node.id];
    expect(closed).toBeDefined();
    expect(closed.removedInVersion).toBe(diagram.version.id);
    expect(closed.audit.history.at(-1)?.type).toBe('REMOVED');
    expect(stack.current.edges[edge.id].removedInVersion).toBe(diagram.version.id);

    stack.undo();
    expect(stack.current.nodes[node.id].removedInVersion).toBeUndefined();
    expect(stack.current.edges[edge.id].removedInVersion).toBeUndefined();
  });

  it('removeEdgeCommand closes outside draft and restores on undo', () => {
    const diagram = createDiagram({ name: 'T' });
    diagram.version.status = 'candidate';
    const edge = createEdge({ sourceId: 'a', targetId: 'b' });
    diagram.edges[edge.id] = edge;
    const stack = new CommandStack(diagram);
    stack.execute(removeEdgeCommand(edge.id));
    expect(stack.current.edges[edge.id].removedInVersion).toBe(diagram.version.id);
    stack.undo();
    expect(stack.current.edges[edge.id].removedInVersion).toBeUndefined();
  });

  it('supersedeEdgeCommand closes the old edge and links the replacement', () => {
    const diagram = createDiagram({ name: 'T' });
    diagram.version.status = 'test';
    const oldEdge = createEdge({ sourceId: 'a', targetId: 'b' });
    diagram.edges[oldEdge.id] = oldEdge;
    const stack = new CommandStack(diagram);
    const replacement = createEdge({ sourceId: 'a', targetId: 'c' });

    stack.execute(supersedeEdgeCommand(oldEdge.id, replacement));
    expect(stack.current.edges[oldEdge.id].removedInVersion).toBe(diagram.version.id);
    expect(stack.current.edges[replacement.id].supersedesEdgeId).toBe(oldEdge.id);

    stack.undo();
    expect(stack.current.edges[oldEdge.id].removedInVersion).toBeUndefined();
    expect(stack.current.edges[replacement.id]).toBeUndefined();
  });

  it('compositeCommand groups commands into one undo step', () => {
    const { stack, node } = setup();
    const other = createNode({ type: 'task', label: 'B' });
    stack.execute(
      compositeCommand('add two nodes', [addNodeCommand(node), addNodeCommand(other)]),
    );
    expect(Object.keys(stack.current.nodes)).toHaveLength(2);
    stack.undo();
    expect(Object.keys(stack.current.nodes)).toHaveLength(0);
    stack.redo();
    expect(Object.keys(stack.current.nodes)).toHaveLength(2);
  });

  it('commands expose audit events', () => {
    const node = createNode({ type: 'task' });
    expect(addNodeCommand(node).toAuditEvent?.().type).toBe('NODE_ADDED');
    expect(removeNodeCommand(node.id).toAuditEvent?.().type).toBe('NODE_REMOVED');
    expect(
      compositeCommand('c', [addNodeCommand(node)]).toAuditEvent?.().type,
    ).toBe('COMPOSITE');
  });
});

describe('restoreDiagramCommand', () => {
  it('replaces the diagram, undoes to the pre-restore state and audits', () => {
    const { diagram, stack, node } = setup();
    stack.execute(addNodeCommand(node));
    const withNode = stack.current;

    const snapshot = createDiagram({ name: 'Recovered', id: diagram.id });
    const command = restoreDiagramCommand(snapshot);
    stack.execute(command);
    expect(stack.current).toBe(snapshot);

    stack.undo();
    expect(stack.current).toBe(withNode);
    stack.redo();
    expect(stack.current).toBe(snapshot);

    const audit = command.toAuditEvent?.();
    expect(audit?.type).toBe('DIAGRAM_RESTORED');
    expect(audit?.details.restoredVersionId).toBe(snapshot.version.id);
  });
});
