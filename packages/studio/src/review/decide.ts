import type { AuditEntry, AuditLedger, BpmnDiagram, LifecycleEngine, UserContext } from '@buildtovalue/core';
import type { SignedApproval } from '@buildtovalue/identity';
import { reviewChangesRequestedEntry, type SignedChangeRequestRef } from '@buildtovalue/adapters-bpmn';

/**
 * Decision commands of the Revisão (Handoff 6 §5). Both write a ledger entry
 * — the decision is immutable (no undo; corrigir = novo ciclo). Approving
 * NEVER activates: a separação solicitante/aprovador é intencional (§11) —
 * a ativação final é um ato da solicitante, fora desta tela.
 */
export const APPROVAL_RECORDED = 'APPROVAL_RECORDED';
export const PROMOTION_REJECTED = 'PROMOTION_REJECTED';
export const MIN_REJECTION_REASON_LENGTH = 10;

export interface ApprovePromotionInput {
  engine: LifecycleEngine;
  ledger: AuditLedger;
  diagram: BpmnDiagram;
  actor: UserContext;
  /**
   * Ed25519 signature over the approval payload (Handoff 8 I-2). When present it
   * is persisted in the `APPROVAL_RECORDED` entry `details` — so it joins the
   * hash-chain (tamper-evident) and travels through `onDecided`. Absent → the
   * approval is recorded unsigned (legacy), exactly as before.
   */
  signedApproval?: SignedApproval;
}

export interface DecisionResult {
  kind: 'approved' | 'rejected' | 'changes-requested';
  /**
   * approve → the diagram carrying the new ApprovalRecord;
   * changes-requested → the NEW `in-review` version the state machine minted
   * (chained to the candidate via `parentVersionId`); reject → unchanged.
   */
  diagram: BpmnDiagram;
  ledgerEntry: AuditEntry;
}

/**
 * Records a formal approval: the engine mutates `approvedBy` (immutable copy)
 * and the act is written to the ledger with role + hash. The rule of who may
 * approve stays in the engine — `approve` throws on double-approval.
 */
export async function approvePromotion(input: ApprovePromotionInput): Promise<DecisionResult> {
  const { engine, ledger, diagram, actor, signedApproval } = input;
  const approved = engine.approve(diagram, actor, `Aprovação formal como ${actor.role}`);
  const ledgerEntry = await ledger.append({
    type: APPROVAL_RECORDED,
    userId: actor.id,
    versionId: diagram.version.id,
    details: {
      artifactId: diagram.id,
      role: actor.role,
      semanticVersion: diagram.version.semanticVersion,
      ...(signedApproval ? { signedApproval } : {}),
    },
  });
  return { kind: 'approved', diagram: approved, ledgerEntry };
}

export interface RejectPromotionInput {
  ledger: AuditLedger;
  diagram: BpmnDiagram;
  actor: UserContext;
  reason: string;
}

export interface RequestChangesInput {
  engine: LifecycleEngine;
  ledger: AuditLedger;
  diagram: BpmnDiagram;
  actor: UserContext;
  /** Mandatory reviewer comment (min 10 chars — same floor as rejection). */
  justification: string;
  /** Ids of the OPEN threads attached as context (may be empty — §2e régua 6). */
  threadRefs?: readonly string[];
  /** The signed request (Handoff 8 I-2 discipline); absent → legacy unsigned. */
  signedRequest?: SignedChangeRequestRef;
}

/**
 * "Pedir mudanças" (Handoff 15 §2e) — the Studio's DEFAULT soft path (V-0
 * decision 3; `rejectPromotion` remains the documented HARD reject). The
 * transition candidate → `in-review` runs through the core state machine
 * (cerca §1.4 — the UI never sets status directly), then the act becomes its
 * own `REVIEW_CHANGES_REQUESTED` ledger entry carrying the justification,
 * the attached open threads and (when signed) the verifiable signature.
 * Threads are CONTEXT, not a prerequisite: the request works without a
 * ReviewStore (§1.5).
 */
export async function requestChanges(input: RequestChangesInput): Promise<DecisionResult> {
  const { engine, ledger, diagram, actor, justification, threadRefs = [], signedRequest } = input;
  const trimmed = justification.trim();
  if (trimmed.length < MIN_REJECTION_REASON_LENGTH) {
    throw new Error(`justificativa deve ter ao menos ${MIN_REJECTION_REASON_LENGTH} caracteres`);
  }
  const inReview = await engine.promote({
    diagram,
    target: 'in-review',
    actor,
    reason: trimmed,
  });
  const ledgerEntry = await ledger.append(
    reviewChangesRequestedEntry({
      diagramId: diagram.id,
      versionId: diagram.version.id,
      actor,
      justification: trimmed,
      threadRefs,
      ...(signedRequest ? { signedRequest } : {}),
    }),
  );
  return { kind: 'changes-requested', diagram: inReview, ledgerEntry };
}

/** Rejection requires a justification (min 10 chars) and becomes a ledger entry. */
export async function rejectPromotion(input: RejectPromotionInput): Promise<DecisionResult> {
  const { ledger, diagram, actor, reason } = input;
  const trimmed = reason.trim();
  if (trimmed.length < MIN_REJECTION_REASON_LENGTH) {
    throw new Error(`justificativa deve ter ao menos ${MIN_REJECTION_REASON_LENGTH} caracteres`);
  }
  const ledgerEntry = await ledger.append({
    type: PROMOTION_REJECTED,
    userId: actor.id,
    versionId: diagram.version.id,
    details: {
      artifactId: diagram.id,
      role: actor.role,
      semanticVersion: diagram.version.semanticVersion,
      reason: trimmed,
    },
  });
  return { kind: 'rejected', diagram, ledgerEntry };
}
