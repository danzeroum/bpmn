import { describe, expect, it } from 'vitest';
import {
  createDiagram,
  createEdge,
  createNode,
  diffDiagrams,
  type BpmnDiagram,
  type BpmnEdge,
  type BpmnNode,
} from '../src/index.js';

/**
 * Handoff 15 V-1 — the review-grade semantic diff (§2a). Acceptance criteria
 * from the validated V-0 plan: exclusive/exhaustive categories over the
 * fixtures, ΔN never counts x/y/waypoints, rerouted-only never pollutes
 * `changed`, deterministic 10× AND under map-insertion shuffling, stable
 * graph-reading order.
 */

function base(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Review base', id: 'review' });
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Início', x: 40, y: 100 }),
    open: createNode({ id: 'open', type: 'userTask', label: 'Abrir', x: 200, y: 100 }),
    limit: createNode({
      id: 'limit',
      type: 'serviceTask',
      label: 'Validar limite',
      x: 400,
      y: 100,
      properties: { retries: 2 },
    }),
    fax: createNode({ id: 'fax', type: 'sendTask', label: 'Notificar fax', x: 600, y: 220 }),
    file: createNode({ id: 'file', type: 'task', label: 'Arquivar', x: 600, y: 100 }),
    end: createNode({ id: 'end', type: 'endEvent', label: 'Fim', x: 800, y: 100 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'open' }),
    e2: createEdge({ id: 'e2', sourceId: 'open', targetId: 'limit' }),
    e3: createEdge({ id: 'e3', sourceId: 'limit', targetId: 'fax' }),
    e4: createEdge({ id: 'e4', sourceId: 'limit', targetId: 'file' }),
    e5: createEdge({ id: 'e5', sourceId: 'file', targetId: 'end' }),
  };
  return diagram;
}

/** The v1.2 → v1.3 of the mock: add, remove, move, change, reroute. */
function target(): BpmnDiagram {
  const diagram = base();
  const nodes = { ...diagram.nodes };
  const edges = { ...diagram.edges };
  // changed: retries 2→4, timeout novo (2 props → Δ2)
  nodes.limit = { ...nodes.limit, properties: { retries: 4, timeout: '30s' } };
  // added: checar fraude
  nodes.fraud = createNode({ id: 'fraud', type: 'serviceTask', label: 'Checar fraude', x: 400, y: 240 });
  edges.e6 = createEdge({ id: 'e6', sourceId: 'limit', targetId: 'fraud' });
  // removed: notificar fax (e sua aresta)
  const { fax: _fax, ...withoutFax } = nodes;
  const { e3: _e3, ...withoutE3 } = edges;
  // moved: arquivar desce 80px (só geometria)
  withoutFax.file = { ...withoutFax.file, y: 180 };
  // rerouted-only: e5 ganha waypoints manuais
  withoutE3.e5 = {
    ...withoutE3.e5,
    waypoints: [
      { x: 720, y: 210 },
      { x: 760, y: 130 },
      { x: 800, y: 130 },
    ],
  };
  return { ...diagram, nodes: withoutFax, edges: withoutE3 };
}

const byId = (entries: ReturnType<typeof diffDiagrams>, id: string) =>
  entries.find((e) => e.elementId === id);

describe('diffDiagrams — classification (exclusive and exhaustive)', () => {
  it('classifies the mock scenario into the five kinds', () => {
    const entries = diffDiagrams(base(), target());
    expect(byId(entries, 'fraud')!.kind).toBe('added');
    expect(byId(entries, 'fax')!.kind).toBe('removed');
    expect(byId(entries, 'file')!.kind).toBe('moved');
    expect(byId(entries, 'limit')!.kind).toBe('changed');
    expect(byId(entries, 'e5')!.kind).toBe('rerouted');
    expect(byId(entries, 'e6')!.kind).toBe('added');
    expect(byId(entries, 'e3')!.kind).toBe('removed');
    // Untouched elements never appear.
    expect(byId(entries, 'start')).toBeUndefined();
    expect(byId(entries, 'e1')).toBeUndefined();
  });

  it('ΔN counts ONLY real property changes — never x/y/waypoints', () => {
    const entries = diffDiagrams(base(), target());
    const limit = byId(entries, 'limit')!;
    // retries 2→4 + properties carries timeout — the properties field change.
    expect(Object.keys(limit.changes!)).toEqual(['properties']);
    // moved-only carries NO changes at all (ΔN = 0, badge ausente).
    expect(byId(entries, 'file')!.changes).toBeUndefined();
    // rerouted-only idem: rota nunca vira Δ.
    expect(byId(entries, 'e5')!.changes).toBeUndefined();
  });

  it('changed + moved: position rides as moved:true, never as a Δ field', () => {
    const to = target();
    to.nodes.limit = { ...to.nodes.limit, x: 420, y: 60 };
    const limit = byId(diffDiagrams(base(), to), 'limit')!;
    expect(limit.kind).toBe('changed');
    expect(limit.moved).toBe(true);
    expect(limit.from).toEqual({ x: 400, y: 100 });
    expect(limit.to).toEqual({ x: 420, y: 60 });
    expect(Object.keys(limit.changes!)).toEqual(['properties']);
  });

  it('removed nodes carry the BASE position (ghost anchor); moved carry from→to', () => {
    const entries = diffDiagrams(base(), target());
    expect(byId(entries, 'fax')!.from).toEqual({ x: 600, y: 220 });
    const file = byId(entries, 'file')!;
    expect(file.from).toEqual({ x: 600, y: 100 });
    expect(file.to).toEqual({ x: 600, y: 180 });
  });

  it('a CLOSED element (removedInVersion) is removed; reopening is added', () => {
    const closed = base();
    closed.nodes.fax = { ...closed.nodes.fax, removedInVersion: 'v9' };
    expect(byId(diffDiagrams(base(), closed), 'fax')!.kind).toBe('removed');
    expect(byId(diffDiagrams(closed, base()), 'fax')!.kind).toBe('added');
    // Lifecycle never leaks into ΔN.
    expect(byId(diffDiagrams(base(), closed), 'fax')!.changes).toBeUndefined();
  });

  it('edge supersession reads as changed with supersededBy', () => {
    const to = base();
    const replacement: BpmnEdge = {
      ...createEdge({ id: 'e2b', sourceId: 'open', targetId: 'limit', versionId: 'v9' }),
      supersedesEdgeId: 'e2',
    };
    to.edges = { ...to.edges, e2: { ...to.edges.e2, removedInVersion: 'v9' }, e2b: replacement };
    // computeDiff pairs supersession only when the old edge left the map; the
    // temporal-immutability shape (closed + replacement) reports both sides:
    const entries = diffDiagrams(base(), to);
    expect(byId(entries, 'e2')!.kind).toBe('removed');
    expect(byId(entries, 'e2b')!.kind).toBe('added');
    // Hard replacement (old edge gone) → single changed entry with the ref.
    const { e2: _e2, ...rest } = to.edges;
    const hard = { ...to, edges: rest };
    const hardEntries = diffDiagrams(base(), hard);
    const superseded = byId(hardEntries, 'e2')!;
    expect(superseded.kind).toBe('changed');
    expect(superseded.changes!.supersededBy.to).toBe('e2b');
  });

  it('edge rerouted + relabelled at once is changed (route excluded from Δ)', () => {
    const to = base();
    to.edges.e5 = {
      ...to.edges.e5,
      label: 'segue',
      waypoints: [
        { x: 720, y: 130 },
        { x: 800, y: 130 },
      ],
    };
    const entry = byId(diffDiagrams(base(), to), 'e5')!;
    expect(entry.kind).toBe('changed');
    expect(Object.keys(entry.changes!)).toEqual(['label']);
  });

  it('sub-process child changes report the child, not the container', () => {
    const from = base();
    from.nodes.sub = createNode({ id: 'sub', type: 'subProcess', label: 'Sub', x: 900, y: 80 });
    from.nodes.inner = createNode({
      id: 'inner',
      type: 'task',
      label: 'Interna',
      x: 920,
      y: 120,
      properties: { parentId: 'sub' },
    });
    const to = { ...from, nodes: { ...from.nodes } };
    to.nodes.inner = { ...to.nodes.inner, label: 'Interna v2' };
    const entries = diffDiagrams(from, to);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ elementId: 'inner', kind: 'changed' });
  });

  it('lane membership changes read as a lane change', () => {
    const from = base();
    from.nodes.lane1 = createNode({
      id: 'lane1',
      type: 'lane',
      label: 'Análise',
      x: 0,
      y: 0,
      properties: { flowNodeRefs: ['open'] },
    });
    const to = { ...from, nodes: { ...from.nodes } };
    to.nodes.lane1 = {
      ...to.nodes.lane1,
      properties: { flowNodeRefs: ['open', 'limit'] },
    };
    const entry = byId(diffDiagrams(from, to), 'lane1')!;
    expect(entry.kind).toBe('changed');
    expect(Object.keys(entry.changes!)).toEqual(['properties']);
  });
});

describe('diffDiagrams — determinism and stable graph-reading order', () => {
  it('same pair → same list, 10×', () => {
    const first = diffDiagrams(base(), target());
    for (let run = 0; run < 10; run++) {
      expect(diffDiagrams(base(), target())).toEqual(first);
    }
  });

  it('is a pure function of CONTENT — map insertion order shuffled → same list', () => {
    const shuffle = (diagram: BpmnDiagram): BpmnDiagram => ({
      ...diagram,
      nodes: Object.fromEntries(
        Object.entries(diagram.nodes).reverse(),
      ) as Record<string, BpmnNode>,
      edges: Object.fromEntries(
        Object.entries(diagram.edges).reverse(),
      ) as Record<string, BpmnEdge>,
    });
    expect(diffDiagrams(shuffle(base()), shuffle(target()))).toEqual(
      diffDiagrams(base(), target()),
    );
  });

  it('orders by graph reading (upstream first), nodes before their edges', () => {
    const entries = diffDiagrams(base(), target());
    const order = entries.map((e) => e.elementId);
    // limit (rank 2) before fraud/fax/file (rank 3 targets)…
    expect(order.indexOf('limit')).toBeLessThan(order.indexOf('fraud'));
    expect(order.indexOf('limit')).toBeLessThan(order.indexOf('file'));
    // …a node comes before the edges that reach it.
    expect(order.indexOf('fraud')).toBeLessThan(order.indexOf('e6'));
    expect(order.indexOf('fax')).toBeLessThan(order.indexOf('e3'));
    // …and the downstream reroute reads last.
    expect(order.indexOf('file')).toBeLessThan(order.indexOf('e5'));
  });

  it('removed elements rank by the BASE graph (navigable ghosts keep their place)', () => {
    const entries = diffDiagrams(base(), target());
    const order = entries.map((e) => e.elementId);
    // fax was downstream of limit in the base → reads after limit.
    expect(order.indexOf('limit')).toBeLessThan(order.indexOf('fax'));
  });

  it('tolerates cycles without hanging and still orders deterministically', () => {
    const from = base();
    from.edges.back = createEdge({ id: 'back', sourceId: 'file', targetId: 'open' });
    const to = { ...from, nodes: { ...from.nodes } };
    to.nodes.open = { ...to.nodes.open, label: 'Abrir v2' };
    const first = diffDiagrams(from, to);
    expect(first).toHaveLength(1);
    for (let run = 0; run < 10; run++) expect(diffDiagrams(from, to)).toEqual(first);
  });

  it('an empty diff is an empty list', () => {
    expect(diffDiagrams(base(), base())).toEqual([]);
  });
});
