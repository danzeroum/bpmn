import {
  classCoverage,
  CONFORMANCE_MATRIX,
  type ConformanceEntry,
} from './matrix.js';
import {
  EXTERNAL_CORPUS_MAX,
  EXTERNAL_CORPUS_MIN,
  EXTERNAL_CORPUS_SOURCES,
  GENERATED_CORPUS_FILES,
} from './corpusPolicy.js';

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
    '(`@buildtovalue/core` BpmnXmlConverter). Statuses: **supported** — imports,',
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
    '## Corpus real vs gerado (Handoff 11 N-2)',
    '',
    `- **Gerados (commitados):** ${GENERATED_CORPUS_FILES} arquivos em \`corpus/\` — equivalentes`,
    '  estruturais, zero material proprietário.',
    `- **Reais (fetch em CI):** ≥ ${EXTERNAL_CORPUS_MIN} exigidos pelo gate (cap ${EXTERNAL_CORPUS_MAX}), baixados por`,
    '  `pnpm fetch:corpus` para `corpus-external/` (git-ignorado) a partir de:',
    ...EXTERNAL_CORPUS_SOURCES.map((s) => `  - \`${s.name}\` (${s.license})`),
    '- **Proveniência:** origem + licença POR ARQUIVO vivem no `corpus-external/MANIFEST.json`,',
    '  nunca como header dentro do arquivo — a suíte de round-trip exercita os bytes',
    '  exatos do upstream, e um header os alteraria (decisão em pendencias.md §13).',
    '',
    '## `certify --strict` vs validação XSD',
    '',
    'O flag `--strict` do CLI transforma o passe estrutural em GATE (exit 1 quando há',
    'violações). Ele valida contra o **manifesto estrutural** destilado dos XSDs',
    'oficiais (BPMN20.xsd/Semantic.xsd: atributos obrigatórios + pais legais do perfil',
    'suportado — `packages/conformance/src/manifest.ts`). Isso **NÃO é validação XSD',
    'integral** (sem facets de tipo, sem content models completos) — por honestidade,',
    'o flag deliberadamente não se chama `--xsd`; `--xsd` é rejeitado pelo CLI até',
    'existir um validador XSD real. Exit codes: 0 ok · 1 violação (strict/require) ·',
    '2 XML mal-formado ou uso incorreto.',
    '',
  );
  return lines.join('\n');
}
