import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { certifyXml } from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(HERE, '..', 'corpus');
const FIXTURES = join(HERE, 'fixtures');

const corpusFiles = readdirSync(CORPUS_DIR)
  .filter((name) => name.endsWith('.bpmn'))
  .sort();

const read = (dir: string, name: string) => readFileSync(join(dir, name), 'utf8');

describe('certifyXml over the corpus (aceite A3)', () => {
  it('certifies every corpus file (well-formed, XXE-safe, lossless round-trip)', () => {
    for (const name of corpusFiles) {
      const report = certifyXml(read(CORPUS_DIR, name));
      expect(report.wellFormed, name).toBe(true);
      expect(report.xxeSafe, name).toBe(true);
      expect(report.structuralIssues, name).toEqual([]);
      expect(report.roundTripLossless, name).toBe(true);
      if (name.includes('degraded-elements')) {
        expect(report.unsupportedElements, name).toEqual(['complexGateway']);
        expect(report.achievedClass, name).toBe('none');
      } else if (name.includes('dangling-reference')) {
        // Imports with warnings but stays certifiable — the ghost edge is
        // dropped deterministically.
        expect(report.achievedClass, name).not.toBe('none');
      } else {
        expect(report.unsupportedElements, name).toEqual([]);
        expect(report.achievedClass, name).not.toBe('none');
      }
    }
  });

  it('classifies descriptive-only vs analytic documents', () => {
    const descriptive = certifyXml(read(CORPUS_DIR, '01-linear-approval-v1.bpmn'));
    expect(descriptive.achievedClass).toBe('descriptive');
    const analytic = certifyXml(read(CORPUS_DIR, '16-boundary-events-v1.bpmn'));
    expect(analytic.achievedClass).toBe('analytic');
  });

  it('enforces --require semantics', () => {
    const xml = read(CORPUS_DIR, '16-boundary-events-v1.bpmn'); // analytic
    expect(certifyXml(xml, { require: 'analytic' }).requirementMet).toBe(true);
    expect(certifyXml(xml, { require: 'descriptive' }).requirementMet).toBe(false);

    const descriptiveXml = read(CORPUS_DIR, '01-linear-approval-v1.bpmn');
    expect(certifyXml(descriptiveXml, { require: 'descriptive' }).requirementMet).toBe(true);
    expect(certifyXml(descriptiveXml, { require: 'analytic' }).requirementMet).toBe(true);
  });
});

describe('certifyXml over invalid fixtures', () => {
  it('reports malformed XML (well-formedness failure, still XXE-safe)', () => {
    const report = certifyXml(read(FIXTURES, 'invalid-malformed.bpmn'), { require: 'descriptive' });
    expect(report.wellFormed).toBe(false);
    expect(report.xxeSafe).toBe(true);
    expect(report.parseError).toBeTruthy();
    expect(report.requirementMet).toBe(false);
  });

  it('rejects DOCTYPE (XXE protection)', () => {
    const report = certifyXml(read(FIXTURES, 'invalid-doctype.bpmn'));
    expect(report.wellFormed).toBe(false);
    expect(report.xxeSafe).toBe(false);
    expect(report.parseError).toMatch(/DOCTYPE/i);
  });

  it('flags structural manifest violations with codes', () => {
    const report = certifyXml(read(FIXTURES, 'invalid-structure.bpmn'));
    expect(report.wellFormed).toBe(true);
    const codes = report.structuralIssues.map((issue) => `${issue.code}:${issue.element}`).sort();
    expect(codes).toContain('STRUCT_MISSING_ATTR:boundaryEvent');
    expect(codes).toContain('STRUCT_MISSING_ATTR:sequenceFlow');
    expect(codes).toContain('STRUCT_BAD_PARENT:lane');
    expect(report.achievedClass).toBe('none');
  });
});
