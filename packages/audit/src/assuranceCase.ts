import {
  canonicalJson,
  sha256Hex,
  type ApprovalRecord,
  type AuditEntry,
  type BpmnDiagram,
} from '@bpmn-react/core';
import { verificationState, type AnchorState, type VerificationState } from '@bpmn-react/identity';
import { verifyLedger, type LedgerLike, type VerificationReport } from './verify.js';
import { collectSignedApprovals, type PublicKeyResolver } from './signatures.js';

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

/**
 * An approver enriched with the verification of their signature (Handoff 8 §4.1).
 * `legacy` = no signature recorded (or none verifiable); the SACM declares the
 * lesser guarantee. `invalid` un-sustains the formal-approval claim.
 */
export interface SignedApproverInfo {
  userId: string;
  role: string;
  state: VerificationState;
  /** Short signature fingerprint, when signed. */
  fingerprint?: string;
}

/** Anchor line for the report footer (Handoff 8 §4.2). */
export interface AssuranceAnchor {
  state: AnchorState;
  adapterId?: string;
  head?: string;
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
  /** Approvers with their signature verification state (Handoff 8 §4.1). */
  signedApprovers: SignedApproverInfo[];
  /** External-anchor line, when the host passes one (Handoff 8 §4.2). */
  anchor?: AssuranceAnchor;
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
  /**
   * Resolves signer public keys so recorded signatures are re-verified in the
   * report (Handoff 8 §4.1). Omitted → signatures are not verified and approvers
   * read as "não assinada (legado)".
   */
  resolvePublicKey?: PublicKeyResolver;
  /** External-anchor state to declare in the footer (Handoff 8 §4.2). */
  anchor?: AssuranceAnchor;
}

/** `ed25519:#0b9a…f21c` — short signature fingerprint. */
function fingerprintOf(signature: string): string {
  return `ed25519:#${signature.slice(0, 4)}…${signature.slice(-4)}`;
}

function entriesOf(ledger: LedgerLike): readonly AuditEntry[] {
  return 'getEntries' in ledger ? ledger.getEntries() : ledger.entries;
}

const PROMOTION_TYPES = /VERSION|PROMOT|ATTEST|APPROV|ACTIVAT/;
/** Registered simulation sessions (Handoff 7A-3) — their own argument A3. */
const SIMULATION_TYPES = /SIMULATION/;

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
 * Evidence for a registered simulation session — the caption is *derived* from
 * the entry's own recorded details (coverage counts + roteiro hash), never
 * typed by a human, so the "nunca digitado" invariant holds (Handoff 7A-3).
 */
function simulationEvidence(entry: AuditEntry): AssuranceEvidence {
  const covered = Number(entry.details.covered) || 0;
  const total = Number(entry.details.total) || 0;
  const roteiroHash = typeof entry.details.roteiroHash === 'string' ? entry.details.roteiroHash : '';
  const paths = `${covered}/${total} caminhos`;
  return {
    id: entry.id,
    hash: entry.hash,
    kind: roteiroHash
      ? `comportamento validado · ${paths} · roteiro #${roteiroHash}`
      : `comportamento validado · ${paths}`,
    at: entry.timestamp,
    actor: entry.userId,
  };
}

/**
 * Builds the assurance case 100% from governance records (aceite 10.5.8):
 * claims and argument statements are canonical templates instantiated with
 * version identity; every evidence row is a ledger entry or a promotion
 * approval — *"Todo conteúdo do assurance case é derivado do ledger, nunca
 * digitado — e assinada quando a instalação suporta"* (invariante do gerador,
 * Handoff 5 §11 estendido no Handoff 8 §4.4). The SHA-256 chain verification
 * runs here; when a public-key resolver is passed, each approver's recorded
 * signature is re-verified and an invalid one un-sustains the approval claim.
 */
export async function buildAssuranceCase(
  diagram: BpmnDiagram,
  ledger: LedgerLike,
  options: AssuranceCaseOptions = {},
): Promise<AssuranceCase> {
  const entries = entriesOf(ledger);
  const verification = await verifyLedger(ledger);
  const version = diagram.version;

  // Enrich approvers with their signature state (Handoff 8 §4.1). Matches a
  // recorded SignedApproval to each approval by role; verifies it when the host
  // provides a public-key resolver, else declares the lesser "legacy" guarantee.
  const signedApprovals = collectSignedApprovals(ledger, version.id);
  const signedApprovers: SignedApproverInfo[] = [];
  for (const record of version.approvedBy) {
    const signed = signedApprovals.find((s) => s.payload.role === record.role);
    if (!signed || !options.resolvePublicKey) {
      signedApprovers.push({ userId: record.userId, role: record.role, state: 'legacy' });
      continue;
    }
    const publicKey = await options.resolvePublicKey(signed.signer.publicKeyFingerprint);
    signedApprovers.push({
      userId: record.userId,
      role: record.role,
      state: await verificationState(signed, publicKey ?? undefined),
      fingerprint: fingerprintOf(signed.signature),
    });
  }
  const anySignatureInvalid = signedApprovers.some((a) => a.state === 'invalid');

  const simulationEntries = entries.filter((entry) => SIMULATION_TYPES.test(entry.type));
  const promotionEntries = entries.filter(
    (entry) => PROMOTION_TYPES.test(entry.type) && !SIMULATION_TYPES.test(entry.type),
  );
  const commandEntries = entries.filter(
    (entry) => !PROMOTION_TYPES.test(entry.type) && !SIMULATION_TYPES.test(entry.type),
  );

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
      // A recorded signature that fails verification un-sustains the claim (§4.1).
      supported: a1.evidence.length > 0 && !anySignatureInvalid,
    },
    {
      id: 'C2',
      statement: `O conteúdo da versão ${version.semanticVersion} é integralmente rastreável a comandos auditados.`,
      argumentId: 'A2',
      supported: a2.evidence.length > 0,
    },
  ];

  const argumentList: AssuranceArgument[] = [a1, a2];

  // A3/C3 appear only when the version has a registered simulation session
  // (aceite §7.7 — "certify inclui a evidence de cobertura quando existir").
  if (simulationEntries.length > 0) {
    const a3: AssuranceArgument = {
      id: 'A3',
      statement: `O comportamento modelado da versão ${version.semanticVersion} foi validado por simulação de tokens — caminhos estruturais exercitados e registrados como roteiros auditáveis.`,
      evidence: simulationEntries.map(simulationEvidence),
    };
    argumentList.push(a3);
    claims.push({
      id: 'C3',
      statement: `O comportamento da versão ${version.semanticVersion} foi validado por simulação (roteiros de cobertura registrados no ledger).`,
      argumentId: 'A3',
      supported: a3.evidence.length > 0,
    });
  }

  return {
    spec: options.specVersion ?? SACM_SPEC_VERSION,
    diagramId: diagram.id,
    diagramName: diagram.name,
    semanticVersion: version.semanticVersion,
    status: version.status,
    claims,
    arguments: argumentList,
    approvers: version.approvedBy,
    signedApprovers,
    ...(options.anchor ? { anchor: options.anchor } : {}),
    verification,
    ledgerHeadHash: entries.length > 0 ? entries[entries.length - 1].hash : '',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
  };
}
