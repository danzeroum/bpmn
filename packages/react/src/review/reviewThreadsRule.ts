import type { PromotionRule } from '@buildtovalue/core';
import type { ReviewThread } from './ReviewStore.js';

/**
 * Approval gate for review threads (Handoff 15 §2d) — the EXACT mold of
 * `soundnessPromotionRule`: a `PromotionRule` the host plugs into
 * `LifecycleConfig.promotionRules`, surfaced by `evaluateGates` as a
 * `rule:N` checklist gate and enforced by `promote()`.
 *
 * Discipline (checklist 2d + C2 of H9): only OPEN threads block —
 * `resolved` and `dismissed` (justified, audited) release the gate, and
 * ORPHANED threads (anchor no longer in the diagram under promotion) never
 * block: the element already left. Blocking is an ERROR verdict, never a
 * warning.
 *
 * The rule guards APPROVAL only (`target: 'active'`): every other transition
 * — including request-changes (candidate → in-review, §2e), whose very
 * trigger is an open thread — passes freely.
 */
export function reviewThreadsRule(threads: () => readonly ReviewThread[]): PromotionRule {
  return ({ diagram, target }) => {
    if (target !== 'active') return { allowed: true };
    const blocking = threads().filter(
      (thread) =>
        !thread.resolved &&
        !thread.dismissed &&
        // Órfã nunca bloqueia — a âncora já saiu do diagrama.
        (thread.elementId in diagram.nodes || thread.elementId in diagram.edges),
    );
    if (blocking.length === 0) return { allowed: true };
    return {
      allowed: false,
      reason:
        blocking.length === 1
          ? `1 thread de review aberta precisa ser resolvida (ou dispensada com justificativa)`
          : `${blocking.length} threads de review abertas precisam ser resolvidas (ou dispensadas com justificativa)`,
    };
  };
}
