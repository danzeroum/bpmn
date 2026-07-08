import { readFile } from 'node:fs/promises';
import type { AuditEntry } from '@bpmn-react/core';
import { verifyLedger, type VerificationReport } from '@bpmn-react/audit';

/**
 * `bpmn-react audit <ledger.json>` (Handoff 4 §B1): re-verifies an exported
 * hash-chained ledger so third parties can prove integrity in CI. The file
 * is the `AuditLedger.export()` shape: `{ "entries": [...] }`.
 */
export async function auditCommand(path: string): Promise<VerificationReport> {
  const raw = await readFile(path, 'utf8');
  let data: { entries?: AuditEntry[] };
  try {
    data = JSON.parse(raw) as { entries?: AuditEntry[] };
  } catch (cause) {
    throw new Error(`${path} is not valid JSON: ${(cause as Error).message}`);
  }
  if (!Array.isArray(data.entries)) {
    throw new Error(`${path} is not an exported ledger (missing "entries" array)`);
  }
  return verifyLedger({ entries: data.entries });
}

/** Human report for the audit command (use --json for the raw object). */
export function formatAudit(report: VerificationReport): string {
  if (report.intact) {
    return [
      `Ledger íntegro ✓ — ${report.entries} entrada(s), cadeia de hashes verificada.`,
      `Verificado em ${report.verifiedAt}.`,
    ].join('\n');
  }
  const brk = report.firstBreak!;
  return [
    `Ledger QUEBRADO ✗ — adulteração detectada na entrada #${brk.index} de ${report.entries}.`,
    `  esperado: ${brk.expected}`,
    `  encontrado: ${brk.actual}`,
    `Verificado em ${report.verifiedAt}.`,
  ].join('\n');
}
