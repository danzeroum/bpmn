import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createDiagram } from '@buildtovalue/core';
import { validateProposal, WHITELISTED_COMMANDS } from '../src/index.js';

/**
 * Cerca §1.1 — THE acceptance criterion of CP-1: no code path leads from an
 * AI proposal to a governance command. Three fences, each independently
 * CI-enforced here:
 *   1. dependency graph — copilot depends only on core + soundness;
 *   2. anti-governance grep — no identity/promotion/signing symbol appears
 *      anywhere in src/;
 *   3. structural whitelist — governance operations are inexpressible, and a
 *      proposal that tries is rejected WHOLE.
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

const ALLOWED_SPECIFIERS = ['@buildtovalue/core', '@buildtovalue/soundness'];
const SPECIFIER_PATTERN = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

describe('guardrails 1 — dependency graph (§1.1)', () => {
  it('package.json depends ONLY on core and soundness', () => {
    const pkg = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(ALLOWED_SPECIFIERS);
    expect(pkg.peerDependencies).toBeUndefined();
  });

  it('src/ imports only relatives, core or soundness — never identity/anchor/react', () => {
    const violations: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(SPECIFIER_PATTERN)) {
        const spec = match[1];
        if (spec.startsWith('./') || spec.startsWith('../')) continue;
        if (ALLOWED_SPECIFIERS.includes(spec)) continue;
        violations.push(`${file.slice(SRC_DIR.length + 1)} → ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('guardrails 2 — anti-governance grep (§1.1)', () => {
  it('no governance symbol appears anywhere in src/', () => {
    const FORBIDDEN = [
      '@buildtovalue/identity',
      '@buildtovalue/anchor',
      '@buildtovalue/registry',
      'promote(',
      'promoteVersion',
      'evaluateGates',
      'Signer',
      'signApproval',
      'AnchorAdapter',
    ];
    const hits: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      for (const token of FORBIDDEN) {
        if (content.includes(token)) hits.push(`${file.slice(SRC_DIR.length + 1)} contains '${token}'`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe('guardrails 3 — governance is structurally inexpressible (§1.1/§1.3)', () => {
  it('the whitelist is EXACTLY the draft-edit set — no governance verbs', () => {
    expect(WHITELISTED_COMMANDS).toEqual(
      ['addEdge', 'addNode', 'moveNode', 'removeEdge', 'removeNode', 'updateEdge', 'updateNode'].sort(),
    );
  });

  it.each(['promote', 'sign', 'approve', 'anchor', 'evaluateGates', 'restoreDiagram'])(
    "a proposal with '%s' is rejected WHOLE with a readable error",
    (type) => {
      const diagram = createDiagram({ name: 'G' });
      const verdict = validateProposal(diagram, {
        commands: [
          { type: 'addNode', params: { id: 'a', type: 'task', label: 'A', x: 0, y: 0 } },
          { type, params: {} },
        ],
        rationale: 'tries to smuggle governance',
        promptTemplateRef: { id: 'copilot-draft', version: '1.0.0' },
      });
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) {
        expect(verdict.errors).toHaveLength(1);
        expect(verdict.errors[0].index).toBe(1); // names the offending command
        expect(verdict.errors[0].message).toContain(`'${type}' is not on the whitelist`);
        expect(verdict.errors[0].message).toContain('rejected whole');
      }
    },
  );
});
