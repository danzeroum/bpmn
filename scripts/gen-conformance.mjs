/**
 * Regenerates CONFORMANCE.md from the matrix in @bpmn-react/conformance.
 * Requires the package to be built first (pnpm --filter @bpmn-react/conformance build).
 *
 *   node scripts/gen-conformance.mjs
 *
 * Freshness is enforced by packages/conformance/tests/matrix.test.ts — the
 * committed file must equal the rendered output (same pattern as apiSurface).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { renderConformanceMarkdown } = await import(
  join(root, 'packages/conformance/dist/esm/index.js')
);

const target = join(root, 'CONFORMANCE.md');
writeFileSync(target, renderConformanceMarkdown());
console.log(`wrote ${target}`);
