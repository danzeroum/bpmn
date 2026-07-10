#!/usr/bin/env node
/**
 * API-docs freshness gate (Handoff 11 N-8) — same pattern as the generated
 * CONFORMANCE.md: regenerate the TypeDoc markdown from the public types and fail
 * if the committed `docs/api` differs. This keeps the published API reference in
 * lock-step with the source; a public-surface change that forgets to run
 * `pnpm docs:api` turns the build red.
 */
import { execSync } from 'node:child_process';

execSync('npx typedoc', { stdio: 'inherit', cwd: new URL('..', import.meta.url).pathname });

const status = execSync('git status --porcelain docs/api', {
  encoding: 'utf8',
  cwd: new URL('..', import.meta.url).pathname,
}).trim();

if (status) {
  console.error(
    'docs/api is stale — the public API changed but the docs were not regenerated.\n' +
      'Run `pnpm docs:api` and commit the result. Drift:\n' +
      status,
  );
  process.exit(1);
}
console.log('OK: docs/api is fresh (regenerated TypeDoc matches the committed reference).');
