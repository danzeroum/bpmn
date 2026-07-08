import { useEffect, useRef, useState } from 'react';
import { AuditLedger, type AuditEntry } from '@bpmn-react/core';
import { useDiagram } from '@bpmn-react/react';

/**
 * Live audit trail: every command on the stack is appended to a hash-chained
 * ledger; the verify button re-walks the whole chain. Pass a shared `ledger`
 * so other panels (e.g. the promotion flow) write into the same chain.
 */
export function AuditPanel({ ledger: sharedLedger }: { ledger?: AuditLedger } = {}) {
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
        </button>
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
