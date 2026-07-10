import { describe, expect, it } from 'vitest';
import {
  agentAutonomyGateRule,
  agentGateViolations,
  BpmnXmlConverter,
  BUILT_IN_NODE_TYPES,
  createDiagram,
  createEdge,
  createNode,
  LifecycleEngine,
  NodeTypeRegistry,
  normalizeForDiff,
  resolveAgentWorkflow,
  type BpmnDiagram,
  type BpmnNode,
  type UserContext,
} from '../src/index.js';

const owner: UserContext = { id: 'u-owner', role: 'owner' };

/** The canonical id@semver ref (A-1 decision). */
const REF = 'agnt-rsch@2.1.0';
const SNAPSHOT_JSON = JSON.stringify({
  kind: 'AgentWorkflow',
  id: 'agnt-rsch',
  version: '2.1.0',
  name: 'Research Agent <"escaped" & special>',
  autonomyLevel: 2,
});

function agentTaskNode(overrides: Partial<BpmnNode['properties']> = {}): BpmnNode {
  return createNode({
    type: 'agentTask',
    id: 'Activity_1',
    label: 'Pesquisar fontes',
    x: 200,
    y: 100,
    properties: {
      agentWorkflowRef: REF,
      autonomyLevel: 2,
      inputMapping: { query: 'processVariable.customerRequest' },
      outputMapping: { answer: 'processVariable.researchResult' },
      ...overrides,
    },
  });
}

function diagramWith(node: BpmnNode, extra?: (d: BpmnDiagram) => void): BpmnDiagram {
  const diagram = createDiagram({ name: 'Agent flow', id: 'agent-flow' });
  diagram.version.changeSummary = 'Agent task modelling for the research flow.';
  const start = createNode({ type: 'startEvent', id: 'start', x: 80, y: 100 });
  const done = createNode({ type: 'endEvent', id: 'done', x: 420, y: 100 });
  diagram.nodes = { start, [node.id]: node, done };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: node.id }),
    e2: createEdge({ id: 'e2', sourceId: node.id, targetId: 'done' }),
  };
  extra?.(diagram);
  return diagram;
}

describe('agentTask converter round-trip (§9.3)', () => {
  it('round-trips the agentTask type + fields byte-stably', () => {
    const diagram = diagramWith(agentTaskNode());
    const xml = new BpmnXmlConverter().toXml(diagram);
    // maps onto the standard task tag, identity carried in the meta
    expect(xml).toContain('<bpmn:task id="Activity_1"');
    expect(xml).toContain('type="agentTask"');
    expect(xml).toContain('agentWorkflowRef');

    const first = new BpmnXmlConverter().fromXml(xml);
    expect(first.diagram.nodes.Activity_1.type).toBe('agentTask');
    const reExport = new BpmnXmlConverter().toXml(first.diagram);
    const second = new BpmnXmlConverter().fromXml(reExport);
    expect(normalizeForDiff(second.diagram)).toEqual(normalizeForDiff(first.diagram));
    expect(new BpmnXmlConverter().toXml(second.diagram)).toBe(reExport); // byte-stable
  });

  it('round-trips an embedded snapshot byte-stably (dedicated element)', () => {
    const diagram = diagramWith(agentTaskNode({ agentWorkflowSnapshot: SNAPSHOT_JSON }));
    const xml = new BpmnXmlConverter().toXml(diagram);
    expect(xml).toContain('agentWorkflowSnapshot');

    const first = new BpmnXmlConverter().fromXml(xml);
    expect(first.diagram.nodes.Activity_1.properties.agentWorkflowSnapshot).toBe(SNAPSHOT_JSON);
    const reExport = new BpmnXmlConverter().toXml(first.diagram);
    expect(new BpmnXmlConverter().toXml(new BpmnXmlConverter().fromXml(reExport).diagram)).toBe(reExport);
  });

  it('degrades in an editor without the agentTask type — reads as a plain task', () => {
    const xml = new BpmnXmlConverter().toXml(diagramWith(agentTaskNode({ agentWorkflowSnapshot: SNAPSHOT_JSON })));
    // a registry that never learned about agentTask (an external/older reader)
    const external = new NodeTypeRegistry();
    for (const def of BUILT_IN_NODE_TYPES) if (def.type !== 'agentTask') external.register(def);
    const parsed = new BpmnXmlConverter({ registry: external }).fromXml(xml);
    expect(parsed.diagram.nodes.Activity_1.type).toBe('task'); // graceful degradation
  });
});

describe('resolveAgentWorkflow — snapshot fallback (§1.1)', () => {
  const node = agentTaskNode({ agentWorkflowSnapshot: SNAPSHOT_JSON });

  it('prefers the registry (the source of truth)', () => {
    const res = resolveAgentWorkflow(node, (ref) => (ref === REF ? { fromRegistry: true } : undefined));
    expect(res.source).toBe('registry');
    expect(res.warning).toBeUndefined();
  });

  it('falls back to the snapshot with a warning when the registry does not resolve', () => {
    const res = resolveAgentWorkflow(node, () => undefined);
    expect(res.source).toBe('snapshot');
    expect(res.warning).toMatch(/registry unavailable/);
    expect((res.workflow as { id: string }).id).toBe('agnt-rsch');
  });

  it('is unresolved when neither registry nor snapshot is available', () => {
    const bare = agentTaskNode(); // no snapshot
    expect(resolveAgentWorkflow(bare, () => undefined).source).toBe('unresolved');
  });

  it('treats a corrupt snapshot as unresolved (never guesses)', () => {
    const corrupt = agentTaskNode({ agentWorkflowSnapshot: '{not json' });
    expect(resolveAgentWorkflow(corrupt, () => undefined).source).toBe('unresolved');
  });

  it('emits the Portuguese warning when asked', () => {
    const res = resolveAgentWorkflow(agentTaskNode({ agentWorkflowSnapshot: SNAPSHOT_JSON }), () => undefined, 'pt');
    expect(res.warning).toMatch(/registry indisponível/);
  });
});

describe('autonomy→gate promotion rule (§4)', () => {
  const isGate = (n: BpmnNode) => n.type === 'btv:gate';
  const requiresGate = (level: number) => level <= 3; // agentflow's requiresDownstreamGate

  it('level ≤3 without a reachable downstream gate is a violation with remediation', () => {
    const violations = agentGateViolations(diagramWith(agentTaskNode({ autonomyLevel: 2 })), {
      requiresGate,
      isGate,
    });
    expect(violations).toHaveLength(1);
    expect(violations[0].nodeId).toBe('Activity_1');
    expect(violations[0].remediation).toMatch(/Add a btv:gate downstream|raise its autonomyLevel/);
  });

  it('no violation when a btv:gate is reachable downstream', () => {
    // btv:gate is a domain type (not in the core registry), so build it raw.
    const gate: BpmnNode = {
      id: 'gate',
      type: 'btv:gate',
      label: 'Approval Gate',
      x: 320,
      y: 100,
      width: 50,
      height: 50,
      properties: {},
      createdInVersion: '0',
      audit: { createdAt: '2026-07-10T00:00:00.000Z', createdBy: 'test', history: [] },
    };
    const diagram = diagramWith(agentTaskNode({ autonomyLevel: 2 }), (d) => {
      d.nodes.gate = gate;
      d.edges.e2 = createEdge({ id: 'e2', sourceId: 'Activity_1', targetId: 'gate' });
      d.edges.e3 = createEdge({ id: 'e3', sourceId: 'gate', targetId: 'done' });
    });
    expect(agentGateViolations(diagram, { requiresGate, isGate })).toEqual([]);
  });

  it('level 4 (Multi-Agent) needs no gate — no violation', () => {
    const violations = agentGateViolations(diagramWith(agentTaskNode({ autonomyLevel: 4 })), {
      requiresGate,
      isGate,
    });
    expect(violations).toEqual([]);
  });

  it('skips an agentTask with a non-numeric autonomyLevel (not this rule)', () => {
    const node = agentTaskNode();
    delete node.properties.autonomyLevel;
    expect(agentGateViolations(diagramWith(node), { requiresGate, isGate })).toEqual([]);
  });

  it('reachability terminates on a cyclic process (no gate present)', () => {
    const diagram = diagramWith(agentTaskNode({ autonomyLevel: 2 }), (d) => {
      // a back-edge from done to the agentTask makes the flow cyclic
      d.edges.loop = createEdge({ id: 'loop', sourceId: 'done', targetId: 'Activity_1' });
    });
    expect(agentGateViolations(diagram, { requiresGate, isGate })).toHaveLength(1);
  });

  it('blocks promotion to active through evaluateGates', async () => {
    const engine = new LifecycleEngine({ promotionRules: [agentAutonomyGateRule({ requiresGate, isGate })] });
    const diagram = diagramWith(agentTaskNode({ autonomyLevel: 2 }));
    diagram.version.status = 'candidate';
    const gates = await engine.evaluateGates({ diagram, target: 'active', actor: owner, reason: 'go live' });
    const ruleGate = gates.find((g) => !g.satisfied && /btv:gate/.test(g.detail));
    expect(ruleGate).toBeDefined();
    expect(ruleGate!.detail).toMatch(/downstream/);
  });
});
