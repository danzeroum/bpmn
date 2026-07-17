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
