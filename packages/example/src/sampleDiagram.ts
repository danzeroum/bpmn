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
 * S-FEEL decision demo (`?sfeel=1`, Handoff 9 SF-2): start → businessRuleTask
 * carrying a decision table (amount < 100 → "auto", >= 100 → "manual") →
 * labeled flows to two tasks. With `bad=1` the first cell is `date(...)` —
 * outside the subset — so the simulator stops with the honest ⚠ warning.
 */
export function buildSfeelDiagram(bad = false): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-sfeel', name: 'Decisão S-FEEL', createdBy: 'demo' });
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);

  const decisionTable = {
    hitPolicy: 'U',
    inputs: [{ id: 'i1', label: 'Valor', expression: 'amount', typeRef: 'number' }],
    outputs: [{ id: 'o1', label: 'Rota', expression: 'route', typeRef: 'string' }],
    rules: [
      { id: 'r1', inputEntries: [bad ? 'date("2026-01-01") > x' : '< 100'], outputEntries: ['"auto"'] },
      { id: 'r2', inputEntries: ['>= 100'], outputEntries: ['"manual"'] },
    ],
  };

  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 40, 120),
    brt: make('businessRuleTask', 'brt', 'Aprovar reembolso?', 160, 100, { decisionTable }),
    auto: make('task', 'auto', 'Reembolso automático', 380, 20),
    manual: make('task', 'manual', 'Análise manual', 380, 180),
    end1: make('endEvent', 'end1', 'Fim', 600, 40),
    end2: make('endEvent', 'end2', 'Fim', 600, 200),
  };
  const edge = (id: string, sourceId: string, targetId: string, label?: string) =>
    createEdge({ id, sourceId, targetId, type: 'sequenceFlow', versionId: v, ...(label ? { label } : {}) });
  diagram.edges = {
    s1: edge('s1', 'start', 'brt'),
    eAuto: edge('eAuto', 'brt', 'auto', 'auto'),
    eManual: edge('eManual', 'brt', 'manual', 'manual'),
    f1: edge('f1', 'auto', 'end1'),
    f2: edge('f2', 'manual', 'end2'),
  };
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

/**
 * `?boundary=1` — Handoff 11 N-1: a host task + a LOOSE intermediate timer
 * event, positioned for the drag-to-attach / detach / resize-reflow e2e.
 */
export function buildBoundaryDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-boundary', name: 'Boundary attach', createdBy: 'demo' });
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number) =>
    createNode({ type, id, label, x, y, properties: {}, versionId: v }, registry);
  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 60, 150),
    host: make('task', 'host', 'Processar pedido', 200, 120),
    end: make('endEvent', 'end', 'Fim', 460, 150),
    timer: make('intermediateCatchEvent', 'timer', 'Timeout', 520, 320),
  };
  const edge = (id: string, sourceId: string, targetId: string) =>
    createEdge({ id, sourceId, targetId, type: 'sequenceFlow', versionId: v });
  diagram.edges = {
    f1: edge('f1', 'start', 'host'),
    f2: edge('f2', 'host', 'end'),
  };
  return diagram;
}

/**
 * `?eventio=1` — Handoff 16 E-4 (§3c): the executable-event matrix on one
 * canvas — message THROW (payload), error BOUNDARY + error START inside a
 * subProcess (captura), and a message CATCH as the negative (no tab: runtime
 * correlation is host-owned). Paired with the engine plugin in App.
 */
export function buildEventIoDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-eventio', name: 'I/O de eventos', createdBy: 'demo' });
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);
  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 60, 150),
    host: make('task', 'host', 'Cobrar pagamento', 180, 120),
    b1: make('boundaryEvent', 'b1', 'Falhou', 260, 180, {
      eventDefinition: 'error',
      attachedToRef: 'host',
    }),
    t1: make('intermediateThrowEvent', 't1', 'Avisar aprovação', 420, 150, {
      eventDefinition: 'message',
    }),
    mc: make('intermediateCatchEvent', 'mc', 'Aguardar retorno', 560, 150, {
      eventDefinition: 'message',
    }),
    // ES-3: contêiner REAL (triggeredByEvent) — a aproximação da E-4 morreu.
    sub: make('subProcess', 'sub', 'Tratamento', 180, 300, { isExpanded: true, triggeredByEvent: true }),
    es1: make('startEvent', 'es1', 'Erro capturado', 200, 340, {
      eventDefinition: 'error',
      parentId: 'sub',
    }),
    end: make('endEvent', 'end', 'Fim', 720, 150),
  };
  const mkEdge = (id: string, sourceId: string, targetId: string) =>
    createEdge({ id, sourceId, targetId, versionId: v });
  diagram.edges = {
    f1: mkEdge('f1', 'start', 'host'),
    f2: mkEdge('f2', 'host', 't1'),
    f3: mkEdge('f3', 't1', 'mc'),
    f4: mkEdge('f4', 'mc', 'end'),
  };
  return diagram;
}

/**
 * `?simulate=1&errors=1` — Handoff 16 E-6 (§3e): error-matching demo. `host`
 * carries a SPECIFIC error boundary (err-pay) + a declared CATCH-ALL; `dup`
 * carries TWO boundaries on the SAME error (genuine ambiguity → honest stop).
 */
export function buildErrorSimDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-error-sim', name: 'Matching de erros', createdBy: 'demo' });
  const v = diagram.version.id;
  diagram.definitions = {
    messages: [],
    signals: [],
    errors: [
      { id: 'err-pay', name: 'Falha de pagamento' },
      { id: 'err-dup', name: 'Erro duplicado' },
    ],
  };
  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);
  const boundary = (id: string, label: string, host: string, x: number, y: number, ref?: string) =>
    make('boundaryEvent', id, label, x, y, {
      eventDefinition: 'error',
      attachedToRef: host,
      ...(ref ? { eventDefinitionRef: ref } : {}),
    });
  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 40, 150),
    host: make('task', 'host', 'Cobrar pagamento', 160, 120),
    dup: make('task', 'dup', 'Conciliar', 360, 120, {}),
    end: make('endEvent', 'end', 'Fim', 560, 150),
    b1: boundary('b1', 'Pagamento falhou', 'host', 240, 180, 'err-pay'),
    ball: boundary('ball', 'Qualquer erro', 'host', 200, 180),
    d1: boundary('d1', 'Duplicata A', 'dup', 420, 180, 'err-dup'),
    d2: boundary('d2', 'Duplicata B', 'dup', 460, 180, 'err-dup'),
    r1: make('task', 'r1', 'Reprocessar', 240, 300),
    r2: make('task', 'r2', 'Registrar falha', 80, 300),
    f1: make('endEvent', 'f1', 'Fim (retry)', 240, 420),
    f2: make('endEvent', 'f2', 'Fim (falha)', 80, 420),
    g1: make('endEvent', 'g1', 'Fim (A)', 420, 300),
    g2: make('endEvent', 'g2', 'Fim (B)', 460, 300),
  };
  const mkEdge = (id: string, sourceId: string, targetId: string) =>
    createEdge({ id, sourceId, targetId, versionId: v });
  diagram.edges = {
    e1: mkEdge('e1', 'start', 'host'),
    e2: mkEdge('e2', 'host', 'dup'),
    e3: mkEdge('e3', 'dup', 'end'),
    e4: mkEdge('e4', 'b1', 'r1'),
    e5: mkEdge('e5', 'ball', 'r2'),
    e6: mkEdge('e6', 'r1', 'f1'),
    e7: mkEdge('e7', 'r2', 'f2'),
    e8: mkEdge('e8', 'd1', 'g1'),
    e9: mkEdge('e9', 'd2', 'g2'),
  };
  return diagram;
}

/**
 * `?simulate=1&esub=1` — Handoff 17 ES-5 (§4e): event-subprocess firing demo.
 * `host` carries a SPECIFIC error boundary on err-pay AND the scope has an
 * INTERRUPTING event subprocess on the SAME err-pay (same scope WINS the
 * boundary — the binding precedence), plus a NON-interrupting one on err-late
 * (the parallel variant).
 */
export function buildEsubSimDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-esub-sim', name: 'Plantões', createdBy: 'demo' });
  const v = diagram.version.id;
  diagram.definitions = {
    messages: [],
    signals: [],
    errors: [
      { id: 'err-pay', name: 'Falha de pagamento' },
      { id: 'err-late', name: 'Atraso' },
    ],
  };
  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);
  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 40, 150),
    host: make('task', 'host', 'Cobrar pagamento', 160, 120),
    end: make('endEvent', 'end', 'Fim', 380, 150),
    b1: make('boundaryEvent', 'b1', 'Pagamento falhou', 240, 180, {
      eventDefinition: 'error',
      attachedToRef: 'host',
      eventDefinitionRef: 'err-pay',
    }),
    r1: make('task', 'r1', 'Reprocessar', 240, 300),
    f1: make('endEvent', 'f1', 'Fim (retry)', 240, 420),
    esubI: make('subProcess', 'esubI', 'Tratar exceções', 60, 480, {
      triggeredByEvent: true,
      isExpanded: true,
    }),
    stI: make('startEvent', 'stI', 'Começo', 80, 540, {
      parentId: 'esubI',
      eventDefinition: 'error',
      eventDefinitionRef: 'err-pay',
    }),
    esubN: make('subProcess', 'esubN', 'Plantão de atrasos', 360, 480, {
      triggeredByEvent: true,
      isExpanded: true,
    }),
    stN: make('startEvent', 'stN', 'Começo', 380, 540, {
      parentId: 'esubN',
      eventDefinition: 'error',
      eventDefinitionRef: 'err-late',
      isInterrupting: false,
    }),
  };
  const mkEdge = (id: string, sourceId: string, targetId: string) =>
    createEdge({ id, sourceId, targetId, versionId: v });
  diagram.edges = {
    e1: mkEdge('e1', 'start', 'host'),
    e2: mkEdge('e2', 'host', 'end'),
    e3: mkEdge('e3', 'b1', 'r1'),
    e4: mkEdge('e4', 'r1', 'f1'),
  };
  return diagram;
}

/**
 * `?timer=1` — Handoff 16 E-5 (§3d): a timer catch with a MALFORMED duration
 * (`P1H` — hours require the T designator) and a message catch with no named
 * definition, so the lint dock lists TIMER_MALFORMED (no mechanical fix) and
 * EVT_REF_MISSING (kind-aware quick-fix) out of the box.
 */
export function buildTimerDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-timer', name: 'Timers', createdBy: 'demo' });
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);
  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 60, 150),
    t1: make('intermediateCatchEvent', 't1', 'Aguardar prazo', 220, 150, {
      eventDefinition: 'timer',
      timer: { kind: 'duration', expression: 'P1H' },
    }),
    m1: make('intermediateCatchEvent', 'm1', 'Aguardar aviso', 400, 150, {
      eventDefinition: 'message',
    }),
    end: make('endEvent', 'end', 'Fim', 580, 150),
  };
  const mkEdge = (id: string, sourceId: string, targetId: string) =>
    createEdge({ id, sourceId, targetId, versionId: v });
  diagram.edges = {
    f1: mkEdge('f1', 'start', 't1'),
    f2: mkEdge('f2', 't1', 'm1'),
    f3: mkEdge('f3', 'm1', 'end'),
  };
  return diagram;
}

/**
 * `?events=1` — Handoff 16 E-2 (§3a): two loose message catch events with NO
 * named definition yet, for the full e2e flow — create via «+», reference in
 * both, rename (cascade), see the usage list, hit the deletion veto, unlink
 * and finally delete.
 */
export function buildEventDefsDiagram(withLibrary = false): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-events', name: 'Definições de evento', createdBy: 'demo' });
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);
  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 60, 150),
    m1: make('intermediateCatchEvent', 'm1', 'Aguardar aprovação', 220, 150, { eventDefinition: 'message' }),
    m2: make('intermediateCatchEvent', 'm2', 'Aguardar confirmação', 400, 150, { eventDefinition: 'message' }),
    end: make('endEvent', 'end', 'Fim', 580, 150),
  };
  const mkEdge = (id: string, sourceId: string, targetId: string) =>
    createEdge({ id, sourceId, targetId, versionId: v });
  diagram.edges = {
    f1: mkEdge('f1', 'start', 'm1'),
    f2: mkEdge('f2', 'm1', 'm2'),
    f3: mkEdge('f3', 'm2', 'end'),
  };
  // `&lib=1` (E-3): m3 arrives PRE-BOUND to a ref the demo catalog does not
  // know — Validate must surface SIG_REF_MISSING and the chip shows ✕. The
  // gov-* mirror keeps the OMG export valid even for the broken binding.
  if (withLibrary) {
    diagram.nodes.m3 = make('intermediateCatchEvent', 'm3', 'Aguardar legado', 400, 280, {
      eventDefinition: 'message',
      eventDefinitionRef: 'gov-legado.cancelado',
      eventDefinitionBinding: 'legado.cancelado@0.9.0',
    });
    diagram.edges.f4 = mkEdge('f4', 'm1', 'm3');
    diagram.definitions = {
      messages: [{ id: 'gov-legado.cancelado', name: 'Legado cancelado' }],
      signals: [],
      errors: [],
    };
  }
  return diagram;
}

/**
 * `?escalation=1` — Handoff 18 §5b: an approval task with a non-interrupting
 * escalation boundary already attached (named `esc-1`, code OVER_BUDGET) for the
 * full 5b e2e — escalationCode + authority fields, the transient authority chip
 * (settled on blur) and the interrupting toggle. The palette-drop veto is driven
 * on the empty canvas (`?empty=1`).
 */
export function buildEscalationDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-escalation', name: 'Escalação', createdBy: 'demo' });
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);
  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 60, 150),
    approve: make('userTask', 'approve', 'Aprovar despesa', 220, 128),
    bnd: make('boundaryEvent', 'bnd', 'Acima da alçada', 262, 170, {
      attachedToRef: 'approve',
      cancelActivity: false,
      eventDefinition: 'escalation',
      eventDefinitionRef: 'esc-1',
      boundarySide: 'bottom',
      boundaryT: 0.5,
    }),
    end: make('endEvent', 'end', 'Fim', 460, 150),
  };
  diagram.edges = {
    f1: createEdge({ id: 'f1', sourceId: 'start', targetId: 'approve', versionId: v }),
    f2: createEdge({ id: 'f2', sourceId: 'approve', targetId: 'end', versionId: v }),
  };
  diagram.definitions = {
    messages: [],
    signals: [],
    errors: [],
    escalations: [{ id: 'esc-1', name: 'Acima da alçada', escalationCode: 'OVER_BUDGET' }],
  };
  return diagram;
}

/**
 * `?agentbridge=1` — Handoff 18 §5c: the agent→human escalation bridge. An
 * agentTask (autonomy declared via its governed workflow ref) carries a
 * NON-INTERRUPTING escalation boundary GOVERNED-bound to `esc-alcada@1.2.0`
 * (the VIGENTE chip), declaring its authority (`↟ Gate G2`); the escalation
 * routes to a human review/signature `userTask`. The three elements the e2e
 * asserts: agentTask (🤖 + ref), boundary (esc@ chip + authority chip), human
 * review. The boundary needs the event-library plugin (resolver) — App wires
 * `EVENT_LIB_PLUGINS` for this param. Simulating the raise is EC-5 (no honest
 * trigger yet); the ledger `escalationRaisedEntry` glue lands there too.
 */
export function buildEscalationBridgeDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-agentbridge', name: 'Ponte agente→humano', createdBy: 'demo' });
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);
  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 60, 120),
    agent: make('agentTask', 'agent', 'Analisar contrato', 180, 98, {
      agentWorkflowRef: 'analisar-contrato@1.0.0',
      autonomyLevel: 1,
    }),
    // Non-interrupting escalation boundary, GOVERNED-bound → esc@ VIGENTE chip;
    // authority declared → the green ↟ chip. cancelActivity:false = personality.
    bnd: make('boundaryEvent', 'bnd', 'Acima da alçada', 222, 140, {
      attachedToRef: 'agent',
      cancelActivity: false,
      eventDefinition: 'escalation',
      eventDefinitionRef: 'gov-esc-alcada',
      eventDefinitionBinding: 'esc-alcada@1.2.0',
      escalationAuthority: 'ana.ruiz (Gate G2)',
      boundarySide: 'bottom',
      boundaryT: 0.5,
    }),
    review: make('userTask', 'review', 'Revisar e assinar', 200, 260),
    end: make('endEvent', 'end', 'Fim', 400, 120),
  };
  diagram.edges = {
    f1: createEdge({ id: 'f1', sourceId: 'start', targetId: 'agent', versionId: v }),
    f2: createEdge({ id: 'f2', sourceId: 'agent', targetId: 'end', versionId: v }),
    f3: createEdge({ id: 'f3', sourceId: 'bnd', targetId: 'review', versionId: v }),
  };
  diagram.definitions = {
    messages: [],
    signals: [],
    errors: [],
    // The gov-* mirror the governed binding pins (read-only, Biblioteca-managed).
    escalations: [{ id: 'gov-esc-alcada', name: 'Acima da alçada', escalationCode: 'OVER_BUDGET' }],
  };
  return diagram;
}
