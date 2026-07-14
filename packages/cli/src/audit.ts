import { readFile, writeFile } from 'node:fs/promises';
import { BpmnParseError, type AuditEntry } from '@buildtovalue/core';
import { toXES, verifyLedger, type VerificationReport } from '@buildtovalue/audit';
import { loadRegistry } from './registry.js';

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
    throw new BpmnParseError(`${path} is not valid JSON: ${(cause as Error).message}`);
  }
  if (!Array.isArray(data.entries)) {
    throw new BpmnParseError(`${path} is not an exported ledger (missing "entries" array)`);
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

async function readLedgerFile(path: string): Promise<{ entries: AuditEntry[] }> {
  const raw = await readFile(path, 'utf8');
  let data: { entries?: AuditEntry[] };
  try {
    data = JSON.parse(raw) as { entries?: AuditEntry[] };
  } catch (cause) {
    throw new BpmnParseError(`${path} is not valid JSON: ${(cause as Error).message}`);
  }
  if (!Array.isArray(data.entries)) {
    throw new BpmnParseError(`${path} is not an exported ledger (missing "entries" array)`);
  }
  return { entries: data.entries };
}

/**
 * `bpmn-react export-xes <ledger.json> [--registry <registry.json>] [-o out.xes]`
 * (Handoff 4 §B2): converts the governance history to IEEE XES 2.0 so the
 * real design process can be mined in ProM/Celonis/Disco.
 */
export async function exportXesCommand(
  ledgerPath: string,
  options: { registryPath?: string; output?: string } = {},
): Promise<string> {
  const ledger = await readLedgerFile(ledgerPath);
  const registry = options.registryPath ? await loadRegistry(options.registryPath) : undefined;
  const xes = toXES(ledger, registry ? { registry } : {});
  if (options.output) await writeFile(options.output, xes, 'utf8');
  return xes;
}
