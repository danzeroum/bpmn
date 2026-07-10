import { describe, expect, it } from 'vitest';
import { RESEARCH_AGENT, type AgentWorkflow } from '@buildtovalue/agentflow';
import { createDiagram, createNode } from '@buildtovalue/core';
import {
  addEdge,
  addNode,
  agentEditorReducer,
  initEditorState,
  layoutWorkflow,
  nextNodeId,
  proposeErrorBoundaryCommand,
  removeNode,
  toggleDecorator,
  updateNodeConfig,
} from '../src/index.js';

const base = (): AgentWorkflow => structuredClone(RESEARCH_AGENT);

describe('agentEditor transforms (pure, isolated)', () => {
  it('addNode appends a node with a deterministic id + default config', () => {
    const { workflow, effect } = addNode(base(), 'llm');
    expect(workflow.nodes.length).toBe(RESEARCH_AGENT.nodes.length + 1);
    expect(effect).toMatchObject({ event: 'element.added', kind: 'node', elementType: 'llm' });
    const added = workflow.nodes.at(-1)!;
    expect(added.type).toBe('llm');
  });

  it('nextNodeId avoids collisions', () => {
    const wf = base();
    const id = nextNodeId(wf, 'tool'); // tool-2 already exists as "tool-2"
    expect(wf.nodes.some((n) => n.id === id)).toBe(false);
  });

  it('updateNodeConfig shallow-merges the config', () => {
    const { workflow } = updateNodeConfig(base(), 'llm-1', { model: 'gpt-5' });
    const node = workflow.nodes.find((n) => n.id === 'llm-1')!;
    expect(node.type === 'llm' && node.config.model).toBe('gpt-5');
    expect(node.type === 'llm' && node.config.promptRef).toBe('prm:research@2.0.0'); // preserved
  });

  it('removeNode drops the node and its edges', () => {
    const { workflow } = removeNode(base(), 'tool-2');
    expect(workflow.nodes.some((n) => n.id === 'tool-2')).toBe(false);
    expect(workflow.edges.some((e) => e.from === 'tool-2' || e.to === 'tool-2')).toBe(false);
  });

  it('addEdge adds once and dedups exact duplicates', () => {
    const first = addEdge(base(), 'llm-1', 'dec-3', 'data').workflow;
    const count = first.edges.filter((e) => e.from === 'llm-1' && e.to === 'dec-3' && e.edgeType === 'data').length;
    expect(count).toBe(1);
    const again = addEdge(first, 'llm-1', 'dec-3', 'data').workflow;
    expect(again.edges.length).toBe(first.edges.length);
  });

  it('toggleDecorator adds then removes a decorator', () => {
    const on = toggleDecorator(base(), 'tool-2', 'memory').workflow;
    expect(on.nodes.find((n) => n.id === 'tool-2')!.decorators?.some((d) => d.type === 'memory')).toBe(true);
    const off = toggleDecorator(on, 'tool-2', 'memory').workflow;
    expect(off.nodes.find((n) => n.id === 'tool-2')!.decorators?.some((d) => d.type === 'memory')).toBe(false);
  });

  it('layoutWorkflow gives every node a deterministic position', () => {
    const a = layoutWorkflow(base());
    const b = layoutWorkflow(base());
    expect(a).toEqual(b);
    expect(a.length).toBe(RESEARCH_AGENT.nodes.length);
    expect(a.every((l) => Number.isFinite(l.x) && Number.isFinite(l.y))).toBe(true);
  });
});

describe('agentEditor isolated undo stack', () => {
  it('apply → undo → redo walks the history', () => {
    let state = initEditorState(base());
    state = agentEditorReducer(state, { type: 'apply', result: addNode(state.present, 'tool') });
    const afterApply = state.present.nodes.length;
    state = agentEditorReducer(state, { type: 'undo' });
    expect(state.present.nodes.length).toBe(afterApply - 1);
    expect(state.historyOp).toBe('undo');
    state = agentEditorReducer(state, { type: 'redo' });
    expect(state.present.nodes.length).toBe(afterApply);
    expect(state.historyOp).toBe('redo');
  });

  it('undo/redo are no-ops at the ends', () => {
    const state = initEditorState(base());
    expect(agentEditorReducer(state, { type: 'undo' })).toBe(state);
    expect(agentEditorReducer(state, { type: 'redo' })).toBe(state);
  });

  it('reset clears history to a new present', () => {
    let state = initEditorState(base());
    state = agentEditorReducer(state, { type: 'apply', result: addNode(state.present, 'llm') });
    const other = { ...base(), id: 'agnt-other' };
    state = agentEditorReducer(state, { type: 'reset', workflow: other });
    expect(state.present.id).toBe('agnt-other');
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });
});

describe('proposeErrorBoundaryCommand (N-1 reuse)', () => {
  it('builds one composite command that attaches a boundary event to the host', () => {
    const d = createDiagram({ name: 'M' });
    d.nodes = { t1: createNode({ type: 'agentTask', id: 't1', label: 'Agent', x: 100, y: 100 }) };
    const cmd = proposeErrorBoundaryCommand(d, 't1');
    expect(cmd).not.toBeNull();
    const next = cmd!.execute(d);
    const attached = Object.values(next.nodes).filter(
      (n) => n.type === 'boundaryEvent' && n.properties.attachedToRef === 't1',
    );
    expect(attached).toHaveLength(1);
    // undoable back to the original
    expect(Object.keys(cmd!.undo(next).nodes)).toEqual(['t1']);
  });

  it('returns null when the host node is absent (nothing to anchor)', () => {
    expect(proposeErrorBoundaryCommand(createDiagram({ name: 'M' }), 'ghost')).toBeNull();
  });
});
