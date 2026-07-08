import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  createDefaultRegistry,
  normalizeForDiff,
} from '@bpmn-react/core';

const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'corpus');
const SNAPSHOT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'corpus-warnings.json');

const files = readdirSync(CORPUS_DIR)
  .filter((name) => name.endsWith('.bpmn'))
  .sort();

function converter() {
  return new BpmnXmlConverter({ registry: createDefaultRegistry() });
}

describe('interoperability corpus (Handoff 4 §A1)', () => {
  it('contains at least 50 files', () => {
    expect(files.length).toBeGreaterThanOrEqual(50);
  });

  it('every file documents its origin in the header', () => {
    for (const name of files) {
      const xml = readFileSync(join(CORPUS_DIR, name), 'utf8');
      expect(xml, name).toContain('Structural equivalent of');
      expect(xml, name).toContain('License: Apache-2.0');
    }
  });

  for (const name of files) {
    it(`${name}: imports without fatal error and the re-export re-imports identically`, () => {
      const xml = readFileSync(join(CORPUS_DIR, name), 'utf8');
      const first = converter().fromXml(xml);
      expect(Object.keys(first.diagram.nodes).length).toBeGreaterThan(0);

      const reExport = converter().toXml(first.diagram);
      const second = converter().fromXml(reExport);
      expect(normalizeForDiff(second.diagram)).toEqual(normalizeForDiff(first.diagram));
      // The canonical form is stable: exporting again is byte-identical.
      expect(converter().toXml(second.diagram)).toBe(reExport);
    });
  }

  it('per-file warning counts match the committed snapshot (fidelity regression guard)', () => {
    const actual: Record<string, number> = {};
    for (const name of files) {
      const xml = readFileSync(join(CORPUS_DIR, name), 'utf8');
      actual[name] = converter().fromXml(xml).warnings.length;
    }
    const expected = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as Record<string, number>;
    expect(actual).toEqual(expected);
  });
});
