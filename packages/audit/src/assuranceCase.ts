import {
  canonicalJson,
  sha256Hex,
  type ApprovalRecord,
  type AuditEntry,
  type BpmnDiagram,
} from '@bpmn-react/core';
import { verifyLedger, type LedgerLike, type VerificationReport } from './verify.js';

/**
 * Spec label shown in the report header (§11.4 — parameterized, NEVER
 * hardcoded in the renderer). SACM 2.3 is the current formal version at
 * omg.org/spec/SACM (adopted October 2023), confirmed at implementation
 * time; hosts override via `AssuranceCaseOptions.specVersion` when OMG
 * publishes a newer one.
 */
export const SACM_SPEC_VERSION = 'SACM 2.3';

/**
 * Above this many evidence rows per argument the report body collapses the
 * group into "N evidências · faixa de hashes #x…#y" and moves the full rows
 * to the annex (§11.2).
 */
export const EVIDENCE_COLLAPSE_THRESHOLD = 20;

/** One SACM evidence element — always a hash-bearing derived record. */
export interface AssuranceEvidence {
  id: string;
  /** Content hash: the ledger entry hash, or the canonical approval hash. */
  hash: string;
  /** Derived caption (entry type / approval role) — never free text. */
  kind: string;
  at: string;
  actor: string;
}

/** One SACM argument (A1, A2, …) grouping the evidence that supports it. */
export interface AssuranceArgument {
  id: string;
  statement: string;
  evidence: AssuranceEvidence[];
}

/** One SACM claim; unsupported claims render "não sustentado" (10.5.8). */
export interface AssuranceClaim {
  id: string;
  statement: string;
  argumentId: string;
  supported: boolean;
}

export interface AssuranceCase {
  /** Header spec label — parameterized (§11.4). */
  spec: string;
  diagramId: string;
  diagramName: string;
  semanticVersion: string;
  status: string;
  claims: AssuranceClaim[];
  arguments: AssuranceArgument[];
  approvers: ApprovalRecord[];
  /** SHA-256 chain verification — RUNS at generation time (10.5.8). */
  verification: VerificationReport;
  /** Hash of the chain head ('' when the ledger is empty). */
  ledgerHeadHash: string;
  generatedAt: string;
}

export interface AssuranceCaseOptions {
  specVersion?: string;
  /** Timestamp override for deterministic output (tests, reproducible CI). */
  generatedAt?: string;
}

function entriesOf(ledger: LedgerLike): readonly AuditEntry[] {
  return 'getEntries' in ledger ? ledger.getEntries() : ledger.entries;
}

const PROMOTION_TYPES = /VERSION|PROMOT|ATTEST|APPROV|ACTIVAT/;

async function approvalEvidence(approval: ApprovalRecord): Promise<AssuranceEvidence> {
  return {
    id: `approval:${approval.userId}:${approval.role}`,
    hash: await sha256Hex(canonicalJson(approval)),
    kind: `aprovação · ${approval.role}`,
    at: approval.approvedAt,
    actor: approval.userId,
  };
}

function entryEvidence(entry: AuditEntry): AssuranceEvidence {
  return {
    id: entry.id,
    hash: entry.hash,
    kind: entry.type,
    at: entry.timestamp,
    actor: entry.userId,
  };
}

/**
 * Builds the assurance case 100% from governance records (aceite 10.5.8):
 * claims and argument statements are canonical templates instantiated with
 * version identity; every evidence row is a ledger entry or a promotion
 * approval — *"Todo conteúdo do assurance case é derivado do ledger, nunca
 * digitado"* (invariante do gerador, Handoff 5 §11). The SHA-256 chain
 * verification runs here and lands in the report footer.
 */
export async function buildAssuranceCase(
  diagram: BpmnDiagram,
  ledger: LedgerLike,
  options: AssuranceCaseOptions = {},
): Promise<AssuranceCase> {
  const entries = entriesOf(ledger);
  const verification = await verifyLedger(ledger);
  const version = diagram.version;

  const promotionEntries = entries.filter((entry) => PROMOTION_TYPES.test(entry.type));
  const commandEntries = entries.filter((entry) => !PROMOTION_TYPES.test(entry.type));

  const a1: AssuranceArgument = {
    id: 'A1',
    statement: `A promoção da v${version.semanticVersion} passou pelos gates formais da state machine, com aprovação multi-papel registrada.`,
    evidence: [
      ...(await Promise.all(version.approvedBy.map(approvalEvidence))),
      ...promotionEntries.map(entryEvidence),
    ],
  };
  const a2: AssuranceArgument = {
    id: 'A2',
    statement:
      'Toda mudança de conteúdo foi um comando auditado na cadeia hash-encadeada — nenhuma edição fora do CommandStack.',
    evidence: commandEntries.map(entryEvidence),
  };

  const claims: AssuranceClaim[] = [
    {
      id: 'C1',
      statement: `A versão ${version.semanticVersion} de “${diagram.name}” foi aprovada formalmente.`,
      argumentId: 'A1',
      supported: a1.evidence.length > 0,
    },
    {
      id: 'C2',
      statement: `O conteúdo da versão ${version.semanticVersion} é integralmente rastreável a comandos auditados.`,
      argumentId: 'A2',
      supported: a2.evidence.length > 0,
    },
  ];

  return {
    spec: options.specVersion ?? SACM_SPEC_VERSION,
    diagramId: diagram.id,
    diagramName: diagram.name,
    semanticVersion: version.semanticVersion,
    status: version.status,
    claims,
    arguments: [a1, a2],
    approvers: version.approvedBy,
    verification,
    ledgerHeadHash: entries.length > 0 ? entries[entries.length - 1].hash : '',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
  };
}
