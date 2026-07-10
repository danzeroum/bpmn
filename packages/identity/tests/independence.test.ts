import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Handoff 8 §3 — the dependency-graph acid test for `@buildtovalue/identity`.
 * This headless package must consume ONLY `@buildtovalue/core` (canonicalJson +
 * types). It must import NOTHING else from the ecosystem — no react, no anchor
 * adapters, no network module. Same enforcement shape as the replay/simulation
 * independence tests (Handoff 7 §2), tightened to allow exactly one workspace dep.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(HERE, '..', 'src');

const ALLOWED_ECOSYSTEM = new Set(['@buildtovalue/core']);

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

describe('@buildtovalue/identity dependency graph (Handoff 8 §3)', () => {
  it('src/ imports only relative paths and @buildtovalue/core', () => {
    const files = sourceFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(SPECIFIER_PATTERN)) {
        const specifier = match[1];
        const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
        if (!isRelative && !ALLOWED_ECOSYSTEM.has(specifier)) {
          violations.push(`${file.slice(SRC_DIR.length + 1)} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('declares @buildtovalue/core as its only runtime dependency', () => {
    const pkg = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@buildtovalue/core']);
    expect(pkg.peerDependencies ?? {}).toEqual({});
  });
});
