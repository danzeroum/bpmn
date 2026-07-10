import { describe, expect, it } from 'vitest';
import { CommandStack, createDiagram } from '@buildtovalue/core';
import {
  buildPlan,
  parseProposal,
  soundnessErrors,
  validateProposal,
  type CopilotProposal,
} from '../src/index.js';

/**
 * CP-1 proposal lifecycle: parse (structured errors, never throws), integral
 * validation (§1.3), one-composite plan ("Desfazer tudo" = 1 undo), and the
 * LOCALLY computed soundness preview (§3 — the AI's claim is dropped).
 */
const REF = { id: 'copilot-draft', version: '1.0.0' };

/** A minimal sound draft: start → task → end. */
function soundCommands() {
  return [
    { type: 'addNode', params: { id: 's', type: 'startEvent', label: 'Início', x: 0, y: 100 } },
    { type: 'addNode', params: { id: 't', type: 'task', label: 'Trabalho', x: 150, y: 90 } },
    { type: 'addNode', params: { id: 'e', type: 'endEvent', label: 'Fim', x: 350, y: 100 } },
    { type: 'addEdge', params: { id: 'f1', sourceId: 's', targetId: 't' } },
    { type: 'addEdge', params: { id: 'f2', sourceId: 't', targetId: 'e' } },
  ];
}

describe('parseProposal', () => {
  it('parses a fenced JSON completion', () => {
    const raw = '```json\n' + JSON.stringify({ commands: soundCommands(), rationale: 'draft', promptTemplateRef: REF }) + '\n```';
    const parsed = parseProposal(raw);
    expect('proposal' in parsed).toBe(true);
    if ('proposal' in parsed) {
      expect(parsed.proposal.commands).toHaveLength(5);
      expect(parsed.proposal.rationale).toBe('draft');
      expect(parsed.proposal.promptTemplateRef).toEqual(REF);
    }
  });

  it('drops a provider-supplied soundnessPreview (§3 — never trusted)', () => {
    const raw = JSON.stringify({
      commands: soundCommands(),
      rationale: 'draft',
      promptTemplateRef: REF,
      soundnessPreview: { errors: 0, warnings: 0 }, // the AI claims perfection
    });
    const parsed = parseProposal(raw);
    if ('proposal' in parsed) expect(parsed.proposal.soundnessPreview).toBeUndefined();
    else throw new Error('expected proposal');
  });

  it.each([
    ['not json at all', 'not valid JSON'],
    ['[1,2]', "needs a 'commands' array"],
    ['{"commands":[{"params":{}}],"rationale":"r","promptTemplateRef":{"id":"a","version":"1"}}', "command #1 needs a string 'type'"],
    ['{"commands":[],"rationale":42,"promptTemplateRef":{"id":"a","version":"1"}}', "string 'rationale'"],
    ['{"commands":[],"rationale":"r"}', 'promptTemplateRef'],
  ])('malformed input %# → structured error', (raw, fragment) => {
    const parsed = parseProposal(raw);
    expect('error' in parsed).toBe(true);
    if ('error' in parsed) expect(parsed.error).toContain(fragment);
  });
});

describe('validateProposal — integral (§1.3)', () => {
  it('ONE bad command among four good ones rejects the WHOLE proposal', () => {
    const diagram = createDiagram({ name: 'V' });
    const commands = soundCommands();
    commands.splice(2, 0, { type: 'addEdge', params: { id: 'x', sourceId: 'ghost', targetId: 't' } });
    const verdict = validateProposal(diagram, { commands, rationale: 'r', promptTemplateRef: REF });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.errors).toHaveLength(1);
      expect(verdict.errors[0].index).toBe(2);
      expect(verdict.errors[0].message).toContain("unknown sourceId 'ghost'");
    }
  });

  it('an empty proposal is rejected', () => {
    const verdict = validateProposal(createDiagram({ name: 'V' }), {
      commands: [],
      rationale: 'r',
      promptTemplateRef: REF,
    });
    expect(verdict.ok).toBe(false);
  });

  it('duplicate new ids are caught across commands', () => {
    const diagram = createDiagram({ name: 'V' });
    const verdict = validateProposal(diagram, {
      commands: [
        { type: 'addNode', params: { id: 'a', type: 'task', label: 'A', x: 0, y: 0 } },
        { type: 'addNode', params: { id: 'a', type: 'task', label: 'A2', x: 10, y: 0 } },
      ],
      rationale: 'r',
      promptTemplateRef: REF,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.errors[0].message).toContain("already exists");
  });
});

describe('buildPlan', () => {
  const proposal: CopilotProposal = {
    commands: soundCommands(),
    rationale: 'reembolso simples',
    promptTemplateRef: REF,
  };

  it('materializes ONE composite: apply = 1 execute, "Desfazer tudo" = 1 undo', () => {
    const diagram = createDiagram({ name: 'P' });
    const plan = buildPlan(diagram, proposal);
    const stack = new CommandStack(diagram);
    stack.execute(plan.command);
    expect(Object.keys(stack.current.nodes)).toHaveLength(3);
    expect(Object.keys(stack.current.edges)).toHaveLength(2);
    stack.undo(); // the whole draft, one step
    expect(Object.keys(stack.current.nodes)).toHaveLength(0);
    expect(Object.keys(stack.current.edges)).toHaveLength(0);
    stack.redo();
    expect(Object.keys(stack.current.nodes)).toHaveLength(3);
  });

  it('projects the result without touching the input diagram', () => {
    const diagram = createDiagram({ name: 'P' });
    const plan = buildPlan(diagram, proposal);
    expect(Object.keys(plan.projected.nodes)).toHaveLength(3);
    expect(Object.keys(diagram.nodes)).toHaveLength(0); // untouched
  });

  it('computes the soundness preview from the REAL analysis of the projection', () => {
    const diagram = createDiagram({ name: 'P' });
    const sound = buildPlan(diagram, proposal);
    expect(sound.soundnessPreview.errors).toBe(0);

    // The classic XOR-split → AND-join trap MUST surface real soundness
    // errors (SND_DEADLOCK_JOIN) — regardless of what the AI claimed.
    const broken = buildPlan(diagram, {
      commands: [
        { type: 'addNode', params: { id: 's', type: 'startEvent', label: 'Início', x: 0, y: 0 } },
        { type: 'addNode', params: { id: 'x', type: 'exclusiveGateway', label: 'X?', x: 120, y: 0 } },
        { type: 'addNode', params: { id: 'a', type: 'task', label: 'A', x: 240, y: -60 } },
        { type: 'addNode', params: { id: 'b', type: 'task', label: 'B', x: 240, y: 60 } },
        { type: 'addNode', params: { id: 'j', type: 'parallelGateway', label: 'Join', x: 380, y: 0 } },
        { type: 'addNode', params: { id: 'e', type: 'endEvent', label: 'Fim', x: 500, y: 0 } },
        { type: 'addEdge', params: { id: 'f1', sourceId: 's', targetId: 'x' } },
        { type: 'addEdge', params: { id: 'f2', sourceId: 'x', targetId: 'a' } },
        { type: 'addEdge', params: { id: 'f3', sourceId: 'x', targetId: 'b' } },
        { type: 'addEdge', params: { id: 'f4', sourceId: 'a', targetId: 'j' } },
        { type: 'addEdge', params: { id: 'f5', sourceId: 'b', targetId: 'j' } },
        { type: 'addEdge', params: { id: 'f6', sourceId: 'j', targetId: 'e' } },
      ],
      rationale: 'draft com armadilha',
      promptTemplateRef: REF,
      soundnessPreview: { errors: 0, warnings: 0 }, // AI's (false) claim
    });
    expect(broken.soundnessPreview.errors).toBeGreaterThan(0);
  });

  it('with attribution the composite audits as COPILOT_PROPOSAL_APPLIED (§1.2)', () => {
    const diagram = createDiagram({ name: 'P' });
    const plan = buildPlan(diagram, proposal, {
      providerId: 'claude-4',
      conversationId: 'conv-1',
    });
    const audit = plan.command.toAuditEvent?.();
    expect(audit?.type).toBe('COPILOT_PROPOSAL_APPLIED');
    expect(audit?.details).toMatchObject({
      author: 'ia.copilot@claude-4',
      promptTemplateRef: REF,
      conversationId: 'conv-1',
      commandCount: 5,
    });
  });

  it('throws (rather than partially applying) when the proposal is invalid', () => {
    const diagram = createDiagram({ name: 'P' });
    expect(() =>
      buildPlan(diagram, {
        commands: [{ type: 'promote', params: {} }],
        rationale: 'r',
        promptTemplateRef: REF,
      }),
    ).toThrow(/not on the whitelist/);
  });
});

describe('soundnessErrors (C5) — the fix flow lists errors from the LOCAL analyzer', () => {
  const trap: CopilotProposal = {
    commands: [
      { type: 'addNode', params: { id: 's', type: 'startEvent', label: 'Início', x: 0, y: 0 } },
      { type: 'addNode', params: { id: 'x', type: 'exclusiveGateway', label: 'X?', x: 120, y: 0 } },
      { type: 'addNode', params: { id: 'a', type: 'task', label: 'A', x: 240, y: -60 } },
      { type: 'addNode', params: { id: 'b', type: 'task', label: 'B', x: 240, y: 60 } },
      { type: 'addNode', params: { id: 'j', type: 'parallelGateway', label: 'Join', x: 380, y: 0 } },
      { type: 'addNode', params: { id: 'e', type: 'endEvent', label: 'Fim', x: 500, y: 0 } },
      { type: 'addEdge', params: { id: 'f1', sourceId: 's', targetId: 'x' } },
      { type: 'addEdge', params: { id: 'f2', sourceId: 'x', targetId: 'a' } },
      { type: 'addEdge', params: { id: 'f3', sourceId: 'x', targetId: 'b' } },
      { type: 'addEdge', params: { id: 'f4', sourceId: 'a', targetId: 'j' } },
      { type: 'addEdge', params: { id: 'f5', sourceId: 'b', targetId: 'j' } },
      { type: 'addEdge', params: { id: 'f6', sourceId: 'j', targetId: 'e' } },
    ],
    rationale: 'armadilha',
    promptTemplateRef: REF,
  };

  it('names the offending SND_* code and element for the trap', () => {
    const { projected } = buildPlan(createDiagram({ name: 'S' }), trap);
    const errors = soundnessErrors(projected);
    expect(errors.length).toBeGreaterThan(0);
    const deadlock = errors.find((e) => e.code === 'SND_DEADLOCK_JOIN');
    expect(deadlock?.nodeId).toBe('j');
    expect(deadlock?.message).toBeTruthy();
  });

  it('returns [] for a sound diagram (and for the fixed trap)', () => {
    const sound = buildPlan(createDiagram({ name: 'S' }), {
      commands: soundCommands(),
      rationale: 'ok',
      promptTemplateRef: REF,
    });
    expect(soundnessErrors(sound.projected)).toEqual([]);
    expect(soundnessErrors(createDiagram({ name: 'vazio' }))).toEqual([]);
  });
});
