/**
 * readinessState (Squad Lane SL-8, insight E1) — the SINGLE pure source of an
 * agent's/squad's derived readiness. Card, badge, tooltip and any future backend
 * all read THIS function; painting a state in the UI is prohibited (cerca §2.11).
 *
 * The ceiling is `apto-para-integracao`. The host states `executando` /
 * `erro-de-integracao` (a real provider running the spec) are NEVER derived here
 * — the library only displays them when the host informs them. Pure, no DOM.
 */

import type { AgentWorkflow } from './types.js';
import type { ValidationIssue } from './validate.js';

/** The four derived readiness states — the frontend ceiling. */
export type ReadinessState =
  | 'rascunho'
  | 'validado'
  | 'simulado-com-evidencia'
  | 'apto-para-integracao';

/** Everything readinessState needs, computed by the caller with its own
 * injected resolvers (one source of validation, one source of state). */
export interface ReadinessContext {
  /** The result of `validateGraph`/`validateSquad` (with the host's resolvers). */
  validation: ValidationIssue[];
  /** A deterministic simulation with declared evidence exists. */
  hasEvidence: boolean;
  /** Eval assertion pass-rate, when an eval set ran. */
  evalPassRate?: number;
  /** The eval promotion threshold. */
  threshold?: number;
  /** A gate covers the external effect (core `reachableGateFrom`). */
  gateCovered?: boolean;
  /** An active, signed version exists (identity). */
  signedActive?: boolean;
  /** A real execution provider is injected (host). Informational only —
   * readiness never crosses into `executando` on its own. */
  providerAvailable?: boolean;
}

/**
 * Derives the readiness state. Order: an empty or error-carrying workflow is a
 * `rascunho`; a clean one with no evidence is `validado`; with evidence but not
 * all promotion conditions met it is `simulado-com-evidencia`; only when eval ≥
 * threshold AND a gate covers the effect AND a signed-active version exists does
 * it reach `apto-para-integracao`. It never returns a host state.
 */
export function readinessState(wf: AgentWorkflow, ctx: ReadinessContext): ReadinessState {
  if (wf.nodes.length === 0) return 'rascunho';
  if (ctx.validation.some((issue) => issue.severity === 'error')) return 'rascunho';
  if (!ctx.hasEvidence) return 'validado';
  const evalOk =
    ctx.evalPassRate === undefined || ctx.threshold === undefined || ctx.evalPassRate >= ctx.threshold;
  if (evalOk && ctx.gateCovered === true && ctx.signedActive === true) {
    return 'apto-para-integracao';
  }
  return 'simulado-com-evidencia';
}
