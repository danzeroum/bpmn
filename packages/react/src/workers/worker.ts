import { createWorkerHandler } from './executor.js';
import { DEFAULT_JOBS } from './jobs.js';

/**
 * Worker entry (Handoff 11 N-8). A host constructs this as a module Worker:
 *
 *   const worker = new Worker(
 *     new URL('@buildtovalue/react/worker', import.meta.url),
 *     { type: 'module' },
 *   );
 *   const executor = createWorkerExecutor(worker);
 *
 * The message wiring runs ONLY inside a real DedicatedWorker — guarded so
 * importing this module in Node/jsdom (build, SSR, tests) is a harmless no-op.
 * `handleWorkerMessage` is exported for direct unit testing of the worker path.
 */
export const handleWorkerMessage = createWorkerHandler(DEFAULT_JOBS);

const scope = globalThis as unknown as {
  WorkerGlobalScope?: unknown;
  addEventListener?: (type: string, cb: (event: { data: unknown }) => void) => void;
  postMessage?: (message: unknown) => void;
};

// WorkerGlobalScope is defined only inside an actual worker thread — never in
// jsdom (where `window.postMessage` would otherwise trip a looser check).
if (
  typeof scope.WorkerGlobalScope !== 'undefined' &&
  typeof scope.addEventListener === 'function' &&
  typeof scope.postMessage === 'function'
) {
  scope.addEventListener('message', (event) => {
    const data = event.data as { __btvJob?: true } | null;
    if (!data || data.__btvJob !== true) return;
    scope.postMessage!(handleWorkerMessage(data as Parameters<typeof handleWorkerMessage>[0]));
  });
}
