import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  createDefaultRegistry,
  normalizeForDiff,
} from '@bpmn-react/core';

/**
 * Round-trips a corpus of **real** third-party BPMN exports (bpmn-js-examples,
 * Camunda quick-starts — MIT / Apache-2.0) that `scripts/fetch-corpus.mjs`
 * downloads into `corpus-external/` (git-ignored, fetched in CI). Unlike the
 * committed synthetic corpus, these are genuine tool output, so they exercise
 * the importer against real-world element mixes, namespaces and DI quirks.
 *
 * The guarantee tested is interoperability, not full support: every file must
 * import WITHOUT a fatal error, and re-exporting then re-importing must be
 * structurally stable (`normalizeForDiff`). Warnings are expected — real files
 * use elements outside the supported profile, which are ignored by design.
 *
 * When the directory is absent or empty (offline, or the fetch step didn't
 * run), the suite skips itself so the build never depends on the network.
 */
const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'corpus-external');

const files =
  existsSync(CORPUS_DIR)
    ? readdirSync(CORPUS_DIR)
        .filter((name) => name.endsWith('.bpmn'))
        .sort()
    : [];

function converter() {
  return new BpmnXmlConverter({ registry: createDefaultRegistry() });
}

describe.skipIf(files.length === 0)('external interoperability corpus (real files)', () => {
  it('has at least 20 real files when fetched', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  for (const name of files) {
    it(`${name}: imports without a fatal error and round-trips structurally`, () => {
      const xml = readFileSync(join(CORPUS_DIR, name), 'utf8');
      const first = converter().fromXml(xml);
      // Real diagrams have flow content; a pure-collaboration edge case would
      // still import, so only require that parsing produced a diagram object.
      expect(first.diagram).toBeDefined();

      const reExport = converter().toXml(first.diagram);
      const second = converter().fromXml(reExport);
      // Structural stability is the interoperability bar for third-party files:
      // the model we recover is invariant under export→import. (Byte-identical
      // re-export is asserted only for our own canonical output — the synthetic
      // corpus.test.ts — since importing an arbitrary tool's file normalizes
      // and reflows DI, which need not be byte-idempotent.)
      expect(normalizeForDiff(second.diagram)).toEqual(normalizeForDiff(first.diagram));
    });
  }
});
