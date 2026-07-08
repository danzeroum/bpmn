import { BpmnXmlConverter, type BpmnDiagram } from '@bpmn-react/core';
import { verifyLedger, type LedgerLike } from '@bpmn-react/audit';
import { certifyXml } from '@bpmn-react/conformance';
import { resolveCallActivities, type VersionRegistry } from '@bpmn-react/registry';
import { analyzeSoundness } from '@bpmn-react/soundness';

/**
 * The 2×2 "verificações automáticas" grid of the Revisão (Handoff 6 §5).
 * Every card is the result of a REAL call — evaluate/verify/certify/resolve —
 * never local state (criterion §10.4). Mocks exist only in tests.
 */
export interface ReviewCheck {
  id: 'soundness' | 'conformance' | 'ledger' | 'dependencies';
  label: string;
  ok: boolean;
  detail: string;
}

export interface ReviewChecksInput {
  diagram: BpmnDiagram;
  ledger: LedgerLike;
  /** Resolves call-activity references; omitted, the card reports "sem referências". */
  registry?: VersionRegistry;
  /** XML exporter — inject the host's configured converter for custom node types. */
  converter?: { toXml(diagram: BpmnDiagram): string };
  /** ISO clock for the dependency resolution window. */
  now?: () => string;
}

export async function runReviewChecks(input: ReviewChecksInput): Promise<ReviewCheck[]> {
  const { diagram, ledger, registry, converter, now = () => new Date().toISOString() } = input;
  const checks: ReviewCheck[] = [];

  const soundnessErrors = analyzeSoundness(diagram, { locale: 'pt' }).filter(
    (issue) => issue.severity === 'error',
  );
  checks.push({
    id: 'soundness',
    label: 'Soundness',
    ok: soundnessErrors.length === 0,
    detail:
      soundnessErrors.length === 0
        ? 'sem erros estruturais'
        : [...new Set(soundnessErrors.map((i) => i.code))].join(', '),
  });

  let conformance: ReviewCheck;
  try {
    const xml = (converter ?? new BpmnXmlConverter()).toXml(diagram);
    const report = certifyXml(xml);
    const ok = report.wellFormed && report.xxeSafe && report.achievedClass !== 'none';
    conformance = {
      id: 'conformance',
      label: 'Conformidade',
      ok,
      detail: ok ? `classe ${report.achievedClass}` : (report.parseError ?? 'classe none'),
    };
  } catch (error) {
    conformance = {
      id: 'conformance',
      label: 'Conformidade',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  checks.push(conformance);

  const report = await verifyLedger(ledger);
  checks.push({
    id: 'ledger',
    label: 'Ledger',
    ok: report.intact,
    detail: report.intact
      ? `cadeia íntegra (${report.entries}/${report.entries})`
      : `quebra na entrada ${report.firstBreak?.index}`,
  });

  const resolutions = registry ? resolveCallActivities(diagram, registry, now()) : [];
  const unresolved = resolutions.filter((r) => r.calledElement && !r.entry);
  checks.push({
    id: 'dependencies',
    label: 'Dependências',
    ok: unresolved.length === 0,
    detail:
      resolutions.length === 0
        ? 'sem referências externas'
        : unresolved.length === 0
          ? `${resolutions.length} referência(s) resolvida(s)`
          : `${unresolved.length} referência(s) quebrada(s)`,
  });

  return checks;
}
