import type { AuditEntryInput, UserContext } from '@buildtovalue/core';

/**
 * Governed-binding → ledger glue (Handoff 16 E-3, §3b). Same discipline as
 * `reviewCommentEntry`: the ledger MOTOR stays intact — this builder maps a
 * binding change to the `AuditEntryInput` the HOST appends (via its
 * `command.executed` glue); the react editor never touches the ledger. Every
 * explicit re-bind is auditable because the pin semantics make it the ONLY
 * way a diagram's governed reference ever moves.
 */

/** An explicit change of a governed event-definition binding on the chain. */
export const EVENT_BINDING_CHANGED_TYPE = 'EVENT_BINDING_CHANGED';

/**
 * Maps a binding change (bind, re-bind or unbind) to a ledger append input.
 * `from`/`to` are pinned `nome@semver` strings — absent `from` means a first
 * bind, absent `to` means an unbind. `details.artifactId` mirrors the event
 * node so the Ledger Explorer's per-artifact filter works.
 */
export function eventBindingChangedEntry(input: {
  diagramId: string;
  versionId: string;
  nodeId: string;
  actor: Pick<UserContext, 'id'>;
  from?: string;
  to?: string;
}): AuditEntryInput {
  return {
    type: EVENT_BINDING_CHANGED_TYPE,
    userId: input.actor.id,
    versionId: input.versionId,
    details: {
      artifactId: input.nodeId,
      diagramId: input.diagramId,
      ...(input.from !== undefined ? { from: input.from } : {}),
      ...(input.to !== undefined ? { to: input.to } : {}),
    },
  };
}
