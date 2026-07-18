import { BpmnXmlConverter, sha256Hex, type AuditLedger, type BpmnDiagram } from '@buildtovalue/core';
import {
  buildApprovalPayload,
  buildChangeRequestPayload,
  type CanonicalApprovalPayload,
  type CanonicalChangeRequestPayload,
} from '@buildtovalue/identity';

export interface ApprovalPayloadInput {
  diagram: BpmnDiagram;
  /** The ledger whose head the approval binds to; omitted → empty head. */
  ledger?: AuditLedger;
  /** Governance decision, e.g. "approve". */
  decision: string;
  /** Role asserted for the approval. */
  role: string;
  /**
   * Host XML exporter (Studio injects its configured converter). Defaults to
   * core's `BpmnXmlConverter` so the react surface works without one.
   */
  toXml?: (diagram: BpmnDiagram) => string;
}

/**
 * Assemble the canonical approval payload from a live diagram + ledger — the
 * `xmlHash` and `ledgerHead` the signature binds (Handoff 8 §3). Shared by the
 * PromotionPanel and the Studio ReviewScreen so both sign identical bytes.
 * `xmlHash` reuses core's `sha256Hex`; the payload shape comes from
 * `buildApprovalPayload` in `@buildtovalue/identity`.
 */
export async function buildApprovalPayloadFor(
  input: ApprovalPayloadInput,
): Promise<CanonicalApprovalPayload> {
  const { diagram, ledger, decision, role } = input;
  const toXml = input.toXml ?? ((d: BpmnDiagram) => new BpmnXmlConverter().toXml(d));
  const xmlHash = await sha256Hex(toXml(diagram));
  const ledgerHead = ledger?.getEntries().at(-1)?.hash ?? '';
  return buildApprovalPayload({
    diagramId: diagram.id,
    version: diagram.version.semanticVersion,
    xmlHash,
    ledgerHead,
    decision,
    role,
  });
}

export interface ChangeRequestPayloadInput extends Omit<ApprovalPayloadInput, 'decision'> {
  /** Ids of the OPEN threads attached to the request. */
  threadRefs: readonly string[];
  /** Mandatory reviewer comment the signature binds. */
  justification: string;
}

/**
 * Assemble the canonical request-changes payload (Handoff 15 §2e) — the same
 * `xmlHash`/`ledgerHead` binding as the approval, plus the version entity id,
 * the attached open threads and the mandatory comment. Decision is always
 * `"request-changes"` so verifiers can tell the acts apart.
 */
export async function buildChangeRequestPayloadFor(
  input: ChangeRequestPayloadInput,
): Promise<CanonicalChangeRequestPayload> {
  const base = await buildApprovalPayloadFor({ ...input, decision: 'request-changes' });
  return buildChangeRequestPayload({
    ...base,
    versionRef: input.diagram.version.id,
    threadRefs: [...input.threadRefs],
    justification: input.justification,
  });
}
