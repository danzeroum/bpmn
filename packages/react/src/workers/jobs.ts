import { cubicBezierConnection, type BpmnDiagram } from '@buildtovalue/core';
import { deriveAstarRoutes } from '../canvas/routeEdge.js';
import { resolveRouter } from '../canvas/routers.js';
import { squadSimJob } from '../squad/squadSimJob.js';
import type { ComputeJob, JobRegistry } from './executor.js';

/**
 * Built-in compute jobs (Handoff 11 N-8). Only jobs the react layer OWNS live
 * here — routing. Soundness and layout live in other packages, so a host
 * registers them the same way (see workers README); the harness is generic.
 *
 * `route` input carries a NAMED router (not a function — functions can't cross a
 * worker boundary); the job resolves it to the real router inside the worker.
 */
export interface RouteJobInput {
  diagram: BpmnDiagram;
  /** Named router: 'astar' | 'orthogonal' | 'bezier' | 'straight'. Default 'astar'. */
  router?: string;
}

/** Re-derive automatic routes for a whole diagram (the expensive A* pass). */
export const routeJob: ComputeJob<RouteJobInput, BpmnDiagram> = ({ diagram, router }) =>
  deriveAstarRoutes(diagram, resolveRouter(router ?? 'astar', cubicBezierConnection));

/** The default registry the worker entry ships with. Extend with your own. */
export const DEFAULT_JOBS: JobRegistry = {
  route: routeJob as ComputeJob,
  // Squad Lane SL-10 — the deterministic squad run, off the main thread.
  'squad-sim': squadSimJob as ComputeJob,
};
