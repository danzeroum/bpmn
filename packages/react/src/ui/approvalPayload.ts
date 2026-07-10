import { BpmnXmlConverter, sha256Hex, type AuditLedger, type BpmnDiagram } from '@buildtovalue/core';
import { buildApprovalPayload, type CanonicalApprovalPayload } from '@buildtovalue/identity';

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
