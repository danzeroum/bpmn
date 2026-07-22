import { describe, expect, it } from 'vitest';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import {
  MASKED_VALUE,
  RESEARCH_AGENT,
  simulateSquad,
  type AgentWorkflow,
  type ContextContract,
  type SquadManifest,
  type SquadSimResult,
} from '@buildtovalue/agentflow';
import {
  DEFAULT_JOBS,
  createSyncExecutor,
  createWorkerExecutor,
  createWorkerHandler,
  routeJob,
  squadSimJob,
  type RouteJobInput,
  type SquadSimJobInput,
} from '../src/index.js';

/**
 * Handoff 11 N-8 — optional off-thread compute. The worker path must return a
 * byte-for-byte identical result to the synchronous path (the default). We
 * simulate the worker boundary with a JSON round-trip of the input and output
 * (a stricter proxy for structured clone on our serializable data) and compare.
 */
function routableDiagram(): BpmnDiagram {
  const d = createDiagram({ name: 'Route' });
  d.nodes = {
    a: createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 0 }),
    b: createNode({ type: 'task', id: 'b', label: 'B', x: 400, y: 200 }),
    c: createNode({ type: 'task', id: 'c', label: 'C', x: 200, y: 400 }),
  };
  d.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'a', targetId: 'b' }),
    e2: createEdge({ id: 'e2', sourceId: 'b', targetId: 'c' }),
  };
  return d;
}

/** Simulate a postMessage round-trip: serialize in, run the handler, serialize out. */
function throughWorker(job: string, input: unknown): unknown {
  const handle = createWorkerHandler(DEFAULT_JOBS);
  const request = JSON.parse(JSON.stringify({ __btvJob: true, id: 1, job, input }));
  const response = handle(request);
  return JSON.parse(JSON.stringify(response)).result;
}

describe('compute jobs — worker ≡ sync (N-8)', () => {
  it('route: worker path result is byte-for-byte identical to synchronous', async () => {
    const input: RouteJobInput = { diagram: routableDiagram(), router: 'astar' };

    const sync = await createSyncExecutor(DEFAULT_JOBS).run('route', input);
    const worker = throughWorker('route', input);

    expect(JSON.stringify(worker)).toBe(JSON.stringify(sync));
    // And it really computed something (a valid diagram back).
    expect((sync as BpmnDiagram).edges.e1).toBeDefined();
  });

  it('the sync executor is the current behaviour — a direct job call', async () => {
    const input: RouteJobInput = { diagram: routableDiagram(), router: 'astar' };
    const viaExecutor = await createSyncExecutor(DEFAULT_JOBS).run('route', input);
    const direct = routeJob(input);
    expect(JSON.stringify(viaExecutor)).toBe(JSON.stringify(direct));
  });

  it('squad-sim: the F7 worker path is byte-identical to synchronous (SL-10)', async () => {
    const manifest: SquadManifest = {
      kind: 'SquadManifest',
      id: 'sqd-doc-review',
      version: '1.0.0',
      dynamic: 'hierarquico',
      orchestratorRef: 'agnt-rsch@2.1.0',
      members: [{ agentRef: 'agnt-rsch@2.1.0', personaRef: 'prs:a@1.0.0', role: 'pesquisador' }],
      edges: [{ from: 'orch', to: 'pesquisador', kind: 'delegar' }],
      contextContractRef: 'ctx-contract:doc-review@1.0.0',
      gates: [],
    };
    const input: SquadSimJobInput = {
      manifest,
      workflows: { 'agnt-rsch@2.1.0': RESEARCH_AGENT as AgentWorkflow },
      fixturesByRole: {
        orch: { 'llm-1': { outputs: [{ is_complete: true }] }, 'tool-2': { outputs: [{ results: [] }] } },
        pesquisador: { 'llm-1': { outputs: [{ is_complete: true }] }, 'tool-2': { outputs: [{ results: [] }] } },
      },
    };
    const sync = await createSyncExecutor(DEFAULT_JOBS).run('squad-sim', input);
    const worker = throughWorker('squad-sim', input);
    expect(JSON.stringify(worker)).toBe(JSON.stringify(sync));
    // determinism: same job direct call is identical too
    expect(JSON.stringify(squadSimJob(input))).toBe(JSON.stringify(sync));
    expect((sync as SquadSimResult).order).toContain('pesquisador');
  });

  it('squad-sim: the worker path never reveals more PII than the sync path (SL-10 vigilance)', async () => {
    const RAW = 'ana.pii@example.com';
    const manifest: SquadManifest = {
      kind: 'SquadManifest',
      id: 'sqd-doc-review',
      version: '1.0.0',
      dynamic: 'hierarquico',
      orchestratorRef: 'agnt-rsch@2.1.0',
      members: [{ agentRef: 'agnt-rsch@2.1.0', personaRef: 'prs:a@1.0.0', role: 'pesquisador' }],
      edges: [{ from: 'orch', to: 'pesquisador', kind: 'delegar' }],
      contextContractRef: 'ctx-contract:doc-review@1.0.0',
      gates: [],
    };
    // `answer` carries PII and is a sensitive context key.
    const contract: ContextContract = {
      kind: 'ContextContract',
      id: 'ctx-contract:doc-review',
      version: '1.0.0',
      keys: [{ key: 'answer', owner: 'pesquisador', writers: ['pesquisador'], readers: ['*'], sensitivity: 'pii' }],
    };
    const fixtures = {
      orch: { 'llm-1': { outputs: [{ is_complete: true, answer: RAW }] }, 'tool-2': { outputs: [{ results: [] }] } },
      pesquisador: { 'llm-1': { outputs: [{ is_complete: true, answer: RAW }] }, 'tool-2': { outputs: [{ results: [] }] } },
    };
    const input = { manifest, workflows: { 'agnt-rsch@2.1.0': RESEARCH_AGENT as AgentWorkflow }, fixturesByRole: fixtures, contract };

    // Worker path: policy function cannot cross the boundary → conservative redaction.
    const worker = throughWorker('squad-sim', input);
    const workerJson = JSON.stringify(worker);
    // The worker NEVER emits the raw PII (it is fully redacted)…
    expect(workerJson).not.toContain(RAW);
    expect(workerJson).toContain(MASKED_VALUE);

    // A permissive SYNC run (host injects a partial-reveal policy) may show more —
    // proving the worker's exposure ⊆ the sync's (never more).
    const syncPermissive: SquadSimResult = simulateSquad(manifest, {
      resolveWorkflow: () => RESEARCH_AGENT as AgentWorkflow,
      fixturesByRole: fixtures,
      contract,
      maskingPolicy: { mask: (_k, v) => String(v).slice(0, 3) + '…' }, // partial reveal
    });
    const syncJson = JSON.stringify(syncPermissive);
    // the sync path leaked a 3-char prefix; the worker leaked none of it
    expect(syncJson).toContain('ana…');
    expect(workerJson).not.toContain('ana…');
  });

  it('an unknown job rejects on both executors', async () => {
    await expect(createSyncExecutor(DEFAULT_JOBS).run('nope', {})).rejects.toThrow(/unknown compute job/);
    const handled = createWorkerHandler(DEFAULT_JOBS)({ __btvJob: true, id: 1, job: 'nope', input: {} });
    expect(handled.error).toMatch(/unknown compute job/);
  });
});

describe('createWorkerExecutor — plumbing over a Worker (N-8)', () => {
  it('posts a request and resolves the matching response', async () => {
    // A minimal fake Worker that answers synchronously via the real handler.
    const handle = createWorkerHandler(DEFAULT_JOBS);
    const listeners = new Set<(e: { data: unknown }) => void>();
    const fakeWorker = {
      postMessage(request: unknown) {
        const response = handle(request as Parameters<typeof handle>[0]);
        for (const l of listeners) l({ data: response });
      },
      addEventListener(_type: string, cb: (e: { data: unknown }) => void) {
        listeners.add(cb);
      },
      removeEventListener(_type: string, cb: (e: { data: unknown }) => void) {
        listeners.delete(cb);
      },
      terminate() {},
    } as unknown as Worker;

    const executor = createWorkerExecutor(fakeWorker);
    const input: RouteJobInput = { diagram: routableDiagram(), router: 'astar' };
    const result = await executor.run<BpmnDiagram>('route', input);
    expect(JSON.stringify(result)).toBe(JSON.stringify(routeJob(input)));
    executor.dispose();
  });
});
