import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Handoff 7 §2 desacoplamento — the dependency-graph acidity test for
 * `@buildtovalue/simulation`. The engine may consume **only** `@buildtovalue/core`
 * (model types). It must not reach into `soundness`, `replay`, `registry`,
 * `library`, `react`, or any external package. Same spirit as the library
 * independence test (Handoff 6 §10.2). A violation here is an architecture
 * bug, never an acceptable exception.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(HERE, '..', 'src');

const ALLOWED = new Set(['@buildtovalue/core']);

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

describe('@buildtovalue/simulation independence (Handoff 7 §2)', () => {
  it('src/ imports only relative paths and @buildtovalue/core', () => {
    const files = sourceFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(SPECIFIER_PATTERN)) {
        const specifier = match[1];
        const relative = specifier.startsWith('./') || specifier.startsWith('../');
        if (!relative && !ALLOWED.has(specifier)) {
          violations.push(`${file.slice(SRC_DIR.length + 1)} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
