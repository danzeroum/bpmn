/**
 * Fetches a real-world BPMN interoperability corpus for the conformance suite.
 *
 * Per pendencias.md / the audit decision (#1), real third-party .bpmn files are
 * NOT committed to this repo (mixed MIT / Apache-2.0 licensing, "zero
 * proprietary material" stance). Instead they are downloaded on demand — in CI,
 * before the conformance tests — into `packages/conformance/corpus-external/`,
 * which is git-ignored. `tests/corpusExternal.test.ts` round-trips whatever is
 * present, and skips itself when the directory is empty (offline / not fetched),
 * so the build never depends on network availability.
 *
 * Sources are restricted to permissive, redistributable licences (MIT,
 * Apache-2.0). The DMN TCK (CC-BY-SA, share-alike) is deliberately excluded.
 *
 *   node scripts/fetch-corpus.mjs
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'packages/conformance/corpus-external');
const MAX_FILES = 40;

/** Permissive, redistributable sources only (no CC-BY-SA / share-alike). */
const SOURCES = [
  { name: 'bpmn-js-examples', license: 'MIT', url: 'https://github.com/bpmn-io/bpmn-js-examples' },
  { name: 'camunda-get-started', license: 'Apache-2.0', url: 'https://github.com/camunda/camunda-get-started-quickstart' },
];

/** All `.bpmn` files under `dir` (recursive), as absolute paths. */
function findBpmn(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.bpmn'))
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name));
}

function main() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const manifest = [];
  for (const source of SOURCES) {
    if (manifest.length >= MAX_FILES) break;
    const tmp = mkdtempSync(join(tmpdir(), `corpus-${source.name}-`));
    try {
      execFileSync('git', ['clone', '--depth', '1', '--quiet', source.url, tmp], {
        stdio: ['ignore', 'ignore', 'inherit'],
        timeout: 120_000,
      });
    } catch (error) {
      // Network unavailable / clone failed: skip this source, don't fail the build.
      console.warn(`fetch-corpus: skipped ${source.name} (${error.message ?? error})`);
      rmSync(tmp, { recursive: true, force: true });
      continue;
    }
    let index = 0;
    for (const file of findBpmn(tmp).sort()) {
      if (manifest.length >= MAX_FILES) break;
      const dest = `${source.name}__${String(index++).padStart(2, '0')}.bpmn`;
      cpSync(file, join(OUT_DIR, dest));
      manifest.push({
        file: dest,
        source: source.name,
        license: source.license,
        origin: `${source.url} :: ${file.slice(tmp.length + 1)}`,
      });
    }
    rmSync(tmp, { recursive: true, force: true });
  }

  writeFileSync(join(OUT_DIR, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    manifest.length > 0
      ? `fetch-corpus: wrote ${manifest.length} real .bpmn files to corpus-external/`
      : 'fetch-corpus: no files fetched (offline?) — corpusExternal tests will skip',
  );
}

main();
