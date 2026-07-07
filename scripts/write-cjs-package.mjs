#!/usr/bin/env node
// Marks a CJS output directory as CommonJS so Node resolves .js files correctly.
import { writeFileSync, mkdirSync } from 'node:fs';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: write-cjs-package.mjs <dir>');
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/package.json`, JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
