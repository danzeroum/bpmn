import type { AuditEntryInput, UserContext } from '@buildtovalue/core';

/**
 * Escalation → ledger glue (Handoff 18 §5c). Same discipline as
 * `eventBindingChangedEntry`/`reviewCommentEntry`: the ledger MOTOR stays
 * intact — this is a PURE builder mapping a raised escalation to the
 * `AuditEntryInput` the HOST appends (via its `command.executed` glue); the
 * adapter never touches the ledger, never imports react, and agentflow stays
 * independent (no cross-package dependency).
 *
 * Semantics (reforço 7): `ESCALATION_RAISED` means the escalation ACTUALLY
 * HAPPENED (an agent/human escalated), NOT that a boundary was drawn — drawing
 * ≠ escalating. In this handoff the entry has no honest runtime trigger yet;
 * the real glue (append when `throwEscalation` fires in the simulator) lands in
 * EC-5. `details.author` carries the actor so the Ledger Explorer's ✦
 * mixed-authorship seal renders for AI escalations (`ia.copilot@…`) via the
 * existing `aiAuthorOf`, and stays absent for human ones — the same trail.
 */
export const ESCALATION_RAISED_TYPE = 'ESCALATION_RAISED';

/** Maps a raised escalation (actor, code, target) to a ledger append input. */
export function escalationRaisedEntry(input: {
  diagramId: string;
  versionId: string;
  nodeId: string;
  actor: Pick<UserContext, 'id'>;
  code?: string;
  target?: string;
}): AuditEntryInput {
  return {
    type: ESCALATION_RAISED_TYPE,
    userId: input.actor.id,
    versionId: input.versionId,
    details: {
      artifactId: input.nodeId,
      diagramId: input.diagramId,
      // Authorship of the escalation — read by the Explorer's ✦ seal
      // (`aiAuthorOf`): AI actors (`ia.copilot@…`) get the seal, humans do not.
      author: input.actor.id,
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.target !== undefined ? { target: input.target } : {}),
    },
  };
}
