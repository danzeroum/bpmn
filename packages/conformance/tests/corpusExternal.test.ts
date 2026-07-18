import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  createDefaultRegistry,
  normalizeForDiff,
} from '@buildtovalue/core';
import { EXTERNAL_CORPUS_MAX, EXTERNAL_CORPUS_MIN } from '../src/index.js';

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
  it('respects the corpus policy bounds when fetched (N-2 single source)', () => {
    expect(files.length).toBeGreaterThanOrEqual(EXTERNAL_CORPUS_MIN);
    expect(files.length).toBeLessThanOrEqual(EXTERNAL_CORPUS_MAX);
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

  // Passthrough (PR dedicada): em TODO arquivo real que carrega extensão
  // estrangeira preservada no modelo, o re-export contém cada elemento (tag)
  // e cada atributo prefixado — e pelo menos UM arquivo do corpus exercita o
  // caminho (ex.: <qa:analysisDetails> do custom-elements do bpmn-js,
  // camunda:asyncBefore dos quick-starts).
  it('preserva as extensões estrangeiras dos arquivos reais no re-export', () => {
    let exercised = 0;
    for (const name of files) {
      const xml = readFileSync(join(CORPUS_DIR, name), 'utf8');
      const { diagram } = converter().fromXml(xml);
      const foreignTags = new Set<string>();
      const foreignAttrs = new Set<string>();
      for (const el of [...Object.values(diagram.nodes), ...Object.values(diagram.edges)]) {
        for (const subtree of el.foreignExtensions ?? []) foreignTags.add(subtree.tag);
        for (const attr of Object.keys(el.foreignAttributes ?? {})) foreignAttrs.add(attr);
      }
      for (const subtree of diagram.processForeignExtensions ?? []) foreignTags.add(subtree.tag);
      if (foreignTags.size === 0 && foreignAttrs.size === 0) continue;
      exercised++;
      const reExport = converter().toXml(diagram);
      for (const tag of foreignTags) expect(reExport, `${name}: <${tag}>`).toContain(`<${tag}`);
      for (const attr of foreignAttrs) expect(reExport, `${name}: ${attr}`).toContain(`${attr}="`);
    }
    expect(exercised).toBeGreaterThanOrEqual(1);
  });
});
