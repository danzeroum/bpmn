import { describe, expect, it } from 'vitest';
import { BpmnXmlConverter } from '@buildtovalue/core';
import { lintFindings } from '@buildtovalue/lint';
import {
  buildCompensationEditorDiagram,
  buildCompensationNoHandlerDiagram,
  buildCompensationPackageDiagram,
  buildCompensationSimDiagram,
} from '../src/fixtures.js';

/**
 * #152 smoke — every public compensation seed (a) lints clean under the
 * DEFAULT profiles apart from its DECLARED pedagogical findings, and (b)
 * round-trips through the XML converter byte-stably between our own exports.
 * These are the exact guarantees a host consuming `?compensation=1` relies on.
 */
const FIXTURES = [
  { name: 'editor', build: buildCompensationEditorDiagram, declared: [] as string[] },
  { name: 'sim', build: buildCompensationSimDiagram, declared: [] as string[] },
  // The package demo NAMES its risk: the throw targets the uncompensable card.
  { name: 'package', build: buildCompensationPackageDiagram, declared: ['COMP_REF_NOT_COMPENSABLE'] },
  // The no-handler demo EXISTS to fire the quick-fixable finding.
  { name: 'no-handler', build: buildCompensationNoHandlerDiagram, declared: ['COMP_BOUNDARY_NO_HANDLER'] },
];

describe('compensation fixtures — default-profile validation (#152)', () => {
  for (const { name, build, declared } of FIXTURES) {
    it(`${name}: only the DECLARED pedagogical findings; nothing undeclared errors`, () => {
      const findings = lintFindings(build());
      const codes = [...new Set(findings.map((f) => f.code))];
      // Every declared finding is really there (the demo's teaching point)…
      for (const code of declared) expect(codes).toContain(code);
      // …and nothing UNdeclared reaches error severity — the fixture is
      // default-profile clean apart from what it deliberately demonstrates.
      const undeclaredErrors = findings.filter(
        (f) => f.severity === 'error' && !declared.includes(f.code),
      );
      expect(undeclaredErrors).toEqual([]);
    });
  }
});

describe('compensation fixtures — round-trip (#152)', () => {
  for (const { name, build } of FIXTURES) {
    it(`${name}: import is lossless and re-exports byte-stably (passthrough contract)`, () => {
      const converter = new BpmnXmlConverter();
      const original = build();
      const xml = converter.toXml(original);
      const first = converter.fromXml(xml);
      expect(first.warnings).toEqual([]);
      expect(Object.keys(first.diagram.nodes).sort()).toEqual(Object.keys(original.nodes).sort());
      expect(Object.keys(first.diagram.edges).sort()).toEqual(Object.keys(original.edges).sort());
      // Byte-stable between OUR OWN exports (the passthrough guarantee): the
      // first import may canonicalize DI order; from then on it is fixed.
      const stable = converter.toXml(first.diagram);
      const second = converter.fromXml(stable);
      expect(second.warnings).toEqual([]);
      expect(converter.toXml(second.diagram)).toBe(stable);
    });
  }
});
