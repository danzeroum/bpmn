import { readFile, writeFile } from 'node:fs/promises';
import {
  certifyXml,
  type CertifiableClass,
  type CertifyReport,
} from '@bpmn-react/conformance';

export interface CertifyCommandOptions {
  require?: CertifiableClass;
  /** Write the JSON report to this path (e.g. certify-report.json). */
  report?: string;
}

/** `bpmn-react certify <file>` — conformance certificate for third-party CI. */
export async function certifyCommand(
  path: string,
  options: CertifyCommandOptions = {},
): Promise<CertifyReport> {
  const xml = await readFile(path, 'utf8');
  const report = certifyXml(xml, { require: options.require });
  if (options.report) {
    await writeFile(options.report, JSON.stringify(report, null, 2) + '\n', 'utf8');
  }
  return report;
}

const OK = '✔';
const WARN = '⚠';
const FAIL = '✖';

/** Human-readable certificate (the --json flag prints the raw report instead). */
export function formatCertify(report: CertifyReport, reportPath?: string): string {
  const lines: string[] = [];
  if (!report.wellFormed) {
    lines.push(
      report.xxeSafe
        ? `${FAIL} XML mal-formado: ${report.parseError ?? 'parse error'}`
        : `${FAIL} Rejeitado: ${report.parseError ?? 'DOCTYPE'} (XXE-safe)`,
    );
    return lines.join('\n');
  }
  lines.push(`${OK} XML bem-formado · XXE-safe`);
  lines.push(
    `${OK} Perfil: Descriptive ${report.matrixCoverage.descriptive}% · Analytic ${report.matrixCoverage.analytic}%`,
  );
  lines.push(
    report.roundTripLossless ? `${OK} Round-trip lossless` : `${FAIL} Round-trip com perdas`,
  );
  if (report.structuralIssues.length > 0) {
    lines.push(`${FAIL} ${report.structuralIssues.length} problema(s) estruturais:`);
    for (const issue of report.structuralIssues) lines.push(`   ${issue.code}: ${issue.message}`);
  }
  if (report.unsupportedElements.length > 0) {
    lines.push(`${WARN} Elementos fora do perfil: ${report.unsupportedElements.join(', ')}`);
  }
  if (report.importWarnings.length > 0) {
    lines.push(`${WARN} ${report.importWarnings.length} warning(s):`);
    for (const warning of report.importWarnings) lines.push(`   ${warning}`);
  }
  const classLabel =
    report.achievedClass === 'none' ? 'NENHUMA' : report.achievedClass.toUpperCase();
  const met =
    report.requirementMet === undefined ? '' : report.requirementMet ? ` ${OK}` : ` ${FAIL}`;
  lines.push(
    `Classe certificável: ${classLabel}${met}${reportPath ? ` · relatório: ${reportPath}` : ''}`,
  );
  return lines.join('\n');
}
