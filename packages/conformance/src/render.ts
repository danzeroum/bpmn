import {
  classCoverage,
  CONFORMANCE_MATRIX,
  type ConformanceEntry,
} from './matrix.js';

const STATUS_BADGE: Record<ConformanceEntry['status'], string> = {
  supported: '✅ supported',
  partial: '🟡 partial',
  degraded: '🟠 degraded',
  unsupported: '⛔ unsupported',
};

/**
 * Renders CONFORMANCE.md deterministically from the matrix. The committed
 * file is compared against this output in CI (freshness test): editing the
 * matrix without regenerating the document fails the build.
 */
export function renderConformanceMarkdown(entries: ConformanceEntry[] = CONFORMANCE_MATRIX): string {
  const descriptive = classCoverage(entries, 'descriptive');
  const analytic = classCoverage(entries, 'analytic');
  const lines: string[] = [
    '# BPMN 2.0 Conformance',
    '',
    '<!-- GENERATED FILE — do not edit by hand.',
    '     Source of truth: packages/conformance/src/matrix.ts',
    '     Regenerate with: node scripts/gen-conformance.mjs -->',
    '',
    'Element-by-element conformance of the bpmn-react import/export profile',
    '(`@bpmn-react/core` BpmnXmlConverter). Statuses: **supported** — imports,',
    'renders, exports and round-trips losslessly; **partial** — model and',
    'round-trip work, some interactions pending; **degraded** — imported with a',
    'warning and downgraded; **unsupported** — ignored on import with a warning.',
    '',
    `- **Descriptive class: ${descriptive}%**${descriptive === 100 ? ' — declarable ✅' : ''}`,
    `- **Analytic class: ${analytic}%**`,
    '',
    '| Element | Status | Class | Maps to | Notes |',
    '|---|---|---|---|---|',
  ];
  for (const entry of entries) {
    lines.push(
      `| \`${entry.element}\` | ${STATUS_BADGE[entry.status]} | ${entry.conformanceClass} | ${
        entry.mappedTo ? `\`${entry.mappedTo}\`` : '—'
      } | ${entry.notes ?? ''} |`,
    );
  }
  lines.push(
    '',
    'Interoperability is exercised by the corpus in `packages/conformance/corpus/`',
    '(structural equivalents of Camunda Modeler / bpmn.io / OMG-spec exports —',
    'see each file header): every file must import without a fatal error and the',
    're-export must re-import identically (`normalizeForDiff`); the per-file',
    'warning counts are snapshotted so fidelity regressions are detectable.',
    '',
  );
  return lines.join('\n');
}
