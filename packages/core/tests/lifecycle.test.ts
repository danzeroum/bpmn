import { describe, expect, it } from 'vitest';
import {
  BpmnLifecycleError,
  bumpSemver,
  computeDiagramHash,
  createDiagram,
  createNode,
  LifecycleEngine,
  type BpmnDiagram,
  type UserContext,
  type VersionStatus,
} from '../src/index.js';

const owner: UserContext = { id: 'u-owner', role: 'owner' };
const compliance: UserContext = { id: 'u-comp', role: 'compliance' };
const ops: UserContext = { id: 'u-ops', role: 'operations' };

function diagramIn(status: VersionStatus): BpmnDiagram {
  const diagram = createDiagram({ name: 'Flow' });
  diagram.version.status = status;
  diagram.version.changeSummary = 'A change summary long enough for promotion.';
  return diagram;
}

describe('bumpSemver', () => {
  it('bumps each part', () => {
    expect(bumpSemver('1.2.3', 'major')).toBe('2.0.0');
    expect(bumpSemver('1.2.3', 'minor')).toBe('1.3.0');
    expect(bumpSemver('1.2.3', 'patch')).toBe('1.2.4');
    expect(bumpSemver('garbage', 'patch')).toBe('0.0.1');
  });
});

describe('LifecycleEngine transitions', () => {
  const engine = new LifecycleEngine();

  it('exposes the default transition matrix', () => {
    expect(engine.canTransition('draft', 'test')).toBe(true);
    expect(engine.canTransition('test', 'candidate')).toBe(true);
    expect(engine.canTransition('test', 'draft')).toBe(true);
    expect(engine.canTransition('candidate', 'active')).toBe(true);
    expect(engine.canTransition('candidate', 'test')).toBe(true);
    expect(engine.canTransition('active', 'deprecated')).toBe(true);
    expect(engine.canTransition('deprecated', 'retired')).toBe(true);
  });

  it('rejects invalid transitions, including deprecated → active reactivation', () => {
    expect(engine.canTransition('draft', 'active')).toBe(false);
    expect(engine.canTransition('deprecated', 'active')).toBe(false);
    expect(engine.canTransition('retired', 'draft')).toBe(false);
    expect(engine.allowedTargets('retired')).toEqual([]);
  });

  it('echoes the required approval roles from the config (default 2)', () => {
    expect(engine.requiredApprovalRoles).toBe(2);
    expect(new LifecycleEngine({ minApprovalRoles: 3 }).requiredApprovalRoles).toBe(3);
  });

  it('throws BpmnLifecycleError on invalid promote', async () => {
    await expect(
      engine.promote({ diagram: diagramIn('draft'), target: 'active', actor: owner, reason: 'x' }),
    ).rejects.toThrow(BpmnLifecycleError);
  });

  it('promotes through the happy path and chains versions', async () => {
    let diagram = diagramIn('draft');
    const draftVersionId = diagram.version.id;
    diagram = await engine.promote({
      diagram,
      target: 'test',
      actor: owner,
      reason: 'Ready for sandbox testing by the team.',
    });
    expect(diagram.version.status).toBe('test');
    expect(diagram.version.parentVersionId).toBe(draftVersionId);
    expect(diagram.version.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('evaluateGates (promotion introspection)', () => {
  const engine = new LifecycleEngine();

  it('reports an unsatisfied transition gate whose detail equals the promote error', async () => {
    const input = { diagram: diagramIn('draft'), target: 'active' as const, actor: owner, reason: 'x' };
    const gates = await engine.evaluateGates(input);
    const transition = gates.find((g) => g.id === 'transition')!;
    expect(transition.satisfied).toBe(false);
    await expect(engine.promote(input)).rejects.toThrow(transition.detail);
  });

  it('exposes required/current on the approvals gate', async () => {
    let diagram = diagramIn('candidate');
    const input = () => ({ diagram, target: 'active' as const, actor: owner, reason: 'x' });
    let gates = await engine.evaluateGates(input());
    let approvals = gates.find((g) => g.id === 'approvals')!;
    expect(approvals).toMatchObject({ satisfied: false, required: 2, current: 0 });
    await expect(engine.promote(input())).rejects.toThrow(approvals.detail);

    diagram = engine.approve(diagram, owner, 'ok');
    diagram = engine.approve(diagram, compliance, 'ok');
    gates = await engine.evaluateGates(input());
    approvals = gates.find((g) => g.id === 'approvals')!;
    expect(approvals).toMatchObject({ satisfied: true, required: 2, current: 2 });
  });

  it('gates on the change summary with the exact promote message', async () => {
    let diagram = diagramIn('candidate');
    diagram.version.changeSummary = 'too short';
    diagram = engine.approve(diagram, owner, 'ok');
    diagram = engine.approve(diagram, compliance, 'ok');
    const input = { diagram, target: 'active' as const, actor: owner, reason: '' };
    const gates = await engine.evaluateGates(input);
    const summary = gates.find((g) => g.id === 'change-summary')!;
    expect(summary.satisfied).toBe(false);
    await expect(engine.promote(input)).rejects.toThrow(summary.detail);
  });

  it('adds a diff gate only when the config requires it', async () => {
    const strict = new LifecycleEngine({ requireDiff: true });
    let diagram = diagramIn('candidate');
    diagram = strict.approve(diagram, owner, 'ok');
    diagram = strict.approve(diagram, compliance, 'ok');
    const noDiff = { diagram, target: 'active' as const, actor: owner, reason: '' };
    const gates = await strict.evaluateGates(noDiff);
    const diffGate = gates.find((g) => g.id === 'diff')!;
    expect(diffGate.satisfied).toBe(false);
    await expect(strict.promote(noDiff)).rejects.toThrow(diffGate.detail);
    // Default engine has no diff gate at all.
    const defaultGates = await engine.evaluateGates(noDiff);
    expect(defaultGates.some((g) => g.id === 'diff')).toBe(false);
  });

  it('maps promotionRules onto rule gates carrying the veto reason', async () => {
    const vetoing = new LifecycleEngine({
      promotionRules: [() => ({ allowed: false, reason: 'frozen by change window' })],
    });
    let diagram = diagramIn('candidate');
    diagram = vetoing.approve(diagram, owner, 'ok');
    diagram = vetoing.approve(diagram, compliance, 'ok');
    const input = { diagram, target: 'active' as const, actor: owner, reason: '' };
    const gates = await vetoing.evaluateGates(input);
    const rule = gates.find((g) => g.id === 'rule:0')!;
    expect(rule.satisfied).toBe(false);
    expect(rule.detail).toBe('frozen by change window');
    await expect(vetoing.promote(input)).rejects.toThrow('frozen by change window');
  });

  it('returns all gates satisfied on a promotable candidate', async () => {
    let diagram = diagramIn('candidate');
    diagram = engine.approve(diagram, owner, 'ok');
    diagram = engine.approve(diagram, ops, 'ok');
    const gates = await engine.evaluateGates({ diagram, target: 'active', actor: owner, reason: '' });
    expect(gates.every((g) => g.satisfied)).toBe(true);
  });
});

describe('promotion to active', () => {
  const engine = new LifecycleEngine();

  it('requires approvals from 2 distinct roles', async () => {
    let diagram = diagramIn('candidate');
    await expect(
      engine.promote({ diagram, target: 'active', actor: owner, reason: 'r' }),
    ).rejects.toThrow(/distinct roles/);

    diagram = engine.approve(diagram, owner, 'lgtm');
    await expect(
      engine.promote({ diagram, target: 'active', actor: owner, reason: 'r' }),
    ).rejects.toThrow(/distinct roles/);

    diagram = engine.approve(diagram, compliance, 'compliant');
    const promoted = await engine.promote({
      diagram,
      target: 'active',
      actor: ops,
      reason: 'Approved by owner and compliance for production.',
    });
    expect(promoted.version.status).toBe('active');
    expect(promoted.version.effectiveFrom).toBeDefined();
  });

  it('two approvals from the same role do not count as distinct', async () => {
    let diagram = diagramIn('candidate');
    diagram = engine.approve(diagram, owner, 'a');
    diagram = engine.approve(diagram, { id: 'u-owner-2', role: 'owner' }, 'b');
    await expect(
      engine.promote({ diagram, target: 'active', actor: ops, reason: 'r' }),
    ).rejects.toThrow(/distinct roles/);
  });

  it('rejects duplicate approval by the same user', () => {
    let diagram = diagramIn('candidate');
    diagram = engine.approve(diagram, owner, 'a');
    expect(() => engine.approve(diagram, owner, 'again')).toThrow(BpmnLifecycleError);
  });

  it('requires a changelog of minimum length', async () => {
    let diagram = diagramIn('candidate');
    diagram.version.changeSummary = 'short';
    diagram = engine.approve(diagram, owner, 'a');
    diagram = engine.approve(diagram, compliance, 'b');
    await expect(
      engine.promote({ diagram, target: 'active', actor: ops, reason: '' }),
    ).rejects.toThrow(/change summary/);
  });

  it('requires a diff when configured', async () => {
    const strict = new LifecycleEngine({ requireDiff: true });
    let diagram = diagramIn('candidate');
    diagram = strict.approve(diagram, owner, 'a');
    diagram = strict.approve(diagram, compliance, 'b');
    await expect(
      strict.promote({ diagram, target: 'active', actor: ops, reason: 'good enough summary here' }),
    ).rejects.toThrow(/diff/);
    const promoted = await strict.promote({
      diagram,
      target: 'active',
      actor: ops,
      reason: 'good enough summary here',
      diff: { nodes: [], edges: [], metadata: {} },
    });
    expect(promoted.version.status).toBe('active');
  });

  it('runs custom promotion rules', async () => {
    const engine2 = new LifecycleEngine({
      promotionRules: [
        ({ target }) =>
          target === 'test'
            ? { allowed: false, reason: 'sandbox is frozen' }
            : { allowed: true },
      ],
    });
    await expect(
      engine2.promote({ diagram: diagramIn('draft'), target: 'test', actor: owner, reason: 'r' }),
    ).rejects.toThrow(/sandbox is frozen/);
  });

  it('supports a fully custom transition table', () => {
    const custom = new LifecycleEngine({
      transitions: {
        draft: ['active'],
        test: [],
        candidate: [],
        active: [],
        deprecated: [],
        retired: [],
      },
    });
    expect(custom.canTransition('draft', 'active')).toBe(true);
    expect(custom.canTransition('draft', 'test')).toBe(false);
  });
});

describe('createDraftFrom', () => {
  it('clones an active diagram into a chained draft with a bumped version', async () => {
    const engine = new LifecycleEngine();
    const active = diagramIn('active');
    active.version.semanticVersion = '1.4.2';
    const node = createNode({ type: 'task' });
    active.nodes[node.id] = node;

    const draft = await engine.createDraftFrom(active, owner);
    expect(draft.version.status).toBe('draft');
    expect(draft.version.semanticVersion).toBe('1.5.0');
    expect(draft.version.parentVersionId).toBe(active.version.id);
    expect(draft.version.approvedBy).toEqual([]);
    expect(draft.nodes[node.id]).toBeDefined();
    // Content is shared structurally but the containers are new
    expect(draft.nodes).not.toBe(active.nodes);
  });
});

describe('computeDiagramHash', () => {
  it('is stable and ignores audit trails', async () => {
    const diagram = createDiagram({ name: 'T', id: 'fixed' });
    const node = createNode({ type: 'task', id: 'n1' });
    diagram.nodes[node.id] = node;
    const h1 = await computeDiagramHash(diagram);
    const withAudit = {
      ...diagram,
      nodes: {
        n1: {
          ...node,
          audit: {
            ...node.audit,
            history: [
              { type: 'X', timestamp: 'now', userId: 'u', versionId: 'v' },
            ],
          },
        },
      },
    };
    expect(await computeDiagramHash(withAudit)).toBe(h1);
    const moved = { ...diagram, nodes: { n1: { ...node, x: 10 } } };
    expect(await computeDiagramHash(moved)).not.toBe(h1);
  });
});
