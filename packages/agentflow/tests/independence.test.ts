import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Handoff 12 §1.7 / §9.1 — the dependency-graph acidity test for
 * `@buildtovalue/agentflow`. The package must import **NOTHING** from the
 * ecosystem: not `core`, not `simulation`, not `registry`, nor any external
 * package. It operates purely on an abstract agent graph, so it can serve the
 * validator, the (A-2) engine and the (A-4) editor without depending on any of
 * them (same enforcement as `replay`/`sfeel`).
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

describe('@buildtovalue/agentflow independence (Handoff 12 §1.7)', () => {
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

  it('package.json declares zero dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'));
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.peerDependencies).toBeUndefined();
  });
});
