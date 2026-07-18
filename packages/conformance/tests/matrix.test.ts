import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@buildtovalue/core';
import {
  GENERATED_CORPUS_FILES,
  classCoverage,
  CONFORMANCE_MATRIX,
  renderConformanceMarkdown,
} from '../src/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('conformance matrix', () => {
  it('covers the roadmap-sized element list', () => {
    expect(CONFORMANCE_MATRIX.length).toBeGreaterThanOrEqual(40);
  });

  it('every supported/partial node element maps to a registered node type', () => {
    const registry = createDefaultRegistry();
    const nodeRows = CONFORMANCE_MATRIX.filter(
      (row) =>
        (row.status === 'supported' || row.status === 'partial') &&
        row.mappedTo !== undefined &&
        !row.mappedTo.includes(' ') &&
        !row.mappedTo.includes(':') &&
        // Model-path mappings (e.g. `definitions.messages[]`, §3a) are not node types.
        !row.mappedTo.includes('.') &&
        !['sequenceFlow', 'messageFlow', 'association', 'dataAssociation'].includes(row.mappedTo),
    );
    expect(nodeRows.length).toBeGreaterThan(15);
    for (const row of nodeRows) {
      expect(registry.has(row.mappedTo!), `${row.element} → ${row.mappedTo}`).toBe(true);
    }
  });

  it('reaches Descriptive 100% with F7-3 (callActivity landed)', () => {
    const descriptive = classCoverage(CONFORMANCE_MATRIX, 'descriptive');
    const analytic = classCoverage(CONFORMANCE_MATRIX, 'analytic');
    expect(descriptive).toBe(100);
    expect(analytic).toBeGreaterThanOrEqual(80);
  });

  it('CONFORMANCE.md is fresh (regenerate with scripts/gen-conformance.mjs)', () => {
    const committed = readFileSync(join(ROOT, 'CONFORMANCE.md'), 'utf8');
    expect(committed).toBe(renderConformanceMarkdown());
  });

  it('GENERATED_CORPUS_FILES matches the committed corpus (N-2 anti-drift)', () => {
    const dir = join(ROOT, 'packages', 'conformance', 'corpus');
    const count = readdirSync(dir).filter((name) => name.endsWith('.bpmn')).length;
    expect(count).toBe(GENERATED_CORPUS_FILES);
  });

  it('classCoverage treats an empty class as fully covered', () => {
    expect(classCoverage([], 'descriptive')).toBe(100);
  });

  it('marks the Descriptive class as declarable when it reaches 100%', () => {
    const markdown = renderConformanceMarkdown([
      { element: 'bpmn:task', status: 'supported', conformanceClass: 'descriptive', mappedTo: 'task' },
      { element: 'bpmn:group', status: 'degraded', conformanceClass: 'analytic' },
    ]);
    expect(markdown).toContain('Descriptive class: 100%');
    expect(markdown).toContain('declarable ✅');
    expect(markdown).toContain('🟠 degraded');
    // Entries without mappedTo/notes render placeholders, not "undefined".
    expect(markdown).not.toContain('undefined');
  });
});
