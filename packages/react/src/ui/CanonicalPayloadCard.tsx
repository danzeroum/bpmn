import type { CanonicalApprovalPayload } from '@bpmn-react/identity';

/**
 * "O que você está assinando" card (Handoff 8 §4.3, design card C): shows the
 * canonical payload BEFORE signing so the user sees exactly what the signature
 * covers. Always rendered above the sign button.
 */
export interface CanonicalPayloadCardProps {
  payload: CanonicalApprovalPayload;
}

/** `abcdef012…` → `#abcdef…`; empty (no ledger head yet) → `∅`. */
function shortHash(hash: string): string {
  return hash ? `#${hash.slice(0, 6)}…` : '∅';
}

export function CanonicalPayloadCard({ payload }: CanonicalPayloadCardProps) {
  return (
    <section className="bpmnr-canonical-payload" data-testid="canonical-payload">
      <p className="bpmnr-canonical-payload-kicker">O QUE VOCÊ ESTÁ ASSINANDO (PAYLOAD CANÔNICO)</p>
      <div className="bpmnr-canonical-payload-box">
        <div>
          diagrama: {payload.diagramId} · versão: {payload.version}
        </div>
        <div>
          xmlHash: {shortHash(payload.xmlHash)} · ledgerHead: {shortHash(payload.ledgerHead)}
        </div>
        <div>
          decisão: {payload.decision.toUpperCase()} (papel {payload.role})
        </div>
      </div>
      <p className="bpmnr-canonical-payload-note">
        A assinatura cobre o hash do XML + o head da cadeia — qualquer mudança posterior invalida a
        verificação, detectável por qualquer terceiro.
      </p>
    </section>
  );
}
