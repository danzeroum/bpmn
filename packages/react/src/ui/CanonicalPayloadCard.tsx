import type { CanonicalApprovalPayload } from '@buildtovalue/identity';
import { useT } from '../i18n/I18nContext.js';

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
  const t = useT();
  return (
    <section className="bpmnr-canonical-payload" data-testid="canonical-payload">
      <p className="bpmnr-canonical-payload-kicker">{t('payload.kicker')}</p>
      <div className="bpmnr-canonical-payload-box">
        <div>{t('payload.identity', { id: payload.diagramId, version: payload.version })}</div>
        <div>
          xmlHash: {shortHash(payload.xmlHash)} · ledgerHead: {shortHash(payload.ledgerHead)}
        </div>
        <div>
          {t('payload.decision', {
            decision: payload.decision.toUpperCase(),
            role: payload.role,
          })}
        </div>
      </div>
      <p className="bpmnr-canonical-payload-note">{t('payload.note')}</p>
    </section>
  );
}
