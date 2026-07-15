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
});
