import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Handoff 6 acceptance criterion §10.2 — the structural guarantee behind the
 * generic library: @buildtovalue/library must not import anything from the
 * ecosystem (no @buildtovalue/core, no @buildtovalue/registry, no react, no
 * external package at all). Same spirit as scripts/check-no-runtime-deps.mjs,
 * applied to the import graph of this package's sources. A violation here is
 * an architecture bug, never an acceptable exception.
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

/** Matches static imports, re-exports and dynamic import() specifiers. */
const SPECIFIER_PATTERN = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

describe('@buildtovalue/library independence (§10.2)', () => {
  it('src/ contains only relative imports — nothing from the ecosystem', () => {
    const files = sourceFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(SPECIFIER_PATTERN)) {
        const specifier = match[1];
        if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
          violations.push(`${file}: imports "${specifier}"`);
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('package.json declares no dependencies of any kind', () => {
    const pkg = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'));
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.peerDependencies).toBeUndefined();
    expect(pkg.optionalDependencies).toBeUndefined();
  });
});
