import type { BpmnDiagram, LifecycleEngine, PromotionGate, UserContext } from '@buildtovalue/core';

/**
 * One pending promotion request in the approver's queue (Handoff 6 §5).
 * Derived, never stored: candidates come from the host's working set and the
 * approval rule comes exclusively from the lifecycle engine's gates — the UI
 * never re-implements "who can approve / how many are missing" (lição da
 * PR16; criterion §10.3/§10.4).
 */
export interface PromotionRequest {
  diagram: BpmnDiagram;
  /** Engine truth for candidate → active, in gate order. */
  gates: PromotionGate[];
  /** The approvals gate (id 'approvals'), when the engine emits it. */
  approvals?: PromotionGate;
  /** Distinct roles that already approved. */
  approvedRoles: string[];
  /** Days until effectiveFrom, when the version declares a target date. */
  slaDays?: number;
}

export interface PendingPromotionsInput {
  /** Live candidate diagrams, owned by the host (solicitante's store). */
  candidates: readonly BpmnDiagram[];
  engine: LifecycleEngine;
  user: UserContext;
  /** ISO clock — injectable for tests. */
  now?: () => string;
}

/**
 * The approver's queue: candidate versions the user has NOT yet approved.
 * Progress (current/required) comes from the engine's approvals gate.
 */
export async function pendingPromotions(input: PendingPromotionsInput): Promise<PromotionRequest[]> {
  const { candidates, engine, user, now = () => new Date().toISOString() } = input;
  const requests: PromotionRequest[] = [];
  for (const diagram of candidates) {
    if (diagram.version.status !== 'candidate') continue;
    if (diagram.version.approvedBy.some((a) => a.userId === user.id)) continue;
    const gates = await engine.evaluateGates({
      diagram,
      target: 'active',
      actor: user,
      reason: diagram.version.changeSummary,
    });
    const request: PromotionRequest = {
      diagram,
      gates,
      approvedRoles: [...new Set(diagram.version.approvedBy.map((a) => a.role))],
    };
    const approvals = gates.find((g) => g.id === 'approvals');
    if (approvals) request.approvals = approvals;
    if (diagram.version.effectiveFrom) {
      const ms = Date.parse(diagram.version.effectiveFrom) - Date.parse(now());
      request.slaDays = Math.ceil(ms / 86_400_000);
    }
    requests.push(request);
  }
  return requests;
}

/** "1/2 aprovações" — display helper over the engine's gate numbers. */
export function approvalsProgress(request: PromotionRequest): string {
  const required = request.approvals?.required;
  const current = request.approvals?.current ?? request.approvedRoles.length;
  return required !== undefined ? `${current}/${required} aprovações` : `${current} aprovações`;
}
