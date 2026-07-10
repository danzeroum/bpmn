import { computeEntryHash, type AuditEntry, type AuditLedger } from '@buildtovalue/core';

/**
 * Full re-verification of a hash-chained audit ledger (Handoff 4 §B1).
 * `AuditLedger.verify()` answers valid/invalid for the live object; this
 * report makes integrity DEMONSTRABLE on demand — for exported ledgers,
 * third-party CI, and the react popover — including the exact break point
 * with the expected vs. found hash.
 */
export interface VerificationReport {
  intact: boolean;
  /** Total entries examined. */
  entries: number;
  /** First broken entry, when the chain does not verify. */
  firstBreak?: {
    index: number;
    expected: string;
    actual: string;
  };
  /** ISO timestamp of this verification run. */
  verifiedAt: string;
}

export type LedgerLike = AuditLedger | { entries: readonly AuditEntry[] };

function entriesOf(ledger: LedgerLike): readonly AuditEntry[] {
  return 'getEntries' in ledger ? ledger.getEntries() : ledger.entries;
}

/**
 * Recomputes every hash in the chain — the previous-hash linkage AND each
 * entry's own hash over the exported recipe (`computeEntryHash`) — and
 * reports the first break. Accepts a live `AuditLedger` or the plain
 * `{ entries }` shape of `ledger.export()` / a `ledger.json` file.
 */
export async function verifyLedger(ledger: LedgerLike): Promise<VerificationReport> {
  const entries = entriesOf(ledger);
  const verifiedAt = new Date().toISOString();
  let previousHash = '';
  for (const [index, entry] of entries.entries()) {
    if (entry.previousHash !== previousHash) {
      return {
        intact: false,
        entries: entries.length,
        firstBreak: { index, expected: previousHash, actual: entry.previousHash },
        verifiedAt,
      };
    }
    const expected = await computeEntryHash(entry);
    if (expected !== entry.hash) {
      return {
        intact: false,
        entries: entries.length,
        firstBreak: { index, expected, actual: entry.hash },
        verifiedAt,
      };
    }
    previousHash = entry.hash;
  }
  return { intact: true, entries: entries.length, verifiedAt };
}
