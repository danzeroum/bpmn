import type { AnchorState } from '@buildtovalue/identity';

/**
 * Anchor seal (Handoff 8 §4.2): the external-anchor state of the chain head.
 * Same contract as the other badges — pill with icon glyph + label (never color
 * alone), colors keyed by `[data-anchor]` in styles.css; the negative path
 * (`broken`) uses `--btv-error`. The `pending` third state (cerca §1.3) declares
 * the guarantee in force and offers a retry — it never regresses the promotion.
 */
export const ANCHOR_GLYPHS: Record<AnchorState, string> = {
  anchored: '✓',
  pending: '⏳',
  none: '—',
  broken: '✕',
};

export const ANCHOR_LABELS: Record<AnchorState, string> = {
  anchored: 'ANCORADA',
  pending: 'PENDENTE',
  none: 'SEM ÂNCORA CONFIGURADA',
  broken: 'CADEIA ≠ ÂNCORA',
};

export interface AnchorSealProps {
  state: AnchorState;
  /** Adapter id shown in the anchored seal ("git", "rfc3161", "s3"). */
  adapterId?: string;
  /** Local chain head hash (shown short). */
  head?: string;
  /** Anchored head hash, for the mismatch (broken) comparison. */
  anchoredHead?: string;
  /** Retry handler for the pending state (↻ Retentar ancoragem). */
  onRetry?: () => void;
  /** True while an anchoring attempt is in flight. */
  retrying?: boolean;
}

function short(hash: string | undefined): string {
  return hash ? `#${hash.slice(0, 8)}` : '#—';
}

export function AnchorSeal({ state, adapterId, head, anchoredHead, onRetry, retrying }: AnchorSealProps) {
  const label = ANCHOR_LABELS[state];
  return (
    <div className="bpmnr-anchor-seal" data-anchor={state} role="status" aria-label={`Âncora: ${label}`}>
      <span className="bpmnr-anchor-pill">
        <span className="bpmnr-anchor-glyph" aria-hidden>
          {ANCHOR_GLYPHS[state]}
        </span>
        {label}
      </span>
      {state === 'anchored' && (
        <span className="bpmnr-anchor-detail">
          ancorado: {adapterId ?? 'externo'} · head {short(head)}
        </span>
      )}
      {state === 'pending' && (
        <>
          <span className="bpmnr-anchor-detail">
            garantia vigente: assinaturas + hash-chain local
          </span>
          {onRetry && (
            <button
              type="button"
              className="bpmnr-anchor-retry"
              disabled={retrying}
              onClick={onRetry}
            >
              {retrying ? 'retentando…' : '↻ Retentar ancoragem'}
            </button>
          )}
        </>
      )}
      {state === 'broken' && (
        <span className="bpmnr-anchor-detail">
          local {short(head)} ≠ ancorado {short(anchoredHead)}
        </span>
      )}
    </div>
  );
}
