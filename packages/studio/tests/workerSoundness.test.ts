import { describe, expect, it } from 'vitest';
import {
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
  type ValidationIssue,
} from '@buildtovalue/core';
import { analyzeSoundness } from '@buildtovalue/soundness';
import { createSyncExecutor, createWorkerHandler, type JobRegistry } from '@buildtovalue/react';

/**
 * Handoff 11 N-8 — the off-thread compute harness is generic: a host registers
 * jobs that live in OTHER packages the same way the react layer registers its
 * own. Here the host registers `soundness` (from @buildtovalue/soundness) and
 * proves the worker path is byte-for-byte identical to the synchronous default.
 */
const HOST_JOBS: JobRegistry = {
  soundness: (input) => analyzeSoundness((input as { diagram: BpmnDiagram }).diagram),
};

/** XOR-split → AND-join: a classic deadlock, so soundness returns real issues. */
function deadlockDiagram(): BpmnDiagram {
  const d = createDiagram({ name: 'Deadlock' });
  d.nodes = {
    start: createNode({ type: 'startEvent', id: 'start', label: 'S', x: 0, y: 100 }),
    split: createNode({ type: 'exclusiveGateway', id: 'split', label: 'X', x: 120, y: 100 }),
    up: createNode({ type: 'task', id: 'up', label: 'U', x: 260, y: 40 }),
    down: createNode({ type: 'task', id: 'down', label: 'D', x: 260, y: 160 }),
    join: createNode({ type: 'parallelGateway', id: 'join', label: '+', x: 420, y: 100 }),
    end: createNode({ type: 'endEvent', id: 'end', label: 'E', x: 560, y: 100 }),
  };
  d.edges = {
    a: createEdge({ id: 'a', sourceId: 'start', targetId: 'split' }),
    b: createEdge({ id: 'b', sourceId: 'split', targetId: 'up' }),
    c: createEdge({ id: 'c', sourceId: 'split', targetId: 'down' }),
    e: createEdge({ id: 'e', sourceId: 'up', targetId: 'join' }),
    f: createEdge({ id: 'f', sourceId: 'down', targetId: 'join' }),
    g: createEdge({ id: 'g', sourceId: 'join', targetId: 'end' }),
  };
  return d;
}

function throughWorker(job: string, input: unknown): unknown {
  const handle = createWorkerHandler(HOST_JOBS);
  const request = JSON.parse(JSON.stringify({ __btvJob: true, id: 1, job, input }));
  return JSON.parse(JSON.stringify(handle(request))).result;
}

describe('host-registered soundness job — worker ≡ sync (N-8)', () => {
  it('returns the same issues in-thread and through the worker boundary', async () => {
    const input = { diagram: deadlockDiagram() };

    const sync = (await createSyncExecutor(HOST_JOBS).run('soundness', input)) as ValidationIssue[];
    const worker = throughWorker('soundness', input) as ValidationIssue[];

    expect(JSON.stringify(worker)).toBe(JSON.stringify(sync));
    // The fixture really is unsound, so this proves it ran (not an empty no-op).
    expect(sync.length).toBeGreaterThan(0);
  });
});
