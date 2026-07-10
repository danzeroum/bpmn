import {
  createDefaultRegistry,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { DOMAIN_NODE_TYPES } from '@buildtovalue/domain-example';
import { DMN_NODE_TYPES, type DecisionTable } from '@buildtovalue/dmn';
import { HC_NODE_TYPES } from '@buildtovalue/healthcare';

/**
 * The demo credit decision ("First · 4 regras · 2→1"), owned by the DRD
 * diagram and advertised to the BPMN sample through the peek/inspector
 * resolvers in App.tsx — one source of truth for both surfaces.
 */
export const DEMO_DECISION_TABLE: DecisionTable = {
  hitPolicy: 'F',
  inputs: [
    { id: 'in_renda', label: 'Renda mensal', expression: 'renda', typeRef: 'number' },
    { id: 'in_hist', label: 'Histórico', expression: 'historico', typeRef: 'string' },
  ],
  outputs: [{ id: 'out_res', label: 'Resultado', expression: 'resultado', typeRef: 'string' }],
  rules: [
    { id: 'r1', inputEntries: ['>= 8000', '"limpo"'], outputEntries: ['"aprovado"'] },
    {
      id: 'r2',
      inputEntries: ['>= 4000', '"limpo"'],
      outputEntries: ['"análise manual"'],
      annotation: 'mesa de crédito',
    },
    { id: 'r3', inputEntries: ['-', '"negativado"'], outputEntries: ['"negado"'] },
    { id: 'r4', inputEntries: ['-', '-'], outputEntries: ['"negado"'] },
  ],
};

/** Content-production flow using the example domain vocabulary. */
export function buildSampleDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  for (const def of DOMAIN_NODE_TYPES) registry.register(def);

  // Stable id: the autosave/recovery key must survive reloads.
  const diagram = createDiagram({ id: 'demo-content-production', name: 'Content production', createdBy: 'demo' });
  diagram.description = 'Squad produces content, a gate approves, a connector publishes.';
  const v = diagram.version.id;

  const make = (type: string, id: string, label: string, x: number, y: number, properties = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);

  const squad = make('btv:squad', 'squad', 'Content Squad', 60, 160);
  const writer = make('btv:persona', 'writer', 'Writer', 320, 80, { role: 'copywriting' });
  const reviewer = make('btv:persona', 'reviewer', 'Reviewer', 320, 260, { role: 'editorial QA' });
  const prompt = make('btv:prompt', 'prompt', 'Draft article', 540, 70);
  const gate = make('btv:gate', 'gate', 'Editorial gate', 570, 250, { approved: false });
  const publish = make('btv:connector', 'publish', 'CMS publish', 740, 150);
  const deliverable = make('btv:deliverable', 'post', 'Published post', 930, 155);
  // A non-interrupting timer boundary event on the publish step (publish times
  // out without cancelling); rides along when the host is dragged.
  const timeout = make('boundaryEvent', 'publishTimeout', 'Timeout', 812, 192, {
    attachedToRef: 'publish',
    eventDefinition: 'timer',
    cancelActivity: false,
  });
  // Collapsed sub-process (F7-2): the [+] marker expands it in place, the
  // corner arrow drills into it (breadcrumb in the toolbar navigates back).
  // Children hold absolute coordinates inside the container's rect.
  const returns = make('subProcess', 'returns', 'Handle returns', 890, 290);
  returns.width = 340;
  returns.height = 150;
  const inspect = make('userTask', 'returnsInspect', 'Inspect return', 910, 340, {
    parentId: 'returns',
  });
  // Slight vertical offset keeps the inner edge from degenerating into a
  // zero-height line (visible bounding box for tools and tests).
  const refund = make('serviceTask', 'returnsRefund', 'Issue refund', 1080, 350, {
    parentId: 'returns',
  });

  // Call activity (F7-3): invokes the shared billing process by id — the
  // registry resolves which VERSION is in effect when a run starts.
  const billing = make('callActivity', 'billing', 'Billing (shared)', 550, 420, {
    calledElement: 'demo-billing-process',
  });
  // Data store fed by the refund step (dotted data association).
  const returnsDb = make('dataStore', 'returnsDb', 'Returns DB', 1270, 355);
  // Business rule task (Handoff 5 F-A): the gold badge marks the bound DMN
  // decision (visual until F-B2 wires navigation).
  const score = make('businessRuleTask', 'score', 'Score risk', 60, 420, {
    decisionRef: 'demo-decision-risk',
  });

  diagram.nodes = {
    squad,
    writer,
    reviewer,
    prompt,
    gate,
    publish,
    post: deliverable,
    publishTimeout: timeout,
    returns,
    returnsInspect: inspect,
    returnsRefund: refund,
    billing,
    returnsDb,
    score,
  };

  const edge = (
    id: string,
    sourceId: string,
    targetId: string,
    type: string,
    purpose: string,
    label?: string,
  ) => createEdge({ id, sourceId, targetId, type, purpose, label, versionId: v });

  diagram.edges = {
    e1: edge('e1', 'squad', 'writer', 'sequenceFlow', 'Squad staffs the writer'),
    e2: edge('e2', 'squad', 'reviewer', 'sequenceFlow', 'Squad staffs the reviewer'),
    e3: edge('e3', 'writer', 'prompt', 'handoff', 'Writer drafts using the prompt', 'draft'),
    e4: edge('e4', 'prompt', 'gate', 'handoff', 'Draft goes to editorial review', 'review'),
    e5: edge('e5', 'gate', 'reviewer', 'feedback', 'Gate returns change requests to the reviewer'),
    // Fixed orthogonal waypoints so the demo shows the craft-pack rounded
    // corners (the default router is bezier, which has no bends).
    // Supersession chain (Handoff 5 §5 — edge pedigree): the gate→publish
    // handoff was renegotiated twice; e6a/e6b stay closed in the history and
    // the strip renders the whole getEdgeChain when e6 is selected.
    e6a: {
      ...edge('e6a', 'gate', 'publish', 'handoff', 'Publish direto, sem canal definido', 'v1'),
      removedInVersion: v,
    },
    e6b: {
      ...edge('e6b', 'gate', 'publish', 'handoff', 'Publicação apenas no canal piloto', 'v2'),
      supersedesEdgeId: 'e6a',
      removedInVersion: v,
    },
    e6: createEdge({
      id: 'e6',
      sourceId: 'gate',
      targetId: 'publish',
      type: 'handoff',
      purpose: 'Approved content is published',
      label: 'approved',
      versionId: v,
      supersedesEdgeId: 'e6b',
      waypoints: [
        { x: 642, y: 278 },
        { x: 691, y: 278 },
        { x: 691, y: 180 },
        { x: 740, y: 180 },
      ],
    }),
    e7: edge('e7', 'publish', 'post', 'sequenceFlow', 'CMS emits the deliverable'),
    e8: edge('e8', 'publish', 'returns', 'sequenceFlow', 'Returned items enter the returns flow'),
    e9: edge('e9', 'gate', 'billing', 'sequenceFlow', 'Approved work triggers shared billing'),
    // The timeout handler leads somewhere (soundness: SND_BOUNDARY_NO_OUTFLOW).
    e10: edge('e10', 'publishTimeout', 'reviewer', 'feedback', 'Timeout notifies the reviewer'),
    e11: edge('e11', 'squad', 'score', 'sequenceFlow', 'Squad scores the request risk'),
    // Inner flow — same scope (both children of the returns sub-process).
    r1: edge('r1', 'returnsInspect', 'returnsRefund', 'sequenceFlow', 'Approved return is refunded'),
    // Data association: refund step writes to the returns store (may cross
    // the sub-process boundary — data is visible from any scope).
    d1: edge('d1', 'returnsRefund', 'returnsDb', 'dataAssociation', 'Refund recorded'),
  };

  return diagram;
}

/**
 * Synthetic grid for the craft-pack performance NFR (60fps @ ~350 nodes):
 * a mix of shadow-casting activities/cards and flat events/gateways, chained
 * by orthogonal edges with explicit waypoints (rounded corners) and periodic
 * handoffs (purpose chips).
 */
/**
 * F-C1 aceite 10.5.6: with `closedCount` > 0, that many grid nodes are
 * closed (removedInVersion) so the perf canary measures the shared-pattern
 * hatch at scale — 30+ closed elements must hold the fps floor.
 */
export function buildStressDiagram(count = 350, closedCount = 0): BpmnDiagram {
  const registry = createDefaultRegistry();
  for (const def of DOMAIN_NODE_TYPES) registry.register(def);

  const diagram = createDiagram({ id: `demo-stress-${count}`, name: `Stress ${count}`, createdBy: 'perf' });
  diagram.description = `${count}-node synthetic grid for the 60fps NFR.`;
  const v = diagram.version.id;

  const types = [
    'userTask',
    'btv:prompt',
    'task',
    'btv:connector',
    'serviceTask',
    'btv:persona',
    'exclusiveGateway',
    'startEvent',
  ];
  const COLS = 16;
  const STEP_X = 200;
  const STEP_Y = 140;

  const nodes: BpmnDiagram['nodes'] = {};
  const sizes: Record<string, { width: number; height: number }> = {};
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const id = `n${i}`;
    nodes[id] = createNode(
      { type, id, label: `${type} ${i}`, x: 40 + col * STEP_X, y: 40 + row * STEP_Y, properties: {}, versionId: v },
      registry,
    );
    sizes[id] = registry.get(type).defaultSize;
    // Spread the closed elements across the grid (every Nth node) so panning
    // always keeps hatched nodes in the frame.
    if (closedCount > 0 && i % Math.max(1, Math.floor(count / closedCount)) === 0) {
      nodes[id] = { ...nodes[id], removedInVersion: v };
    }
  }
  diagram.nodes = nodes;

  // Hierarchy band (F7-2 canary): a row of EXPANDED sub-processes below the
  // grid, each with 4 children and an inner chain — depth-aware z-ordering
  // and containment filtering are part of the measured frame.
  const subCount = Math.max(2, Math.floor(count / 100));
  const bandY = 40 + Math.ceil(count / COLS) * STEP_Y + 60;
  const edges: BpmnDiagram['edges'] = {};
  for (let s = 0; s < subCount; s++) {
    const spId = `sp${s}`;
    const spX = 40 + s * 580;
    const sp = createNode(
      {
        type: 'subProcess',
        id: spId,
        label: `Sub-process ${s}`,
        x: spX,
        y: bandY,
        properties: { isExpanded: true },
        versionId: v,
      },
      registry,
    );
    sp.width = 540;
    sp.height = 180;
    nodes[spId] = sp;
    for (let c = 0; c < 4; c++) {
      const childId = `sp${s}c${c}`;
      nodes[childId] = createNode(
        {
          type: c % 2 === 0 ? 'userTask' : 'serviceTask',
          id: childId,
          label: `Step ${s}.${c}`,
          x: spX + 20 + c * 128,
          y: bandY + 70,
          properties: { parentId: spId },
          versionId: v,
        },
        registry,
      );
      if (c > 0) {
        const edgeId = `sp${s}e${c}`;
        edges[edgeId] = createEdge({
          id: edgeId,
          sourceId: `sp${s}c${c - 1}`,
          targetId: childId,
          type: 'sequenceFlow',
          purpose: `inner step ${s}.${c}`,
          versionId: v,
        });
      }
    }
  }

  for (let i = 1; i < count; i++) {
    const sourceId = `n${i - 1}`;
    const targetId = `n${i}`;
    const a = nodes[sourceId];
    const b = nodes[targetId];
    const start = { x: a.x + sizes[sourceId].width, y: a.y + sizes[sourceId].height / 2 };
    const end = { x: b.x, y: b.y + sizes[targetId].height / 2 };
    const midX = (start.x + end.x) / 2;
    const handoff = i % 4 === 0;
    edges[`e${i}`] = createEdge({
      id: `e${i}`,
      sourceId,
      targetId,
      type: handoff ? 'handoff' : 'sequenceFlow',
      purpose: handoff ? `handoff ${i}` : `step ${i}`,
      versionId: v,
      waypoints: [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end],
    });
  }
  diagram.edges = edges;

  return diagram;
}

/**
 * The classic soundness trap (Handoff 4 §C): an XOR-split feeding an
 * AND-join — the exclusive gateway routes ONE token, the parallel join waits
 * for BOTH, so the process deadlocks. Loaded via `?deadlock=1`; the
 * promotion e2e asserts SND_DEADLOCK_JOIN blocks activation.
 */
export function buildDeadlockDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-deadlock', name: 'Deadlock trap', createdBy: 'demo' });
  diagram.description = 'XOR-split into AND-join: estruturalmente não-são.';
  const v = diagram.version.id;

  const make = (type: string, id: string, label: string, x: number, y: number) =>
    createNode({ type, id, label, x, y, properties: {}, versionId: v }, registry);

  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 60, 160),
    decide: make('exclusiveGateway', 'decide', 'Aprovado?', 180, 153),
    yes: make('task', 'yes', 'Seguir', 320, 60),
    no: make('task', 'no', 'Revisar', 320, 240),
    join: make('parallelGateway', 'join', 'Sincronizar', 520, 153),
    end: make('endEvent', 'end', 'Fim', 660, 160),
  };

  const edge = (id: string, sourceId: string, targetId: string) =>
    createEdge({ id, sourceId, targetId, type: 'sequenceFlow', versionId: v });
  diagram.edges = {
    f1: edge('f1', 'start', 'decide'),
    f2: edge('f2', 'decide', 'yes'),
    f3: edge('f3', 'decide', 'no'),
    f4: edge('f4', 'yes', 'join'),
    f5: edge('f5', 'no', 'join'),
    f6: edge('f6', 'join', 'end'),
  };

  return diagram;
}

/**
 * A* routing demo (`?astar=1`, Handoff 10 R-2b): the diagram default router is
 * `astar`, so every edge caches an obstacle-avoiding route on load. One edge
 * (e01) threads past an obstacle between its endpoints; a second, unrelated
 * edge (e23) sits far below. The e2e drags an endpoint of e01 and asserts the
 * settled route updates while e23 is never re-routed (zero-recalc).
 */
export function buildAstarDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-astar', name: 'A* routing', createdBy: 'demo' });
  diagram.metadata.router = 'astar';
  const v = diagram.version.id;

  const make = (type: string, id: string, label: string, x: number, y: number) =>
    createNode({ type, id, label, x, y, properties: {}, versionId: v }, registry);

  diagram.nodes = {
    n0: make('task', 'n0', 'Origem', 80, 80),
    obs: make('task', 'obs', 'Obstáculo', 320, 60),
    n1: make('task', 'n1', 'Destino', 560, 80),
    // Unrelated pair, well below the drag zone.
    n2: make('task', 'n2', 'C', 80, 460),
    n3: make('task', 'n3', 'D', 560, 460),
  };

  const edge = (id: string, sourceId: string, targetId: string) =>
    createEdge({ id, sourceId, targetId, type: 'sequenceFlow', versionId: v });
  diagram.edges = {
    e01: edge('e01', 'n0', 'n1'),
    e23: edge('e23', 'n2', 'n3'),
  };

  return diagram;
}

/**
 * Manual-route demo (`?manual=1`, Handoff 10 R-3). A pre-authored manual route
 * `m` (n0→n1 with a bend) and an obstacle `obs` parked directly below n0's
 * exit. The e2e drags n0 down onto `obs`: the manual route must translate
 * rigidly (keeping its bend) and flag ⚠ — never silently re-route (edge case
 * 6). A second, unrelated node checks the §8.3 no-touch guarantee.
 */
export function buildManualRouteDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-manual', name: 'Manual route', createdBy: 'demo' });
  const v = diagram.version.id;

  const make = (type: string, id: string, label: string, x: number, y: number) =>
    createNode({ type, id, label, x, y, properties: {}, versionId: v }, registry);

  diagram.nodes = {
    n0: make('task', 'n0', 'Origem', 80, 60),
    n1: make('task', 'n1', 'Destino', 560, 60),
    // Wide/tall so dragging n0's exit down reliably lands the endpoint inside it.
    obs: make('task', 'obs', 'Obstáculo', 100, 220),
    far: make('task', 'far', 'Longe', 560, 520),
  };
  diagram.nodes.obs.width = 160;
  diagram.nodes.obs.height = 200;

  diagram.edges = {
    m: createEdge({
      id: 'm',
      sourceId: 'n0',
      targetId: 'n1',
      type: 'sequenceFlow',
      versionId: v,
      // Endpoints on the node borders, one authored bend at x=360.
      waypoints: [
        { x: 160, y: 90 },
        { x: 360, y: 90 },
        { x: 560, y: 90 },
      ],
      properties: { routeMode: 'manual' },
    }),
  };

  return diagram;
}

/**
 * No-corridor fallback demo (`?fallback=1`, Handoff 10 R-4 edge case 4): edge
 * `fb` targets a node whose ports are all swallowed by `cage`, so it routes to
 * the honest ⚠ fallback. The e2e drags `cage` away and watches the route heal.
 */
export function buildFallbackDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-fallback', name: 'Fallback', createdBy: 'demo' });
  diagram.metadata.router = 'astar';
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number, w?: number, h?: number) => {
    const node = createNode({ type, id, label, x, y, properties: {}, versionId: v }, registry);
    if (w !== undefined) node.width = w;
    if (h !== undefined) node.height = h;
    return node;
  };
  diagram.nodes = {
    a: make('task', 'a', 'Origem', 0, 200),
    b: make('task', 'b', 'Destino', 320, 200, 40, 40),
    cage: make('task', 'cage', 'Obstáculo', 288, 168, 104, 104),
  };
  diagram.edges = {
    fb: createEdge({ id: 'fb', sourceId: 'a', targetId: 'b', type: 'sequenceFlow', versionId: v }),
  };
  return diagram;
}

/**
 * Gateway fan-out demo (`?fanout=1`, Handoff 10 R-4 edge case 5): a gateway
 * splits to three nearby targets. The e2e checks the sibling routes leave the
 * gateway in distinct 8px lanes ordered by target — no crossing.
 */
export function buildFanoutDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-fanout', name: 'Fan-out', createdBy: 'demo' });
  diagram.metadata.router = 'astar';
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number) =>
    createNode({ type, id, label, x, y, properties: {}, versionId: v }, registry);
  diagram.nodes = {
    g: make('exclusiveGateway', 'g', 'G', 40, 200),
    t1: make('task', 't1', 'T1', 360, 160),
    t2: make('task', 't2', 'T2', 360, 220),
    t3: make('task', 't3', 'T3', 360, 280),
  };
  const edge = (id: string, targetId: string) =>
    createEdge({ id, sourceId: 'g', targetId, type: 'sequenceFlow', versionId: v });
  diagram.edges = { e1: edge('e1', 't1'), e2: edge('e2', 't2'), e3: edge('e3', 't3') };
  return diagram;
}

/**
 * The three-path simulation demo (`?simulate=1`, Handoff 7A): a task with an
 * interrupting 48h timeout boundary, then an XOR (approve / reject). The three
 * structural paths — happy, rejection, timeout — close the coverage checklist
 * 3/3, matching the prototype.
 */
export function buildSimulationDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-simulation', name: 'Onboarding de Cliente', createdBy: 'demo' });
  diagram.description = 'Simulação de tokens: caminho feliz, rejeição e timeout de 48h.';
  const v = diagram.version.id;

  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);

  diagram.nodes = {
    start: make('startEvent', 'start', 'Novo cliente', 60, 150),
    brief: make('task', 'brief', 'Coletar briefing', 160, 125),
    gate: make('exclusiveGateway', 'gate', 'Aprovar briefing', 340, 145),
    plan: make('task', 'plan', 'Gerar plano', 460, 60),
    revise: make('task', 'revise', 'Revisar briefing', 460, 235),
    timeout: make('boundaryEvent', 'timeout', '48h timeout', 240, 175, { attachedToRef: 'brief' }),
    published: make('endEvent', 'published', 'Plano publicado', 640, 70),
    rejected: make('endEvent', 'rejected', 'Rejeitado', 640, 245),
    escalated: make('endEvent', 'escalated', 'Escalation', 300, 300),
  };

  const edge = (id: string, sourceId: string, targetId: string, label?: string) =>
    createEdge({ id, sourceId, targetId, type: 'sequenceFlow', versionId: v, ...(label ? { label } : {}) });
  diagram.edges = {
    s1: edge('s1', 'start', 'brief'),
    s2: edge('s2', 'brief', 'gate'),
    s3: edge('s3', 'gate', 'plan', 'aprovado'),
    s4: edge('s4', 'gate', 'revise', 'rejeitado'),
    s5: edge('s5', 'plan', 'published'),
    s6: edge('s6', 'revise', 'rejected'),
    s7: edge('s7', 'timeout', 'escalated'),
  };

  return diagram;
}

/**
 * A synthetic event log for the replay demo (`?replay=1`, Handoff 7B-2),
 * replayed against {@link buildSimulationDiagram}. Activity names match the
 * node labels; timestamps make "Gerar plano" the bottleneck. Two known
 * deviations reproduce the prototype: cases that skip the gate
 * (Coletar briefing → Gerar plano) and a repeated "Gerar plano".
 */
export function buildReplayTraces() {
  const HOUR = 3_600_000;
  const happy = ['Novo cliente', 'Coletar briefing', 'Aprovar briefing', 'Gerar plano', 'Plano publicado'];
  // Incoming gaps drive the ⌀ chips: briefing 8h, gate 6h, plano 31h (bottleneck), publicado 40s.
  const happyTimes = [0, 8 * HOUR, 14 * HOUR, 45 * HOUR, 45 * HOUR + 40_000];
  const reject = ['Novo cliente', 'Coletar briefing', 'Aprovar briefing', 'Revisar briefing', 'Rejeitado'];
  const skip = ['Novo cliente', 'Coletar briefing', 'Gerar plano', 'Plano publicado']; // skips the gate
  const retry = ['Novo cliente', 'Coletar briefing', 'Aprovar briefing', 'Gerar plano', 'Gerar plano', 'Plano publicado'];

  const traces: { caseId: string; events: { activity: string; timestamp: number }[] }[] = [];
  const push = (prefix: string, n: number, activities: string[], times?: number[]) => {
    for (let i = 0; i < n; i++) {
      traces.push({
        caseId: `${prefix}-${i}`,
        events: activities.map((activity, j) => ({ activity, timestamp: (times?.[j] ?? j * HOUR) })),
      });
    }
  };
  push('ok', 78, happy, happyTimes);
  push('rej', 11, reject);
  push('skip', 8, skip); // deviation: Coletar briefing → Gerar plano
  push('retry', 3, retry); // deviation: Gerar plano → Gerar plano
  return traces;
}

/**
 * A superseded snapshot of the sample (Handoff 5 §5, `?closed=1`): several
 * elements closed in this version, status deprecated — the canvas shows the
 * always-on hatch + desaturation, the hover/selection-gated "FECHADO" seal
 * and the fixed version banner (aceite 10.5.6).
 */
export function buildClosedDiagram(): BpmnDiagram {
  const diagram = buildSampleDiagram();
  diagram.id = 'demo-closed-snapshot';
  diagram.name = 'Content production (superseded)';
  diagram.version = {
    ...diagram.version,
    semanticVersion: '0.2.0',
    status: 'deprecated',
    changeSummary: 'Snapshot deprecado para demonstrar elementos fechados (F-C1).',
  };
  const v = diagram.version.id;
  for (const id of ['writer', 'prompt', 'returns', 'returnsInspect', 'returnsRefund', 'score']) {
    diagram.nodes[id] = { ...diagram.nodes[id], removedInVersion: v };
  }
  for (const id of ['e2', 'e11']) {
    if (diagram.edges[id]) diagram.edges[id] = { ...diagram.edges[id], removedInVersion: v };
  }
  return diagram;
}

/**
 * Clinical pathway demo (Handoff 5 §6, `?hc=1`): the 305° family — a
 * clinical task feeding a decision WITHOUT a linked DMN table (amber ▲
 * chip + HC_DECISION_UNLINKED on Validate), one linked decision, the
 * guideline document and a pathway gate.
 */
export function buildHealthcareDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  for (const def of HC_NODE_TYPES) registry.register(def);
  const diagram = createDiagram({ id: 'demo-hc-sepse', name: 'Protocolo de sepse', createdBy: 'demo' });
  diagram.description = 'Via clínica com decisão DMN vinculada e uma pendente de vínculo.';
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number, properties = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);
  diagram.nodes = {
    triage: make('hc:clinicalTask', 'triage', 'Triagem', 60, 120),
    antibiotic: make('hc:clinicalDecision', 'antibiotic', 'Iniciar antibiótico?', 260, 120),
    dose: make('hc:clinicalDecision', 'dose', 'Escalonar dose?', 260, 260, {
      decisionRef: 'demo-decision-risk',
    }),
    protocol: make('hc:guideline', 'protocol', 'Protocolo 2026', 60, 250),
    route: make('hc:pathwayGate', 'route', 'Via crítica?', 500, 122),
  };
  const flow = (id: string, sourceId: string, targetId: string) =>
    createEdge({ id, sourceId, targetId, type: 'sequenceFlow', versionId: v });
  diagram.edges = {
    h1: flow('h1', 'triage', 'antibiotic'),
    h2: flow('h2', 'antibiotic', 'route'),
    h3: createEdge({ id: 'h3', sourceId: 'protocol', targetId: 'antibiotic', type: 'association', versionId: v }),
  };
  return diagram;
}

/**
 * Minimum viable DRD (Handoff 5 §4.1): the 4 DMN nodes + the 3 requirement
 * edges, family step 185°. Loaded via `?drd=1`.
 */
export function buildDrdDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  for (const def of DMN_NODE_TYPES) registry.register(def);
  const diagram = createDiagram({ id: 'demo-drd-credito', name: 'Decisão de crédito (DRD)', createdBy: 'demo' });
  diagram.description = 'DRD mínimo viável: decisão + dado + autoridade + conhecimento.';
  const v = diagram.version.id;

  const make = (type: string, id: string, label: string, x: number, y: number, properties = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);

  // Same id the sample's businessRuleTask points at (decisionRef): the DRD
  // diagram IS the decision's own editing surface (F-B2).
  diagram.nodes = {
    'demo-decision-risk': make('dmn:decision', 'demo-decision-risk', 'Aprovar crédito?', 340, 80, {
      decisionTable: DEMO_DECISION_TABLE,
    }),
    income: make('dmn:inputData', 'income', 'Renda mensal', 100, 260),
    history: make('dmn:inputData', 'history', 'Histórico', 320, 300),
    policy: make('dmn:knowledgeSource', 'policy', 'Política de crédito', 620, 240),
    scorecard: make('dmn:businessKnowledgeModel', 'scorecard', 'Scorecard', 560, 100),
  };

  const req = (id: string, sourceId: string, targetId: string, type: string) =>
    createEdge({ id, sourceId, targetId, type, versionId: v });
  diagram.edges = {
    r1: req('r1', 'income', 'demo-decision-risk', 'dmn:informationRequirement'),
    r2: req('r2', 'history', 'demo-decision-risk', 'dmn:informationRequirement'),
    r3: req('r3', 'scorecard', 'demo-decision-risk', 'dmn:knowledgeRequirement'),
    r4: req('r4', 'policy', 'demo-decision-risk', 'dmn:authorityRequirement'),
  };
  return diagram;
}
