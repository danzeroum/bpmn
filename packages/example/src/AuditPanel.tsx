import { useEffect, useRef, useState } from 'react';
import { verifyLedger } from '@bpmn-react/audit';
import { AuditLedger, type AuditEntry } from '@bpmn-react/core';
import { LedgerStatus, useDiagram } from '@bpmn-react/react';

/**
 * Live audit trail: every command on the stack is appended to a hash-chained
 * ledger; the verify button re-walks the whole chain. Pass a shared `ledger`
 * so other panels (e.g. the promotion flow) write into the same chain.
 */
export function AuditPanel({
  ledger: sharedLedger,
  refreshToken = 0,
}: { ledger?: AuditLedger; refreshToken?: number } = {}) {
  const { stack } = useDiagram();
  const ledgerRef = useRef<AuditLedger | null>(null);
  if (ledgerRef.current === null) ledgerRef.current = sharedLedger ?? new AuditLedger();
  const ledger = ledgerRef.current;

  const [entries, setEntries] = useState<readonly AuditEntry[]>([]);
  const [verified, setVerified] = useState<string | null>(null);

  useEffect(() => {
    const off = ledger.connectCommandStack(stack, { id: 'demo-user', role: 'editor' });
    const refresh = stack.subscribe(async () => {
      await ledger.flush();
      setEntries([...ledger.getEntries()]);
    });
    return () => {
      off();
      refresh();
    };
  }, [ledger, stack]);

  // Entries appended OUTSIDE the command stack (promotion, attestation)
  // arrive via the refresh token bumped by the governance panel.
  useEffect(() => {
    let stale = false;
    void ledger.flush().then(() => {
      if (!stale) setEntries([...ledger.getEntries()]);
    });
    return () => {
      stale = true;
    };
  }, [ledger, refreshToken]);

  const verify = async () => {
    const result = await ledger.verify();
    setVerified(result.valid ? '✓ chain intact' : `✗ broken at entry ${result.brokenAt}`);
  };

  return (
    <aside className="demo-audit" aria-label="Audit ledger">
      <h3>
        Audit ledger{' '}
        <button type="button" onClick={verify}>
          verify
        </button>{' '}
        <LedgerStatus verify={() => verifyLedger(ledger)} />
      </h3>
      {verified && <p className="demo-muted">{verified}</p>}
      <ol reversed>
        {[...entries]
          .slice(-12)
          .reverse()
          .map((entry) => (
            <li key={entry.id} title={`hash ${entry.hash.slice(0, 16)}…`}>
              <code>{entry.type}</code>{' '}
              <span className="demo-muted">{String(entry.details.description ?? '')}</span>
            </li>
          ))}
        {entries.length === 0 && <li className="demo-muted">no entries yet — edit the diagram</li>}
      </ol>
    </aside>
  );
}
