import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Handoff 7 §2 desacoplamento — the dependency-graph acidity test for
 * `@buildtovalue/replay`. This package must import **NOTHING** from the
 * ecosystem: not `@buildtovalue/core`, not `simulation`, not `react`, not any
 * external package. It operates purely on the injected abstract graph. Same
 * enforcement as the library independence test (Handoff 6 §10.2).
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(HERE, '..', 'src');

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const SPECIFIER_PATTERN = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

describe('@buildtovalue/replay independence (Handoff 7 §2)', () => {
  it('src/ contains only relative imports — nothing from the ecosystem', () => {
    const files = sourceFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(SPECIFIER_PATTERN)) {
        const specifier = match[1];
        if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
          violations.push(`${file.slice(SRC_DIR.length + 1)} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
