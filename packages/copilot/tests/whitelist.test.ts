import { describe, expect, it } from 'vitest';
import { CommandStack, createDiagram, createEdge, createNode } from '@buildtovalue/core';
import { buildPlan, validateProposal, type CopilotProposal } from '../src/index.js';

/**
 * Per-command vectors: every whitelisted command validates its params and
 * materializes the real core command (checked end-to-end through a stack).
 */
const REF = { id: 'copilot-adjust', version: '1.0.0' };

function seeded() {
  const diagram = createDiagram({ name: 'W' });
  diagram.nodes.a = createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 0 });
  diagram.nodes.b = createNode({ type: 'task', id: 'b', label: 'B', x: 200, y: 0 });
  diagram.edges.e = createEdge({ id: 'e', sourceId: 'a', targetId: 'b' });
  return diagram;
}

const propose = (commands: CopilotProposal['commands']): CopilotProposal => ({
  commands,
  rationale: 'ajuste',
  promptTemplateRef: REF,
});

function apply(commands: CopilotProposal['commands']) {
  const diagram = seeded();
  const plan = buildPlan(diagram, propose(commands));
  const stack = new CommandStack(diagram);
  stack.execute(plan.command);
  return stack.current;
}

describe('whitelist materializers (end-to-end through a stack)', () => {
  it('updateNode patches label and properties', () => {
    const out = apply([
      { type: 'updateNode', params: { id: 'a', label: 'A2', properties: { k: 'v' } } },
    ]);
    expect(out.nodes.a.label).toBe('A2');
    expect(out.nodes.a.properties.k).toBe('v');
  });

  it('updateEdge patches label, purpose and properties', () => {
    const out = apply([
      { type: 'updateEdge', params: { id: 'e', label: 'sim', purpose: 'handoff', properties: { p: 1 } } },
    ]);
    expect(out.edges.e.label).toBe('sim');
    expect(out.edges.e.purpose).toBe('handoff');
    expect(out.edges.e.properties.p).toBe(1);
  });

  it('moveNode moves from the CURRENT position (undo restores it)', () => {
    const diagram = seeded();
    const plan = buildPlan(diagram, propose([{ type: 'moveNode', params: { id: 'a', x: 50, y: 60 } }]));
    const stack = new CommandStack(diagram);
    stack.execute(plan.command);
    expect(stack.current.nodes.a).toMatchObject({ x: 50, y: 60 });
    stack.undo();
    expect(stack.current.nodes.a).toMatchObject({ x: 0, y: 0 });
  });

  it('removeNode and removeEdge delete drafts', () => {
    const out = apply([
      { type: 'removeEdge', params: { id: 'e' } },
      { type: 'removeNode', params: { id: 'b' } },
    ]);
    expect(out.edges.e).toBeUndefined();
    expect(out.nodes.b).toBeUndefined();
  });

  it('addEdge accepts type/label/purpose and can target a node added in the same plan', () => {
    const out = apply([
      { type: 'addNode', params: { id: 'c', type: 'task', label: 'C', x: 400, y: 0 } },
      { type: 'addEdge', params: { id: 'e2', sourceId: 'b', targetId: 'c', label: 'segue', purpose: 'fluxo' } },
    ]);
    expect(out.nodes.c).toBeDefined();
    expect(out.edges.e2.label).toBe('segue');
  });
});

describe('whitelist param validation — every branch is a readable error', () => {
  const diagram = seeded();
  it.each([
    [{ type: 'addNode', params: { type: 'task', label: 'X', x: 0, y: 0 } }, "string 'id'"],
    [{ type: 'addNode', params: { id: 'a', type: 'task', label: 'X', x: 0, y: 0 } }, 'already exists'],
    [{ type: 'addNode', params: { id: 'n', label: 'X', x: 0, y: 0 } }, "string 'type'"],
    [{ type: 'addNode', params: { id: 'n', type: 'task', x: 0, y: 0 } }, "string 'label'"],
    [{ type: 'addNode', params: { id: 'n', type: 'task', label: 'X', x: 'k', y: 0 } }, "numeric 'x' and 'y'"],
    [{ type: 'addNode', params: { id: 'n', type: 'task', label: 'X', x: 0, y: 0, properties: 3 } }, 'must be an object'],
    [{ type: 'addEdge', params: { sourceId: 'a', targetId: 'b' } }, "string 'id'"],
    [{ type: 'addEdge', params: { id: 'e', sourceId: 'a', targetId: 'b' } }, 'already exists'],
    [{ type: 'addEdge', params: { id: 'x', sourceId: 'nope', targetId: 'b' } }, 'unknown sourceId'],
    [{ type: 'addEdge', params: { id: 'x', sourceId: 'a', targetId: 'nope' } }, 'unknown targetId'],
    [{ type: 'updateNode', params: { id: 'nope' } }, 'unknown id'],
    [{ type: 'updateNode', params: { id: 'a', label: 3 } }, "'label' must be a string"],
    [{ type: 'updateNode', params: { id: 'a', properties: [] } }, 'must be an object'],
    [{ type: 'updateEdge', params: { id: 'nope' } }, 'unknown id'],
    [{ type: 'updateEdge', params: { id: 'e', properties: 'x' } }, 'must be an object'],
    [{ type: 'moveNode', params: { id: 'nope', x: 0, y: 0 } }, 'unknown id'],
    [{ type: 'moveNode', params: { id: 'a', x: 'k', y: 0 } }, "numeric 'x' and 'y'"],
    [{ type: 'removeNode', params: { id: 'nope' } }, 'unknown id'],
    [{ type: 'removeEdge', params: { id: 'nope' } }, 'unknown id'],
  ] as const)('%o', (command, fragment) => {
    const verdict = validateProposal(diagram, propose([command as CopilotProposal['commands'][0]]));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.errors[0].message).toContain(fragment);
  });
});
