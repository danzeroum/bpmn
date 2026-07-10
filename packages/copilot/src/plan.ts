import {
  CommandStack,
  compositeCommand,
  type BpmnDiagram,
  type Command,
} from '@buildtovalue/core';
import { analyzeSoundness } from '@buildtovalue/soundness';
import { COMMAND_WHITELIST } from './whitelist.js';
import type {
  CopilotProposal,
  ProposalError,
  ProposalValidation,
  SoundnessPreview,
} from './types.js';

/**
 * Proposal lifecycle (Handoff 9 §3): parse the provider's raw text →
 * validate INTEGRALLY against the whitelist → materialize ONE undoable
 * composite → project the result on a scratch stack → compute the soundness
 * preview LOCALLY. The AI's own claims about soundness are never used.
 */

/**
 * Parses the provider's raw completion into a {@link CopilotProposal}.
 * Tolerates a ```json fence; anything else malformed is a structured error —
 * never an exception, never a partially-parsed proposal.
 */
export function parseProposal(raw: string): { proposal: CopilotProposal } | { error: string } {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'provider response is not valid JSON' };
  }
  if (typeof data !== 'object' || data === null) return { error: 'proposal must be an object' };
  const p = data as Record<string, unknown>;
  if (!Array.isArray(p.commands)) return { error: "proposal needs a 'commands' array" };
  for (const [i, cmd] of p.commands.entries()) {
    if (typeof cmd !== 'object' || cmd === null || typeof (cmd as { type?: unknown }).type !== 'string') {
      return { error: `command #${i + 1} needs a string 'type'` };
    }
    const params = (cmd as { params?: unknown }).params;
    if (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params))) {
      return { error: `command #${i + 1} 'params' must be an object` };
    }
  }
  if (typeof p.rationale !== 'string') return { error: "proposal needs a string 'rationale'" };
  const ref = p.promptTemplateRef as Record<string, unknown> | undefined;
  if (!ref || typeof ref.id !== 'string' || typeof ref.version !== 'string') {
    return { error: "proposal needs promptTemplateRef {id, version}" };
  }
  return {
    proposal: {
      commands: (p.commands as { type: string; params?: Record<string, unknown> }[]).map((c) => ({
        type: c.type,
        params: c.params ?? {},
      })),
      rationale: p.rationale,
      promptTemplateRef: { id: ref.id as string, version: ref.version as string },
      // A provider-supplied soundnessPreview is deliberately DROPPED (§3):
      // the preview shown to the user always comes from the local analysis.
    },
  };
}

/**
 * Integral validation (cerca §1.3): EVERY command must be whitelisted and
 * well-formed against the current diagram, or the whole proposal is rejected
 * with readable errors naming each offending command. There is no partial
 * acceptance path.
 */
export function validateProposal(
  diagram: BpmnDiagram,
  proposal: CopilotProposal,
): ProposalValidation {
  const errors: ProposalError[] = [];
  if (proposal.commands.length === 0) {
    errors.push({ index: -1, message: 'proposal contains no commands' });
  }
  const newIds = new Set<string>();
  proposal.commands.forEach((command, index) => {
    const spec = COMMAND_WHITELIST[command.type];
    if (!spec) {
      errors.push({
        index,
        message: `command '${command.type}' is not on the whitelist — proposal rejected whole`,
      });
      return;
    }
    const problem = spec.validate(command.params, diagram, newIds);
    if (problem) errors.push({ index, message: problem });
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/** Who/what produced the accepted proposal (cerca §1.2 — immutable AI authorship). */
export interface CopilotAttribution {
  /** The injected provider's id, e.g. "claude-4" → author "ia.copilot@claude-4". */
  providerId: string;
  /** Conversation id recorded with every applied proposal. */
  conversationId: string;
}

export interface CopilotPlan {
  /** ONE undoable composite — "Desfazer tudo" is a single undo (§8.3). */
  command: Command;
  /** The diagram as it would look after applying the plan. */
  projected: BpmnDiagram;
  /** Computed locally from `projected` — never taken from the AI (§3). */
  soundnessPreview: SoundnessPreview;
}

/**
 * Builds the executable plan for a VALIDATED proposal: materializes the
 * whitelisted commands, wraps them in one composite, projects the result on a
 * scratch stack (the live stack is untouched) and runs the REAL soundness
 * analysis over the projection. Call {@link validateProposal} first; this
 * throws on an invalid proposal rather than applying it partially.
 */
export function buildPlan(
  diagram: BpmnDiagram,
  proposal: CopilotProposal,
  attribution?: CopilotAttribution,
): CopilotPlan {
  const verdict = validateProposal(diagram, proposal);
  if (!verdict.ok) {
    throw new Error(
      `invalid proposal: ${verdict.errors.map((e) => `#${e.index + 1} ${e.message}`).join('; ')}`,
    );
  }
  const commands = proposal.commands.map((c) => COMMAND_WHITELIST[c.type].materialize(c.params, diagram));
  const composite = compositeCommand('Proposta do copiloto', commands);
  // AI authorship is explicit and immutable (cerca §1.2): the ledger entry for
  // the applied proposal names the model, the prompt-template version and the
  // conversation — never presented as human work.
  const command: Command = attribution
    ? {
        ...composite,
        toAuditEvent: () => ({
          type: 'COPILOT_PROPOSAL_APPLIED',
          details: {
            author: `ia.copilot@${attribution.providerId}`,
            promptTemplateRef: { ...proposal.promptTemplateRef },
            conversationId: attribution.conversationId,
            rationale: proposal.rationale,
            commandCount: proposal.commands.length,
          },
        }),
      }
    : composite;

  // Projection on a scratch stack — no interceptor, no ledger, no mutation of
  // the caller's state. The same composite is what the host later executes.
  const scratch = new CommandStack(diagram);
  const projectionCommands = proposal.commands.map((c) =>
    COMMAND_WHITELIST[c.type].materialize(c.params, diagram),
  );
  scratch.execute(compositeCommand('projection', projectionCommands));
  const projected = scratch.current;

  const issues = analyzeSoundness(projected);
  const soundnessPreview: SoundnessPreview = {
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
  };
  return { command, projected, soundnessPreview };
}
