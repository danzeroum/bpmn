import { useState } from 'react';

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
        aria-label="Verificar ledger"
      >
        {report === null ? 'ledger · verificar' : report.intact ? 'ledger íntegro ✓' : 'ledger quebrado ✗'}
      </button>
      {open && report && (
        <div className="bpmnr-ledger-popover" role="status" data-intact={report.intact}>
          {report.intact ? (
            <p>
              <strong>Cadeia íntegra ✓</strong> — {report.entries} entrada(s) reverificadas.
            </p>
          ) : (
            <>
              <p>
                <strong>Adulteração detectada ✗</strong> — entrada #{report.firstBreak!.index} de{' '}
                {report.entries}.
              </p>
              <p className="bpmnr-ledger-hashes">
                esperado <code>{report.firstBreak!.expected.slice(0, 12)}…</code> · encontrado{' '}
                <code>{report.firstBreak!.actual.slice(0, 12)}…</code>
              </p>
            </>
          )}
          <p className="bpmnr-ledger-meta">verificado em {report.verifiedAt}</p>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar relatório">
            ×
          </button>
        </div>
      )}
    </span>
  );
}
