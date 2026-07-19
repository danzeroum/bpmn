import type { AuditEntryInput, UserContext } from '@buildtovalue/core';

/**
 * Compensation → ledger glue (Handoff 19 §6e). Same discipline as
 * `escalationRaisedEntry` (EC-3): the ledger MOTOR stays intact — this is a PURE
 * builder mapping a TRIGGERED compensation to the `AuditEntryInput` the HOST
 * appends (via its `command.executed` / simulation glue); the adapter never
 * touches the ledger, never imports react/simulation, and agentflow stays
 * independent (no cross-package dependency).
 *
 * Semantics: `COMPENSATION_TRIGGERED` means the reversal ACTUALLY ran (the host
 * appends only when `compensate()` did NOT block — reforço 8). The entry binds
 * the EXECUTED plan: `compensated` in the real REVERSE order (`{activity,
 * handler}`) and `uncompensated` (`{activity, reason}`) — the declared,
 * never-omitted losses. `details.author` carries the actor so the Ledger
 * Explorer's ✦ mixed-authorship seal renders for AI reversals (`ia.copilot@…`)
 * via the existing `aiAuthorOf`, and stays absent for human ones — the same trail.
 */
export const COMPENSATION_TRIGGERED_TYPE = 'COMPENSATION_TRIGGERED';

/** Maps a triggered compensation to a ledger append input. */
export function compensationTriggeredEntry(input: {
  diagramId: string;
  versionId: string;
  /** `'broadcast'` or the specific activity id/label the throw targeted. */
  scope: string;
  actor: Pick<UserContext, 'id'>;
  /** The reversed activities, in real reverse order. */
  compensated: Array<{ activity: string; handler: string }>;
  /** Completed activities left uncompensated — declared, never omitted. */
  uncompensated: Array<{ activity: string; reason: string }>;
}): AuditEntryInput {
  return {
    type: COMPENSATION_TRIGGERED_TYPE,
    userId: input.actor.id,
    versionId: input.versionId,
    details: {
      diagramId: input.diagramId,
      scope: input.scope,
      // Authorship of the reversal — read by the Explorer's ✦ seal (`aiAuthorOf`):
      // AI actors (`ia.copilot@…`) get the seal, humans do not.
      author: input.actor.id,
      compensated: input.compensated,
      uncompensated: input.uncompensated,
    },
  };
}
