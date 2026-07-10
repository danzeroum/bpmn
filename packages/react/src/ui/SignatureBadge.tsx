import type { SignerIdentity, VerificationState } from '@buildtovalue/identity';
import { useT } from '../i18n/I18nContext.js';

/**
 * Identity badge (Handoff 8 §4.1): replaces the loose approver name with a
 * cryptographic verification state. Same contract as `StatusBadge` — the pill
 * carries an icon glyph AND a text label (state never by color alone), and
 * colors live in `styles.css` keyed by `[data-verification]`. The negative
 * path (`invalid`) renders in `--btv-error` with the expected × obtained hashes.
 */
export const VERIFICATION_GLYPHS: Record<VerificationState, string> = {
  valid: '✓',
  legacy: '◌',
  invalid: '✕',
};

export const VERIFICATION_LABELS: Record<VerificationState, string> = {
  valid: 'ASSINADA · VERIFICADA',
  legacy: 'NÃO ASSINADA (LEGADO)',
  invalid: 'ASSINATURA INVÁLIDA',
};

export interface SignatureBadgeProps {
  state: VerificationState;
  /** Signer identity to show below the pill (subject · role). */
  signer?: SignerIdentity;
  /** Signature fingerprint (mono), shown for the verified state. */
  signatureFingerprint?: string;
  /** For the invalid state: the expected signature/hash. */
  expected?: string;
  /** For the invalid state: what the current payload actually produces. */
  obtained?: string;
}

/**
 * Renders one of the three identity states (`valid` | `legacy` | `invalid`)
 * produced by `verificationState()` in `@buildtovalue/identity`.
 */
export function SignatureBadge({
  state,
  signer,
  signatureFingerprint,
  expected,
  obtained,
}: SignatureBadgeProps) {
  const t = useT();
  const label = t(`signature.${state}`);
  return (
    <span
      className="bpmnr-signature-badge"
      data-verification={state}
      role="status"
      aria-label={t('signature.aria', { label })}
    >
      <span className="bpmnr-signature-pill">
        <span className="bpmnr-signature-glyph" aria-hidden>
          {VERIFICATION_GLYPHS[state]}
        </span>
        {label}
      </span>
      {signer && (
        <span className="bpmnr-signature-signer">
          {signer.subject} · {signer.role}
        </span>
      )}
      {state === 'valid' && signatureFingerprint && (
        <code className="bpmnr-signature-fingerprint">{signatureFingerprint}</code>
      )}
      {state === 'invalid' && (expected || obtained) && (
        <code className="bpmnr-signature-mismatch">
          {t('signature.mismatch', { expected: expected ?? '—', obtained: obtained ?? '—' })}
        </code>
      )}
    </span>
  );
}
