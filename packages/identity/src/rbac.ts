import type { RoleRequirementResult, SignedApproval } from './types.js';

/**
 * Evaluate a role requirement against a set of approvals (Handoff 8 §3).
 *
 * Cerca §1.2 — this is VERIFICATION, not enforcement. It reports whether every
 * required role has a matching approval and which roles are still missing; it
 * does NOT block any action. Enforcement is the anchor's and the host's
 * responsibility (documented as line 1 of `limitations.md`).
 *
 * Pure and deterministic: matches on the role asserted inside each signed
 * payload (`approval.payload.role`), which is the field the signature covers.
 * `missing` preserves the order of `requiredRoles` and is de-duplicated.
 */
export function evaluateRoleRequirement(
  requiredRoles: readonly string[],
  approvals: readonly SignedApproval[],
): RoleRequirementResult {
  const present = new Set(approvals.map((a) => a.payload.role));
  const missing: string[] = [];
  for (const role of requiredRoles) {
    if (!present.has(role) && !missing.includes(role)) missing.push(role);
  }
  return { satisfied: missing.length === 0, missing };
}
