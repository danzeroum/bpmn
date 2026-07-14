import { describe, expect, it } from 'vitest';
import {
  BpmnParseError,
  createDiagram,
  createEdge,
  createNode,
  createDefaultRegistry,
  normalizeForDiff,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { DMN_NODE_TYPES, DmnXmlConverter, type DecisionTable } from '../src/index.js';

/**
 * Dedicated headless DMN 1.3 round-trip suite (no React): edge cases of the
 * XML converter beyond the happy path covered in dmn.test.tsx — interop with
 * Camunda/dmn-js is a declared goal, so `fromXml ∘ toXml` must be lossless
 * and byte-stable across awkward table content.
 */

function dmnDiagram(nodes: Record<string, Parameters<typeof createNode>[0]>): BpmnDiagram {
  const registry = createDefaultRegistry();
  for (const def of DMN_NODE_TYPES) registry.register(def);
  const diagram = createDiagram({ name: 'RT', id: 'rt' });
  for (const [id, options] of Object.entries(nodes)) {
    diagram.nodes[id] = createNode({ ...options, id }, registry);
  }
  return diagram;
}

function roundTrip(diagram: BpmnDiagram): BpmnDiagram {
  const converter = new DmnXmlConverter();
  return converter.fromXml(converter.toXml(diagram)).diagram;
}

describe('DMN round-trip — decision-table edge cases', () => {
  it('preserves S-FEEL entries containing quotes, commas and unicode', () => {
    const table: DecisionTable = {
      hitPolicy: 'U',
      inputs: [{ id: 'i1', label: 'Categoria', expression: 'categoria', typeRef: 'string' }],
      outputs: [{ id: 'o1', label: 'Ação', expression: 'acao', typeRef: 'string' }],
      rules: [
        {
          id: 'r1',
          inputEntries: ['"crédito, especial"'],
          outputEntries: ['"aprovação — nível 2"'],
          annotation: 'contains "quotes" & <angles>',
        },
        { id: 'r2', inputEntries: ['not("x")'], outputEntries: ['"padrão"'] },
      ],
    };
    const diagram = dmnDiagram({
      d1: { type: 'dmn:decision', label: 'D', x: 10, y: 10, properties: { decisionTable: table } },
    });
    const restored = roundTrip(diagram);
    expect(restored.nodes.d1.properties.decisionTable).toEqual(table);
  });

  it('preserves empty input/output entries (dash cells)', () => {
    const table: DecisionTable = {
      hitPolicy: 'F',
      inputs: [{ id: 'i1', label: 'A', expression: 'a', typeRef: 'number' }],
      outputs: [{ id: 'o1', label: 'B', expression: 'b', typeRef: 'string' }],
      rules: [{ id: 'r1', inputEntries: [''], outputEntries: ['"x"'] }],
    };
    const diagram = dmnDiagram({
      d1: { type: 'dmn:decision', label: 'D', x: 0, y: 0, properties: { decisionTable: table } },
    });
    const restored = roundTrip(diagram);
    expect(restored.nodes.d1.properties.decisionTable).toEqual(table);
  });

  it('is byte-stable: export → import → export produces identical XML', () => {
    const table: DecisionTable = {
      hitPolicy: 'C',
      inputs: [
        { id: 'i1', label: 'X', expression: 'x', typeRef: 'number' },
        { id: 'i2', label: 'Y', expression: 'y', typeRef: 'boolean' },
      ],
      outputs: [{ id: 'o1', label: 'Z', expression: 'z', typeRef: 'string' }],
      rules: [
        { id: 'r1', inputEntries: ['[1..10]', 'true'], outputEntries: ['"in"'] },
        { id: 'r2', inputEntries: ['> 10', '-'], outputEntries: ['"out"'] },
      ],
    };
    const diagram = dmnDiagram({
      d1: { type: 'dmn:decision', label: 'D', x: 5, y: 5, properties: { decisionTable: table } },
      in1: { type: 'dmn:inputData', label: 'In', x: 200, y: 5 },
    });
    diagram.edges.e1 = createEdge({
      id: 'e1',
      sourceId: 'in1',
      targetId: 'd1',
      type: 'dmn:informationRequirement',
    });
    const converter = new DmnXmlConverter();
    const first = converter.toXml(diagram);
    const second = converter.toXml(converter.fromXml(first).diagram);
    expect(second).toBe(first);
  });

  it('round-trips node labels containing XML-hostile characters', () => {
    const diagram = dmnDiagram({
      d1: { type: 'dmn:decision', label: 'A & B < "C">\tTab', x: 0, y: 0 },
    });
    const restored = roundTrip(diagram);
    expect(restored.nodes.d1.label).toBe('A & B < "C">\tTab');
  });

  it('round-trips waypoints and geometry via DMNDI', () => {
    const diagram = dmnDiagram({
      d1: { type: 'dmn:decision', label: 'D', x: 300, y: 40 },
      in1: { type: 'dmn:inputData', label: 'In', x: 60, y: 200 },
    });
    diagram.edges.e1 = createEdge({
      id: 'e1',
      sourceId: 'in1',
      targetId: 'd1',
      type: 'dmn:informationRequirement',
      waypoints: [
        { x: 120, y: 210 },
        { x: 220, y: 90 },
        { x: 300, y: 70 },
      ],
    });
    const restored = roundTrip(diagram);
    expect(normalizeForDiff(restored)).toEqual(normalizeForDiff(diagram));
    expect(restored.edges.e1.waypoints).toEqual(diagram.edges.e1.waypoints);
  });
});

describe('DMN round-trip — import robustness', () => {
  it('rejects a non-definitions root with BpmnParseError', () => {
    const converter = new DmnXmlConverter();
    expect(() => converter.fromXml('<dmn:decision id="x" />')).toThrow(BpmnParseError);
  });

  it('rejects DOCTYPE (XXE protection)', () => {
    const converter = new DmnXmlConverter();
    const xml = '<!DOCTYPE definitions [<!ENTITY x "y">]><definitions />';
    expect(() => converter.fromXml(xml)).toThrow(/DOCTYPE/);
  });
});
