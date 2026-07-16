import { describe, expect, it } from 'vitest';
import {
  activeEdges,
  createDiagram,
  createEdge,
  createNode,
  isFlowEdge,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { fixCommandFor, lintFindings, LINT_PROFILES } from '../src/index.js';

function base(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Fixes' });
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Go', x: 0, y: 0 }),
    a: createNode({ id: 'a', type: 'task', label: 'Work', x: 200, y: 0 }),
    end: createNode({ id: 'end', type: 'endEvent', label: 'Done', x: 400, y: 0 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'a' }),
    e2: createEdge({ id: 'e2', sourceId: 'a', targetId: 'end' }),
  };
  return diagram;
}

describe('lintFindings (Handoff 14 §1d)', () => {
  it('annotates every issue with rule, profile, source and fixability', () => {
    const diagram = base();
    diagram.edges.dup = createEdge({ id: 'dup', sourceId: 'start', targetId: 'a' });
    diagram.nodes.svc = createNode({ id: 'svc', type: 'serviceTask', label: 'Call', x: 600, y: 0 });
    const findings = lintFindings(diagram);

    const dup = findings.find((f) => f.code === 'LINT_DUPLICATE_FLOW')!;
    expect(dup.ruleId).toBe('duplicate-flow');
    expect(dup.profileId).toBe('lint-etiquette');
    expect(dup.source).toBe('etiquette');
    expect(dup.fixable).toBe(true);

    const exec = findings.find((f) => f.code === 'EXEC_MISSING_IMPLEMENTATION')!;
    expect(exec.source).toBe('executability');
    expect(exec.profileId).toBe('lint-engine');
    expect(exec.fixable).toBe(false);
  });

  it('profiles carry the versioned identity the Biblioteca lists', () => {
    expect(LINT_PROFILES.map((p) => `${p.id}@${p.version}`)).toEqual([
      'lint-etiquette@1.0.0',
      'lint-engine@1.0.0',
    ]);
  });
});

describe('quick-fix contract fix(ctx) → command', () => {
  it('duplicate-flow: removes the duplicate edge; undo restores it', () => {
    const diagram = base();
    diagram.edges.dup = createEdge({ id: 'dup', sourceId: 'start', targetId: 'a' });
    const finding = lintFindings(diagram).find((f) => f.code === 'LINT_DUPLICATE_FLOW')!;
    const command = fixCommandFor(diagram, finding)!;
    const fixed = command.execute(diagram);
    expect(fixed.edges.dup).toBeUndefined();
    expect(lintFindings(fixed).filter((f) => f.code === 'LINT_DUPLICATE_FLOW')).toEqual([]);
    const restored = command.undo(fixed);
    expect(restored.edges.dup).toBeDefined();
  });

  it('superfluous-gateway: ONE composite removes the gateway and reconnects the path', () => {
    const diagram = base();
    diagram.nodes.g = createNode({ id: 'g', type: 'exclusiveGateway', label: 'G', x: 300, y: 0 });
    diagram.edges.e2 = createEdge({ id: 'e2', sourceId: 'a', targetId: 'g' });
    diagram.edges.e3 = createEdge({ id: 'e3', sourceId: 'g', targetId: 'end' });
    const finding = lintFindings(diagram).find((f) => f.code === 'LINT_SUPERFLUOUS_GATEWAY')!;
    const command = fixCommandFor(diagram, finding)!;

    const fixed = command.execute(diagram);
    expect(fixed.nodes.g).toBeUndefined();
    const reconnect = activeEdges(fixed).filter(
      (e) => isFlowEdge(e) && e.sourceId === 'a' && e.targetId === 'end',
    );
    expect(reconnect).toHaveLength(1);

    // Single undo restores the gateway AND its original flows whole.
    const restored = command.undo(fixed);
    expect(restored.nodes.g).toBeDefined();
    expect(restored.edges.e2.targetId).toBe('g');
    expect(restored.edges.e3.sourceId).toBe('g');
    expect(activeEdges(restored)).toHaveLength(activeEdges(diagram).length);
  });

  it('event-endpoints: removes the offending flow into a start event', () => {
    const diagram = base();
    diagram.edges.back = createEdge({ id: 'back', sourceId: 'a', targetId: 'start' });
    const finding = lintFindings(diagram).find((f) => f.code === 'LINT_START_WITH_INCOMING')!;
    expect(finding.fixable).toBe(true);
    const fixed = fixCommandFor(diagram, finding)!.execute(diagram);
    expect(fixed.edges.back).toBeUndefined();
    expect(fixed.edges.e1).toBeDefined(); // the legitimate outgoing flow stays
  });

  it('rules without a mechanical fix return null (→ copilot C5 route)', () => {
    const diagram = base();
    diagram.nodes.a = { ...diagram.nodes.a, label: '' };
    const finding = lintFindings(diagram).find((f) => f.code === 'LINT_LABEL_REQUIRED')!;
    expect(finding.fixable).toBe(false);
    expect(fixCommandFor(diagram, finding)).toBeNull();
  });

  it('a STALE duplicate-flow finding (edge already gone) yields no command', () => {
    const diagram = base();
    diagram.edges.dup = createEdge({ id: 'dup', sourceId: 'start', targetId: 'a' });
    const finding = lintFindings(diagram).find((f) => f.code === 'LINT_DUPLICATE_FLOW')!;
    const { dup: _gone, ...edges } = diagram.edges;
    const changed = { ...diagram, edges };
    expect(fixCommandFor(changed, finding)).toBeNull();
  });

  it('an ISOLATED superfluous gateway is removed without a reconnect (single command)', () => {
    const diagram = base();
    diagram.nodes.g = createNode({ id: 'g', type: 'exclusiveGateway', label: 'G', x: 300, y: 200 });
    const finding = lintFindings(diagram).find((f) => f.code === 'LINT_SUPERFLUOUS_GATEWAY')!;
    const fixed = fixCommandFor(diagram, finding)!.execute(diagram);
    expect(fixed.nodes.g).toBeUndefined();
    // No neighbours → no reconnect flow was invented.
    expect(activeEdges(fixed)).toHaveLength(activeEdges(diagram).length);
  });

  it('event-endpoints with SEVERAL offending flows folds them into ONE composite', () => {
    const diagram = base();
    diagram.edges.back1 = createEdge({ id: 'back1', sourceId: 'a', targetId: 'start' });
    diagram.edges.back2 = createEdge({ id: 'back2', sourceId: 'end', targetId: 'start' });
    const finding = lintFindings(diagram).find((f) => f.code === 'LINT_START_WITH_INCOMING')!;
    const command = fixCommandFor(diagram, finding)!;
    const fixed = command.execute(diagram);
    expect(fixed.edges.back1).toBeUndefined();
    expect(fixed.edges.back2).toBeUndefined();
    // ONE undo restores both offending flows — it was a single composite.
    const restored = command.undo(fixed);
    expect(restored.edges.back1).toBeDefined();
    expect(restored.edges.back2).toBeDefined();
  });

  it('fixCommandFor with an unknown profile/rule provenance returns null', () => {
    const diagram = base();
    diagram.edges.dup = createEdge({ id: 'dup', sourceId: 'start', targetId: 'a' });
    const finding = lintFindings(diagram).find((f) => f.code === 'LINT_DUPLICATE_FLOW')!;
    expect(fixCommandFor(diagram, { ...finding, profileId: 'ghost' })).toBeNull();
    expect(fixCommandFor(diagram, { ...finding, ruleId: 'ghost' })).toBeNull();
  });
});
