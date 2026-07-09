import { describe, expect, it } from 'vitest';
import { evaluateRoleRequirement, type SignedApproval } from '../src/index.js';

/**
 * Cerca §1.2 / aceite #5 — `evaluateRoleRequirement` is pure verification: it
 * reports which required roles are still missing a signature, and never blocks.
 */
function approvalWithRole(role: string): SignedApproval {
  return {
    payload: { diagramId: 'd', version: '1', xmlHash: 'x', ledgerHead: 'h', decision: 'approve', role },
    signature: 'sig',
    signer: { subject: `${role}@x`, role, publicKeyFingerprint: 'fp' },
    signedAt: '2026-07-09T00:00:00.000Z',
  };
}

describe('evaluateRoleRequirement (verification, not enforcement)', () => {
  it('is satisfied when every required role has an approval', () => {
    const result = evaluateRoleRequirement(
      ['compliance', 'architecture'],
      [approvalWithRole('compliance'), approvalWithRole('architecture')],
    );
    expect(result).toEqual({ satisfied: true, missing: [] });
  });

  it('reports the missing roles in required order', () => {
    const result = evaluateRoleRequirement(
      ['compliance', 'architecture', 'legal'],
      [approvalWithRole('architecture')],
    );
    expect(result).toEqual({ satisfied: false, missing: ['compliance', 'legal'] });
  });

  it('de-duplicates a repeated required role', () => {
    const result = evaluateRoleRequirement(['compliance', 'compliance'], []);
    expect(result).toEqual({ satisfied: false, missing: ['compliance'] });
  });

  it('an empty requirement is trivially satisfied', () => {
    expect(evaluateRoleRequirement([], [])).toEqual({ satisfied: true, missing: [] });
  });

  it('extra approvals beyond the requirement do not break satisfaction', () => {
    const result = evaluateRoleRequirement(
      ['compliance'],
      [approvalWithRole('compliance'), approvalWithRole('legal')],
    );
    expect(result.satisfied).toBe(true);
  });
});
