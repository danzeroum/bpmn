import type { AuditEntryInput, UserContext } from '@buildtovalue/core';

/**
 * Review → ledger glue (Handoff 15 §2c, V-4). Same discipline as the
 * simulation/replay/anchor entries: the ledger MOTOR stays intact — these
 * builders map review actions to `AuditEntryInput`s the HOST appends
 * (`ledger.append(...)`) from its `ReviewStore` implementation. Every
 * message and every resolution is its OWN chain entry; review data never
 * touches the BPMN model or its XML (cerca §1.2).
 */

/** A review comment (thread opening or reply) recorded on the chain. */
export const REVIEW_COMMENT_TYPE = 'REVIEW_COMMENT_ADDED';
/** A thread resolution recorded on the chain. */
export const REVIEW_THREAD_RESOLVED_TYPE = 'REVIEW_THREAD_RESOLVED';

/** The thread fields the ledger needs — structural, no react import. */
export interface ReviewThreadRef {
  id: string;
  elementId: string;
  versionRef: string;
}

/**
 * Maps a comment (the opening message or a reply) to a ledger append input.
 * `details.artifactId` mirrors the element anchor so the Ledger Explorer's
 * per-artifact filter works; `aiAssisted` records mixed authorship (C4).
 */
export function reviewCommentEntry(
  thread: ReviewThreadRef,
  message: { author: string; text: string; aiAssisted?: boolean },
): AuditEntryInput {
  return {
    type: REVIEW_COMMENT_TYPE,
    userId: message.author,
    versionId: thread.versionRef,
    details: {
      threadId: thread.id,
      artifactId: thread.elementId,
      text: message.text,
      ...(message.aiAssisted ? { aiAssisted: true } : {}),
    },
  };
}

/** A justified dismissal (gate release WITHOUT resolving) on the chain. */
export const REVIEW_THREAD_DISMISSED_TYPE = 'REVIEW_THREAD_DISMISSED';

/**
 * Maps a justified dismissal to a ledger append input (§2d) — never silent:
 * the justification text travels in the entry.
 */
export function reviewThreadDismissedEntry(
  thread: ReviewThreadRef,
  actor: Pick<UserContext, 'id'>,
  justification: string,
): AuditEntryInput {
  return {
    type: REVIEW_THREAD_DISMISSED_TYPE,
    userId: actor.id,
    versionId: thread.versionRef,
    details: {
      threadId: thread.id,
      artifactId: thread.elementId,
      justification,
    },
  };
}

/** A signed request-changes act (§2e) on the chain. */
export const REVIEW_CHANGES_REQUESTED_TYPE = 'REVIEW_CHANGES_REQUESTED';

/**
 * The signed-request fields the ledger persists — structural mirror of
 * identity's `SignedApproval` (no nominal dependency, same discipline as
 * `ReviewThreadRef`).
 */
export interface SignedChangeRequestRef {
  payload: Record<string, unknown>;
  signature: string;
  signer: Record<string, unknown>;
  signedAt: string;
}

/**
 * Maps a request-changes decision (§2e: comentário obrigatório + threads
 * abertas anexadas) to a ledger append input. `versionId` is the CANDIDATE
 * version the request targets; the resulting `in-review` version chains to it
 * via `parentVersionId`. When the act was signed, the full signed request
 * (payload + Ed25519 signature + signer identity) joins the entry so any
 * third party can verify it offline.
 */
export function reviewChangesRequestedEntry(input: {
  diagramId: string;
  versionId: string;
  actor: Pick<UserContext, 'id' | 'role'>;
  justification: string;
  threadRefs: readonly string[];
  signedRequest?: SignedChangeRequestRef;
}): AuditEntryInput {
  return {
    type: REVIEW_CHANGES_REQUESTED_TYPE,
    userId: input.actor.id,
    versionId: input.versionId,
    details: {
      artifactId: input.diagramId,
      role: input.actor.role,
      justification: input.justification,
      threadRefs: [...input.threadRefs],
      ...(input.signedRequest ? { signedRequest: input.signedRequest } : {}),
    },
  };
}

/** Maps a thread resolution to a ledger append input. */
export function reviewThreadResolvedEntry(
  thread: ReviewThreadRef,
  actor: Pick<UserContext, 'id'>,
): AuditEntryInput {
  return {
    type: REVIEW_THREAD_RESOLVED_TYPE,
    userId: actor.id,
    versionId: thread.versionRef,
    details: {
      threadId: thread.id,
      artifactId: thread.elementId,
    },
  };
}
