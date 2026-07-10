#!/usr/bin/env node
/**
 * Enforces the zero-runtime-dependencies policy: publishable packages must
 * declare no `dependencies` other than workspace-internal @buildtovalue/* links.
 * `react`/`react-dom` are allowed only as peerDependencies.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const packagesDir = new URL('../packages', import.meta.url).pathname;
const failures = [];

for (const name of readdirSync(packagesDir)) {
  const pkgPath = join(packagesDir, name, 'package.json');
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (pkg.private) continue; // example app is exempt
  const deps = Object.keys(pkg.dependencies ?? {});
  const external = deps.filter((d) => !d.startsWith('@buildtovalue/'));
  if (external.length > 0) {
    failures.push(`${pkg.name}: forbidden runtime dependencies: ${external.join(', ')}`);
  }
}

if (failures.length > 0) {
  console.error('Zero-runtime-dependencies policy violated:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('OK: no forbidden runtime dependencies in publishable packages.');
