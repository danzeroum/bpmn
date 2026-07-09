import { describe, expect, it } from 'vitest';
import {
  AuditLedger,
  createDiagram,
  createEdge,
  createNode,
  LifecycleEngine,
  type BpmnDiagram,
} from '@bpmn-react/core';
import { CoverageTracker, SimulationEngine, buildSession } from '@bpmn-react/simulation';
import {
  coveragePromotionRule,
  createRoteiroAdapter,
  latestSessionCoverage,
  simulationSessionEntry,
  SIMULATION_SESSION_TYPE,
  type RoteiroRecord,
} from '../src/index.js';

/** A tiny XOR diagram: start → x(approve/reject) → two ends. */
function xorDiagram(): BpmnDiagram {
  const d = createDiagram({ id: 'demo', name: 'Demo' });
  for (const [id, type] of [
    ['s', 'startEvent'],
    ['x', 'exclusiveGateway'],
    ['ok', 'task'],
    ['no', 'task'],
    ['e1', 'endEvent'],
    ['e2', 'endEvent'],
  ] as const) {
    d.nodes[id] = createNode({ id, type, label: id, x: 0, y: 0 });
  }
  [
    ['e0', 's', 'x'],
    ['ea', 'x', 'ok'],
    ['eb', 'x', 'no'],
    ['ec', 'ok', 'e1'],
    ['ed', 'no', 'e2'],
  ].forEach(([id, src, tgt]) => {
    d.edges[id] = createEdge({ id, sourceId: src, targetId: tgt });
  });
  return d;
}

/** Play a session that exercises `edge` out of the gateway, then record it. */
async function playSession(diagram: BpmnDiagram, edge: string) {
  const engine = new SimulationEngine(diagram);
  const tracker = new CoverageTracker(engine.graph);
  engine.advance(); // s → x
  engine.choose({ kind: 'exclusive', gateway: 'x', edge });
  while (engine.canAdvance) engine.advance();
  tracker.record(engine.state.traversedEdges);
  return buildSession(engine.scenario, tracker.summary, {
    author: 'ana',
    timestamp: '2026-07-09T00:00:00.000Z',
  });
}

describe('simulationSessionEntry → ledger', () => {
  it('appends an auditable SIMULATION_SESSION entry with coverage + roteiro hash', async () => {
    const diagram = xorDiagram();
    const session = await playSession(diagram, 'ea');
    const ledger = new AuditLedger();
    const entry = await ledger.append(simulationSessionEntry(session, { id: 'ana' }));

    expect(entry.type).toBe(SIMULATION_SESSION_TYPE);
    expect(entry.userId).toBe('ana');
    expect(entry.versionId).toBe(session.versionId);
    expect(entry.details).toMatchObject({
      artifactId: 'demo',
      roteiroHash: session.scenarioHash,
      covered: 1,
      total: 2,
    });
    // The chain stays verifiable with the new entry type.
    expect((await ledger.verify()).valid).toBe(true);
  });
});

describe('latestSessionCoverage', () => {
  it('returns the best recorded coverage for a version, else undefined', async () => {
    const diagram = xorDiagram();
    const ledger = new AuditLedger();
    await ledger.append(simulationSessionEntry(await playSession(diagram, 'ea'))); // 1/2
    expect(latestSessionCoverage(ledger.getEntries(), diagram.version.id)).toEqual({
      covered: 1,
      total: 2,
    });
    expect(latestSessionCoverage(ledger.getEntries(), 'other-version')).toBeUndefined();
  });
});

describe('coveragePromotionRule (optional gate, OFF by default)', () => {
  it('is absent from a default engine — no coverage rule gate exists', async () => {
    const engine = new LifecycleEngine();
    const gates = await engine.evaluateGates({
      diagram: xorDiagram(),
      target: 'active',
      actor: { id: 'u', role: 'admin' },
      reason: 'go',
    });
    // The optional coverage gate surfaces as a `rule:N` gate only when the host
    // adds it to promotionRules; a default engine has none.
    expect(gates.some((g) => g.id.startsWith('rule:'))).toBe(false);
  });

  it('blocks activation below the threshold and passes at/above it', () => {
    const rule = coveragePromotionRule({
      minCoverage: 0.8,
      coverageFor: () => ({ covered: 1, total: 2 }), // 50%
    });
    const input = {
      diagram: xorDiagram(),
      target: 'active' as const,
      actor: { id: 'u', role: 'admin' },
      reason: 'go',
    };
    expect(rule(input)).toMatchObject({ allowed: false });

    const passing = coveragePromotionRule({ minCoverage: 0.8, coverageFor: () => ({ covered: 4, total: 5 }) });
    expect(passing(input)).toEqual({ allowed: true });
  });

  it('degrades gracefully: never blocks when no coverage was recorded', () => {
    const rule = coveragePromotionRule({ minCoverage: 1, coverageFor: () => undefined });
    const input = {
      diagram: xorDiagram(),
      target: 'active' as const,
      actor: { id: 'u', role: 'admin' },
      reason: 'go',
    };
    expect(rule(input)).toEqual({ allowed: true });
  });

  it('only bites on activation, not lower promotions', () => {
    const rule = coveragePromotionRule({ minCoverage: 1, coverageFor: () => ({ covered: 0, total: 3 }) });
    expect(
      rule({ diagram: xorDiagram(), target: 'candidate', actor: { id: 'u', role: 'admin' }, reason: 'x' }),
    ).toEqual({ allowed: true });
  });
});

describe('createRoteiroAdapter (library ROTEIRO)', () => {
  it('lists recorded roteiros and resolves detail with a replay action', async () => {
    const diagram = xorDiagram();
    const records: RoteiroRecord[] = [{ session: await playSession(diagram, 'ea'), ledgerHash: 'abc123' }];
    const adapter = createRoteiroAdapter(() => records);

    expect(adapter.typeLabel).toBe('ROTEIRO');
    const list = await adapter.list({});
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ typeLabel: 'ROTEIRO', ref: { adapterId: 'roteiro' } });

    const detail = await adapter.get(list[0].ref.artifactId);
    expect(detail.actions.some((a) => a.id === 'replay-roteiro' && a.kind === 'navigate')).toBe(true);
    expect(detail.provenance?.ledgerHash).toBe('abc123');
    expect(detail.versions[0].version).toBe(diagram.version.semanticVersion);
  });

  it('dedupes by roteiro hash and reflects list growth after notifyChanged', async () => {
    const diagram = xorDiagram();
    const same = await playSession(diagram, 'ea');
    const records: RoteiroRecord[] = [{ session: same }, { session: same }]; // identical roteiro twice
    const adapter = createRoteiroAdapter(() => records);
    expect(await adapter.list({})).toHaveLength(1); // deduped

    let pinged = 0;
    const unsub = adapter.subscribe?.(() => (pinged += 1));
    records.push({ session: await playSession(diagram, 'eb') }); // a different roteiro
    adapter.notifyChanged();
    expect(pinged).toBe(1);
    expect(await adapter.list({})).toHaveLength(2);
    unsub?.();
  });
});
