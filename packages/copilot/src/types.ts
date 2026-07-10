/**
 * @buildtovalue/copilot — contracts (Handoff 9 §3).
 *
 * Governance fences (§1, binding): the AI NEVER promotes, approves or signs —
 * this package has no import path to `identity` or promotion rules
 * (CI-enforced by the guardrails test). Its only output is a validated plan
 * of whitelisted EDIT commands, applied by the host as ONE undoable
 * composite. The provider is HOST-injected (§1.4): no LLM SDK, no network,
 * no telemetry lives here — the host decides what data travels (§1.7).
 */

/** One chat message exchanged with the provider. */
export interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * The HOST-implemented AI transport (§1.4, the same injection pattern the
 * identity and anchor layers use). `complete` returns the raw model text; the
 * copilot layer parses and validates it — the model never touches state
 * directly.
 */
export interface AIProvider {
  /** Provider/model identity recorded in ledger authorship, e.g. "claude-4". */
  id: string;
  complete(req: { system: string; messages: Msg[]; schema?: object }): Promise<string>;
}

/** One proposed edit — `type` must be on the command whitelist (§1.3). */
export interface ProposedCommand {
  type: string;
  params: Record<string, unknown>;
}

/** Reference to the versioned prompt-template artifact used (§1.5). */
export interface PromptTemplateRef {
  id: string;
  version: string;
}

/** Locally computed soundness counts — NEVER supplied by the AI (§3). */
export interface SoundnessPreview {
  errors: number;
  warnings: number;
}

/** A parsed, not-yet-validated proposal from the provider (§3). */
export interface CopilotProposal {
  commands: ProposedCommand[];
  /** Shown verbatim in the chat response. */
  rationale: string;
  promptTemplateRef: PromptTemplateRef;
  /** Filled in by {@link buildPlan} — a provider-supplied value is ignored. */
  soundnessPreview?: SoundnessPreview;
}

/** One validation failure — always names the offending command. */
export interface ProposalError {
  /** Index into `proposal.commands`, or -1 for proposal-level problems. */
  index: number;
  message: string;
}

/** Integral verdict (§1.3): a proposal is applied whole or not at all. */
export type ProposalValidation =
  | { ok: true }
  | { ok: false; errors: ProposalError[] };
