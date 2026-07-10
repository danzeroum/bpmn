import {
  BpmnXmlConverter,
  canonicalJson,
  sha256Hex,
  type ApprovalRecord,
} from '@buildtovalue/core';
import type { VersionRegistry } from '@buildtovalue/registry';
import type { LedgerLike } from './verify.js';

/**
 * A signable snapshot of the moment a version was promoted (Handoff 4 §B1):
 * everything an auditor needs to prove WHAT was active, SINCE WHEN and WHO
 * approved it — content-addressed (xmlHash), anchored to the audit chain
 * (ledgerHeadHash) and serialized canonically so the same input always
 * yields the same bytes/hash. Hash-based attestation only — asymmetric
 * signatures (PKI) are deliberately out of scope (§3 do handoff).
 */
export interface Attestation {
  diagramId: string;
  versionId: string;
  semanticVersion: string;
  /** SHA-256 of the canonical BPMN XML export of the registered snapshot. */
  xmlHash: string;
  /** Hash of the ledger's newest entry at attestation time ('' when empty). */
  ledgerHeadHash: string;
  status: string;
  effectiveFrom?: string;
  approvers: ApprovalRecord[];
  attestedAt: string;
}

export interface AttestOptions {
  /** Ledger whose head anchors the attestation (omit → ''). */
  ledger?: LedgerLike;
  /** Timestamp override — pass a fixed value for deterministic output. */
  attestedAt?: string;
}

/**
 * Builds the attestation for a registered version. Reads only — the
 * registry is never mutated. Throws when the version is not registered or
 * belongs to a different diagram.
 */
export async function attestVersion(
  registry: VersionRegistry,
  diagramId: string,
  versionId: string,
  options: AttestOptions = {},
): Promise<Attestation> {
  const entry = registry.get(versionId);
  if (!entry) {
    throw new Error(`Version ${versionId} is not registered`);
  }
  if (entry.snapshot.id !== diagramId) {
    throw new Error(
      `Version ${versionId} belongs to diagram ${entry.snapshot.id}, not ${diagramId}`,
    );
  }
  const xml = new BpmnXmlConverter().toXml(entry.snapshot);
  const ledgerEntries = options.ledger
    ? 'getEntries' in options.ledger
      ? options.ledger.getEntries()
      : options.ledger.entries
    : [];
  const version = entry.version;
  return {
    diagramId,
    versionId,
    semanticVersion: version.semanticVersion,
    xmlHash: await sha256Hex(xml),
    ledgerHeadHash: ledgerEntries[ledgerEntries.length - 1]?.hash ?? '',
    status: version.status,
    ...(version.effectiveFrom !== undefined ? { effectiveFrom: version.effectiveFrom } : {}),
    approvers: [...version.approvedBy],
    attestedAt: options.attestedAt ?? new Date().toISOString(),
  };
}

/** The attestation's canonical JSON form — byte-stable for equal input. */
export function canonicalAttestation(attestation: Attestation): string {
  return canonicalJson(attestation);
}

/** SHA-256 over the canonical form — the id a host stores/publishes. */
export async function attestationHash(attestation: Attestation): Promise<string> {
  return sha256Hex(canonicalAttestation(attestation));
}
