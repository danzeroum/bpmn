import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from '@bpmn-react/core';
import {
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
        !['sequenceFlow', 'messageFlow', 'association'].includes(row.mappedTo),
    );
    expect(nodeRows.length).toBeGreaterThan(15);
    for (const row of nodeRows) {
      expect(registry.has(row.mappedTo!), `${row.element} → ${row.mappedTo}`).toBe(true);
    }
  });

  it('tracks class coverage honestly (Descriptive reaches 100% with F7/callActivity)', () => {
    const descriptive = classCoverage(CONFORMANCE_MATRIX, 'descriptive');
    const analytic = classCoverage(CONFORMANCE_MATRIX, 'analytic');
    // callActivity (Descriptive) is still roadmap F7 — the matrix must not
    // overclaim before it lands.
    expect(descriptive).toBeGreaterThanOrEqual(90);
    expect(descriptive).toBeLessThan(100);
    expect(analytic).toBeGreaterThanOrEqual(80);
  });

  it('CONFORMANCE.md is fresh (regenerate with scripts/gen-conformance.mjs)', () => {
    const committed = readFileSync(join(ROOT, 'CONFORMANCE.md'), 'utf8');
    expect(committed).toBe(renderConformanceMarkdown());
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
