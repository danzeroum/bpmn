import { useState } from 'react';
import { useT } from '../i18n/I18nContext.js';

/**
 * Structural mirror of `@buildtovalue/audit`'s VerificationReport — kept as a
 * local type so the react layer depends only on core; the host passes the
 * verifier in (same inversion as the registry in the PromotionPanel).
 */
export interface LedgerVerificationReport {
  intact: boolean;
  entries: number;
  firstBreak?: { index: number; expected: string; actual: string };
  verifiedAt: string;
}

export interface LedgerStatusProps {
  /** Runs the verification — typically `() => verifyLedger(ledger)`. */
  verify: () => Promise<LedgerVerificationReport> | LedgerVerificationReport;
}

/**
 * The "ledger íntegro ✓" chip, no longer decorative (Handoff 4 §B1):
 * clicking runs the host's verifier and shows the report in a popover —
 * intact chain with entry count, or the exact break point with the
 * expected vs. found hash.
 */
export function LedgerStatus({ verify }: LedgerStatusProps) {
  const t = useT();
  const [report, setReport] = useState<LedgerVerificationReport | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      setReport(await verify());
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="bpmnr-ledger-status">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        data-intact={report?.intact}
        aria-label={t('ledgerStatus.verify.aria')}
      >
        {report === null
          ? t('ledgerStatus.button.idle')
          : report.intact
            ? `${t('ledgerStatus.button.intact')} ✓`
            : `${t('ledgerStatus.button.broken')} ✗`}
      </button>
      {open && report && (
        <div className="bpmnr-ledger-popover" role="status" data-intact={report.intact}>
          {report.intact ? (
            <p>
              <strong>{t('ledgerStatus.chainIntact')} ✓</strong> —{' '}
              {t('ledgerStatus.entriesReverified', { count: report.entries })}
            </p>
          ) : (
            <>
              <p>
                <strong>{t('ledgerStatus.tamperDetected')} ✗</strong> —{' '}
                {t('ledgerStatus.entryOfTotal', {
                  index: report.firstBreak!.index,
                  total: report.entries,
                })}
              </p>
              <p className="bpmnr-ledger-hashes">
                {t('ledgerStatus.expected')} <code>{report.firstBreak!.expected.slice(0, 12)}…</code> ·{' '}
                {t('ledgerStatus.found')} <code>{report.firstBreak!.actual.slice(0, 12)}…</code>
              </p>
            </>
          )}
          <p className="bpmnr-ledger-meta">
            {t('ledgerStatus.verifiedAt', { time: report.verifiedAt })}
          </p>
          <button type="button" onClick={() => setOpen(false)} aria-label={t('ledgerStatus.close.aria')}>
            ×
          </button>
        </div>
      )}
    </span>
  );
}
