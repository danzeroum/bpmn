/**
 * Optional off-thread compute (Handoff 11 N-8). A tiny, zero-dependency harness
 * that lets a host move expensive pure computations (routing, soundness, and —
 * once one exists — layout) onto a Web Worker via OPT-IN, while degrading to the
 * current synchronous behaviour when no worker is provided.
 *
 * The contract is deliberately narrow: a job is a PURE function from a
 * serializable input to a serializable output. The same job registry runs
 * unchanged in-thread (SyncExecutor) or inside a worker (the worker entry wires
 * `createWorkerHandler` to `onmessage`). Because the job is pure and its I/O is
 * serializable, the worker result is byte-for-byte identical to the synchronous
 * one — proven by the equivalence tests, not assumed.
 */
export type ComputeJob<Input = unknown, Output = unknown> = (input: Input) => Output;

export type JobRegistry = Record<string, ComputeJob>;

export interface ComputeExecutor {
  /** Run a registered job by name. Always async so callers are worker-agnostic. */
  run<Output = unknown>(job: string, input: unknown): Promise<Output>;
  /** Release any underlying worker. No-op for the synchronous executor. */
  dispose(): void;
}

/**
 * Default executor — runs jobs synchronously in the calling thread. This IS the
 * current behaviour; a host that never opts into a worker gets exactly this.
 */
export function createSyncExecutor(registry: JobRegistry): ComputeExecutor {
  return {
    run<Output>(job: string, input: unknown): Promise<Output> {
      const fn = registry[job];
      if (!fn) return Promise.reject(new Error(`unknown compute job: ${job}`));
      // Wrapped in a resolved promise so the API matches the worker executor;
      // the computation itself is still synchronous (no behaviour change).
      try {
        return Promise.resolve(fn(input) as Output);
      } catch (error) {
        return Promise.reject(error as Error);
      }
    },
    dispose() {},
  };
}

export interface WorkerRequest {
  __btvJob: true;
  id: number;
  job: string;
  input: unknown;
}
export interface WorkerResponse {
  __btvJob: true;
  id: number;
  result?: unknown;
  error?: string;
}

/**
 * Worker-backed executor. The host constructs the worker (from the
 * `@buildtovalue/react/worker` entry) and passes it here; each `run` posts a
 * request and resolves when the matching response returns.
 */
export function createWorkerExecutor(worker: Worker): ComputeExecutor {
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  const onMessage = (event: MessageEvent<WorkerResponse>) => {
    const data = event.data;
    if (!data || data.__btvJob !== true) return;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.error !== undefined) entry.reject(new Error(data.error));
    else entry.resolve(data.result);
  };
  worker.addEventListener('message', onMessage as EventListener);

  return {
    run<Output>(job: string, input: unknown): Promise<Output> {
      const id = nextId++;
      const request: WorkerRequest = { __btvJob: true, id, job, input };
      return new Promise<Output>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
        worker.postMessage(request);
      });
    },
    dispose() {
      worker.removeEventListener('message', onMessage as EventListener);
      pending.clear();
      worker.terminate();
    },
  };
}

/**
 * The pure request→response handler a worker entry wires to `onmessage`. Kept
 * separate (and exported) so the worker path is unit-testable without a real
 * Worker: feeding it a request yields the same result the SyncExecutor would.
 */
export function createWorkerHandler(registry: JobRegistry) {
  return (request: WorkerRequest): WorkerResponse => {
    const fn = registry[request.job];
    if (!fn) {
      return { __btvJob: true, id: request.id, error: `unknown compute job: ${request.job}` };
    }
    try {
      return { __btvJob: true, id: request.id, result: fn(request.input) };
    } catch (error) {
      return { __btvJob: true, id: request.id, error: (error as Error).message };
    }
  };
}
