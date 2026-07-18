import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  createDefaultRegistry,
  isEventSubprocess,
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

  // Handoff 16 E-1 (§3a): arquivos REAIS com messageRef importam com as
  // definições nomeadas capturadas (roots OMG → diagram.definitions, ref no
  // nó) e SEM warning de descarte — a preservação real da decisão 1 da E-0.
  it('preserva definições nomeadas (messageRef) dos arquivos reais', () => {
    let exercised = 0;
    for (const name of files) {
      const xml = readFileSync(join(CORPUS_DIR, name), 'utf8');
      if (!xml.includes('messageRef')) continue;
      exercised++;
      const { diagram, warnings } = converter().fromXml(xml);
      expect(
        (diagram.definitions?.messages.length ?? 0),
        `${name}: roots de message capturados`,
      ).toBeGreaterThan(0);
      const referencing = Object.values(diagram.nodes).filter(
        (node) => typeof node.properties.eventDefinitionRef === 'string',
      );
      expect(referencing.length, `${name}: refs ligadas aos nós`).toBeGreaterThan(0);
      // Nada de warning de síntese quando os roots existem no arquivo.
      expect(warnings.filter((w) => w.includes('synthesized'))).toEqual([]);
      // Re-export declara os roots e as refs.
      const reExport = converter().toXml(diagram);
      expect(reExport).toContain('<bpmn:message');
      expect(reExport).toContain('messageRef="');
    }
    expect(exercised).toBeGreaterThanOrEqual(1);
  });

  // Handoff 17 ES-1 (§4a): marcação REAL com triggeredByEvent importa como
  // contêiner de PRIMEIRA CLASSE (antes: subProcess comum silencioso). No
  // corpus atual o único event subprocess real vive no SEGUNDO <bpmn:process>
  // de bpmn-js-examples__22 — que o importador single-process descarta com o
  // warning documentado. O subtree do processo é saída REAL do bpmn-js,
  // extraída INTOCADA e importada sozinha: a asserção de primeira classe
  // roda sobre a marcação real, não sobre uma síntese nossa.
  it('importa event subprocess de marcação real como contêiner de primeira classe', () => {
    let exercised = 0;
    for (const name of files) {
      const xml = readFileSync(join(CORPUS_DIR, name), 'utf8');
      if (!xml.includes('triggeredByEvent="true"')) continue;
      // Isola o <bpmn:process> real que carrega o contêiner (bytes intactos).
      const processes = [...xml.matchAll(/<bpmn:process[\s\S]*?<\/bpmn:process>/g)].map(
        (m) => m[0],
      );
      const real = processes.find((p) => p.includes('triggeredByEvent="true"'));
      if (!real) continue;
      exercised++;
      const header = xml.slice(0, xml.indexOf('>', xml.indexOf('<bpmn:definitions')) + 1);
      const single = `${header}\n${real}\n</bpmn:definitions>`;
      const { diagram, warnings } = converter().fromXml(single);
      const containers = Object.values(diagram.nodes).filter(isEventSubprocess);
      expect(containers.length, `${name}: contêineres capturados`).toBeGreaterThan(0);
      // O start interno não-interrupting do arquivo real também é capturado.
      const nonInterrupting = Object.values(diagram.nodes).filter(
        (node) => node.type === 'startEvent' && node.properties.isInterrupting === false,
      );
      expect(nonInterrupting.length, `${name}: isInterrupting capturado`).toBeGreaterThan(0);
      expect(
        warnings.filter((w) => w.includes('triggeredByEvent') || w.includes('isInterrupting')),
      ).toEqual([]);
      const reExport = converter().toXml(diagram);
      expect(reExport, `${name}: atributo re-exportado`).toContain('triggeredByEvent="true"');
      expect(reExport, `${name}: isInterrupting preservado`).toContain('isInterrupting="false"');
    }
    expect(exercised).toBeGreaterThanOrEqual(1);
  });
});
