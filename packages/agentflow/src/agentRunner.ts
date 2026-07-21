/**
 * Squad Lane SL-10 — the `AgentRunner` seam.
 *
 * A runner is how a single agent workflow is EXECUTED for a squad run. It has
 * two methods with a deliberate asymmetry:
 *
 *   · `simulate` — the deterministic mock (fixtures, no clock/random). ALWAYS
 *     present; it is agentflow's own {@link simulate}, never the BPMN engine.
 *   · `run?` — real execution against a host backend. OPTIONAL and ABSENT in
 *     this delivery (no network/SDK/credential — cerca §0). When a host later
 *     injects one, the squad run can label its facts `evidencia-declarada`
 *     instead of `fixture`; until then the squad runs in simulation only.
 *
 * Degradable by construction: a squad run needs only `simulate`, so the default
 * runner ({@link defaultAgentRunner}) supplies exactly that and nothing else.
 * The seam exists so a host can substitute a real backend WITHOUT agentflow ever
 * importing one (independence test stays green).
 */

import { simulate } from './simulate.js';
import type { AgentWorkflow } from './types.js';
import type { SimulateOptions, SimulationState } from './simTypes.js';

/** How one agent workflow is executed for a squad run. */
export interface AgentRunner {
  /** Deterministic mock simulation — the always-present path. */
  simulate(wf: AgentWorkflow, options?: SimulateOptions): SimulationState;
  /**
   * Real execution against a host backend — OPTIONAL. Absent in this delivery;
   * a host that injects it makes the squad run's facts real declared evidence
   * rather than fixtures. Never called by `simulateSquad` (which is, by name,
   * simulation); it exists so the seam is honest about what a backend would add.
   */
  run?(wf: AgentWorkflow, options?: SimulateOptions): Promise<SimulationState>;
}

/**
 * The default runner: the deterministic mock and nothing else. `run` is
 * deliberately absent — there is no backend in this frontend-only delivery.
 */
export const defaultAgentRunner: AgentRunner = {
  simulate,
};
