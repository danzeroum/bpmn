import { describe, expect, it } from 'vitest';
import {
  addNodeCommand,
  CommandStack,
  createDefaultRuleEngine,
  createDiagram,
  createNode,
  RuleEngine,
  type ConnectPayload,
} from '../src/index.js';

describe('RuleEngine', () => {
  it('returns the first negative verdict', () => {
    const engine = new RuleEngine();
    const diagram = createDiagram({ name: 'T' });
    engine.register('x', () => ({ allowed: true }));
    engine.register('x', () => ({ allowed: false, reason: 'nope' }));
    engine.register('x', () => ({ allowed: false, reason: 'later' }));
    expect(engine.evaluate('x', {}, diagram)).toEqual({ allowed: false, reason: 'nope' });
  });

  it('allows when no rules match', () => {
    const engine = new RuleEngine();
    expect(engine.evaluate('unknown', {}, createDiagram({ name: 'T' }))).toEqual({
      allowed: true,
    });
  });

  it('unregisters rules', () => {
    const engine = new RuleEngine();
    const diagram = createDiagram({ name: 'T' });
    const off = engine.register('x', () => ({ allowed: false }));
    off();
    expect(engine.evaluate('x', {}, diagram).allowed).toBe(true);
  });
});

describe('default rules', () => {
  it('locks active/deprecated/retired diagrams against commands', () => {
    const engine = createDefaultRuleEngine();
    for (const status of ['active', 'deprecated', 'retired'] as const) {
      const diagram = createDiagram({ name: 'T' });
      diagram.version.status = status;
      const stack = new CommandStack(diagram, { interceptor: engine });
      const verdict = stack.execute(addNodeCommand(createNode({ type: 'task' })));
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toMatch(/immutable/);
    }
  });

  it('allows commands on draft/test/candidate diagrams', () => {
    const engine = createDefaultRuleEngine();
    for (const status of ['draft', 'test', 'candidate'] as const) {
      const diagram = createDiagram({ name: 'T' });
      diagram.version.status = status;
      const stack = new CommandStack(diagram, { interceptor: engine });
      expect(stack.execute(addNodeCommand(createNode({ type: 'task' }))).allowed).toBe(true);
    }
  });

  it('blocks self-connections via edge.connect.pre', () => {
    const engine = createDefaultRuleEngine();
    const diagram = createDiagram({ name: 'T' });
    const verdict = engine.evaluate<ConnectPayload>(
      'edge.connect.pre',
      { sourceId: 'a', targetId: 'a' },
      diagram,
    );
    expect(verdict.allowed).toBe(false);
    expect(
      engine.evaluate<ConnectPayload>('edge.connect.pre', { sourceId: 'a', targetId: 'b' }, diagram)
        .allowed,
    ).toBe(true);
  });
});
