import {
  canonicalJsonExact,
  sha256Hex,
  type AuditEntry,
  type AuditEntryInput,
  type UserContext,
} from '@buildtovalue/core';
import type { SquadBlock, SquadFact, SquadSimResult } from '@buildtovalue/agentflow';

/**
 * Squad Lane SL-11 — the EvidenceBundle as a CANONICAL audit entry.
 *
 * A squad run produces a masked fact trail (`SquadSimResult` from agentflow —
 * which never imports audit/core). This module is the INJECTION glue that turns
 * that run into a governed, verifiable evidence record:
 *
 *   · `EvidenceBundle` is a neutral, serializable capture — the squad analog of
 *     a simulation `Session`. It reuses the SAME integrity discipline (canonical
 *     JSON + SHA-256 via core's `canonicalJsonExact`/`sha256Hex`), never a
 *     bespoke hash/serialization format.
 *   · The three GOVERNANCE refs are MANDATORY (acceptance §10.4): `policyRefs`,
 *     `decisionRuleRefs`, and `maskingPolicyRef`. A bundle that claims masked
 *     evidence without naming the masking policy is dishonest — the builder
 *     REFUSES it (throws), never silently emits unattributed evidence.
 *   · `evidenceBundleEntry` maps a bundle to an `AuditEntryInput`. Appended
 *     through the normal `AuditLedger.append()`, the entry is hashed by core's
 *     `computeEntryHash` (v2 = exact canonical JSON), so `@buildtovalue/audit`'s
 *     `verifyLedger` validates it with NO new verification code.
 */

/** The ledger entry type for a recorded squad evidence bundle. */
export const EVIDENCE_BUNDLE_TYPE = 'EVIDENCE_BUNDLE';

/**
 * A canonical, serializable evidence record for one squad run. The three
 * governance refs are REQUIRED — there is no bundle without them.
 */
export interface EvidenceBundle {
  kind: 'EvidenceBundle';
  /** The squad this evidence belongs to (`sqd-*@semver`). */
  squadRef: string;
  /** The governed version the run evidences. */
  versionId: string;
  /** MANDATORY — the policy refs that governed the run (may be empty, never absent). */
  policyRefs: string[];
  /** MANDATORY — the decision-rule refs consulted. */
  decisionRuleRefs: string[];
  /** MANDATORY — the masking policy the trail's PII was masked under. Non-empty:
   * a masked trail with no named policy is not attributable evidence. */
  maskingPolicyRef: string;
  /** Whether the squad run reached its end. */
  complete: boolean;
  /** The first honest cross-agent stop, or null. */
  blocked: SquadBlock | null;
  /** The agents in execution order. */
  order: string[];
  /** The masked fact trail (`fixture` × `evidencia-declarada` preserved). */
  facts: SquadFact[];
}

/** The governance metadata a bundle MUST declare. */
export interface EvidenceBundleMeta {
  squadRef: string;
  versionId: string;
  policyRefs: string[];
  decisionRuleRefs: string[];
  maskingPolicyRef: string;
}

/**
 * Builds an {@link EvidenceBundle} from a squad run + its mandatory governance
 * refs. Throws when `maskingPolicyRef` is empty — evidence whose PII was masked
 * must name HOW, or it is not attributable (never a silent unattributed bundle).
 */
export function buildEvidenceBundle(result: SquadSimResult, meta: EvidenceBundleMeta): EvidenceBundle {
  if (!meta.maskingPolicyRef || meta.maskingPolicyRef.trim() === '') {
    throw new Error(
      'EvidenceBundle requires a maskingPolicyRef — a masked trail with no named masking policy is not attributable evidence.',
    );
  }
  return {
    kind: 'EvidenceBundle',
    squadRef: meta.squadRef,
    versionId: meta.versionId,
    policyRefs: [...meta.policyRefs],
    decisionRuleRefs: [...meta.decisionRuleRefs],
    maskingPolicyRef: meta.maskingPolicyRef,
    complete: result.complete,
    blocked: result.blocked,
    order: [...result.order],
    facts: result.facts,
  };
}

/** The bundle's canonical JSON export (acceptance §10.4 — deterministic, keys
 * sorted, numbers exact). Two runs of the same squad export byte-identically. */
export function canonicalEvidenceBundle(bundle: EvidenceBundle): string {
  return canonicalJsonExact(bundle);
}

/** The bundle's content hash — SHA-256 over its canonical JSON (core primitive,
 * no bespoke format). Deterministic: same bundle 2× → identical hash. */
export function hashEvidenceBundle(bundle: EvidenceBundle): Promise<string> {
  return sha256Hex(canonicalEvidenceBundle(bundle));
}

/**
 * Maps a bundle to an audit-ledger append input. `details.artifactId` is the
 * squad ref (so the Explorer's artifact filter works); `details.author` carries
 * the actor (so the ✦ AI seal renders when a copilot recorded it). The full
 * masked trail + the mandatory refs live in `details`, so the appended entry —
 * hashed whole by core's v2 `computeEntryHash` — is self-verifying.
 */
export function evidenceBundleEntry(bundle: EvidenceBundle, actor?: Pick<UserContext, 'id'>): AuditEntryInput {
  return {
    type: EVIDENCE_BUNDLE_TYPE,
    userId: actor?.id ?? 'system',
    versionId: bundle.versionId,
    details: {
      artifactId: bundle.squadRef,
      ...(actor?.id ? { author: actor.id } : {}),
      policyRefs: [...bundle.policyRefs],
      decisionRuleRefs: [...bundle.decisionRuleRefs],
      maskingPolicyRef: bundle.maskingPolicyRef,
      complete: bundle.complete,
      blocked: bundle.blocked,
      order: [...bundle.order],
      facts: bundle.facts,
    },
  };
}

/**
 * Reconstructs the {@link EvidenceBundle} stored in an `EVIDENCE_BUNDLE` entry —
 * no side store, the chain IS the store. Returns `undefined` for a non-evidence
 * entry (so a reader degrades gracefully).
 */
export function evidenceBundleOf(entry: Pick<AuditEntry, 'type' | 'versionId' | 'details'>): EvidenceBundle | undefined {
  if (entry.type !== EVIDENCE_BUNDLE_TYPE) return undefined;
  const d = entry.details;
  const maskingPolicyRef = typeof d.maskingPolicyRef === 'string' ? d.maskingPolicyRef : '';
  if (maskingPolicyRef === '') return undefined; // a bundle without its masking policy is not one
  return {
    kind: 'EvidenceBundle',
    squadRef: typeof d.artifactId === 'string' ? d.artifactId : '',
    versionId: entry.versionId,
    policyRefs: Array.isArray(d.policyRefs) ? (d.policyRefs as string[]) : [],
    decisionRuleRefs: Array.isArray(d.decisionRuleRefs) ? (d.decisionRuleRefs as string[]) : [],
    maskingPolicyRef,
    complete: d.complete === true,
    blocked: (d.blocked as SquadBlock | null) ?? null,
    order: Array.isArray(d.order) ? (d.order as string[]) : [],
    facts: Array.isArray(d.facts) ? (d.facts as SquadFact[]) : [],
  };
}

/**
 * The ExecutionStore seam (Squad Lane SL-11) — where a host persists squad
 * evidence bundles. INJECTED and DEGRADABLE: a consumer given `undefined`
 * simply does not persist (the run still produces its bundle). The default
 * {@link createInMemoryExecutionStore} keeps the bundles in memory (tests, demos);
 * a real host swaps in durable storage WITHOUT this package importing one.
 */
export interface ExecutionStore {
  /** Persist a bundle (idempotent by the host's choice of key). */
  record(bundle: EvidenceBundle): void | Promise<void>;
  /** All bundles recorded for a squad, newest first (optional). */
  list?(squadRef: string): EvidenceBundle[] | Promise<EvidenceBundle[]>;
}

/** A minimal in-memory {@link ExecutionStore} for tests/demos (no durability). */
export function createInMemoryExecutionStore(): ExecutionStore {
  const bySquad = new Map<string, EvidenceBundle[]>();
  return {
    record(bundle) {
      const list = bySquad.get(bundle.squadRef) ?? [];
      bySquad.set(bundle.squadRef, [bundle, ...list]);
    },
    list(squadRef) {
      return [...(bySquad.get(squadRef) ?? [])];
    },
  };
}
