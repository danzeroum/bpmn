#!/usr/bin/env node
/**
 * Enforces cerca §1.1 (nunca PKI) for the identity layer: `@bpmn-react/identity`
 * must never generate, store or export keys. This grep-based CI gate fails if
 * its `src/` references key generation, private-key persistence, or key export
 * (Handoff 8 aceite #2). The Signer is always injected by the host; the library
 * only uses `crypto.subtle` to `importKey` a public key and `verify`.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../packages/identity/src', import.meta.url).pathname;

// Each pattern is a forbidden capability. `crypto.subtle.importKey` and
// `crypto.subtle.verify` are the ONLY subtle-crypto uses allowed.
const FORBIDDEN = [
  { re: /generateKey\b/, why: 'key generation' },
  { re: /generateKeyPair\b/, why: 'key-pair generation' },
  { re: /exportKey\b/, why: 'key export' },
  // Direct library signing is forbidden — signing must go through the injected
  // Signer handle (`signer.sign(...)`), which this rule deliberately allows.
  { re: /crypto\.subtle\.(?!importKey\b|verify\b)/, why: 'non-verify subtle-crypto call (incl. sign/generateKey)' },
  { re: /localStorage/, why: 'key storage (localStorage)' },
  { re: /sessionStorage/, why: 'key storage (sessionStorage)' },
  { re: /indexedDB/, why: 'key storage (indexedDB)' },
  { re: /privateKey/, why: 'private-key handling' },
];

function sourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

if (!existsSync(SRC)) {
  console.error(`identity src not found at ${SRC}`);
  process.exit(1);
}

const failures = [];
for (const file of sourceFiles(SRC)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // Ignore comment-only lines so prose like "never generateKey" is allowed.
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    for (const { re, why } of FORBIDDEN) {
      if (re.test(code)) {
        failures.push(`${file.slice(SRC.length + 1)}:${i + 1} — forbidden ${why}: ${line.trim()}`);
      }
    }
  });
}

if (failures.length > 0) {
  console.error('Non-PKI policy violated in @bpmn-react/identity (cerca §1.1):\n' + failures.join('\n'));
  process.exit(1);
}
console.log('OK: @bpmn-react/identity generates/stores/exports no keys (verify + importKey only).');
