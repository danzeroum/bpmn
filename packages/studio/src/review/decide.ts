import type { AuditEntry, AuditLedger, BpmnDiagram, LifecycleEngine, UserContext } from '@buildtovalue/core';
import type { SignedApproval } from '@buildtovalue/identity';

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
  kind: 'approved' | 'rejected';
  /** The diagram carrying the new ApprovalRecord (approve only). */
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
