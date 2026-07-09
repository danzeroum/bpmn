import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import {
  createDiagram,
  createEdge,
  createNode,
  createDefaultRegistry,
  normalizeForDiff,
  type BpmnDiagram,
} from '@bpmn-react/core';
import { BpmnDesigner, BpmnViewer, Palette, resolveEditorConfig } from '@bpmn-react/react';
import {
  DMN_NODE_TYPES,
  DmnXmlConverter,
  dmnPlugin,
  type DecisionTable,
} from '../src/index.js';

/** A full decision table (fixed ids) so canonical export/round-trip is exercised. */
const CREDIT_TABLE: DecisionTable = {
  hitPolicy: 'F',
  inputs: [{ id: 'in_income', label: 'Income', expression: 'income', typeRef: 'number' }],
  outputs: [{ id: 'out_risk', label: 'Risk', expression: 'risk', typeRef: 'string' }],
  rules: [
    { id: 'rule_low', inputEntries: ['< 1000'], outputEntries: ['"high"'] },
    { id: 'rule_high', inputEntries: ['>= 1000'], outputEntries: ['"low"'], annotation: 'good income' },
  ],
};

/** Reference DRD: the 4 §4.1 nodes + the 3 requirement edges. */
function drdDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  for (const def of DMN_NODE_TYPES) registry.register(def);
  const diagram = createDiagram({ name: 'Credit DRD', id: 'credit-drd' });
  const make = (type: string, id: string, label: string, x: number, y: number, properties = {}) =>
    createNode({ type, id, label, x, y, properties }, registry);
  diagram.nodes = {
    decision: make('dmn:decision', 'decision', 'Approve credit?', 300, 60, {
      decisionTable: CREDIT_TABLE,
    }),
    income: make('dmn:inputData', 'income', 'Income', 80, 200),
    policy: make('dmn:knowledgeSource', 'policy', 'Credit policy', 520, 200),
    scorecard: make('dmn:businessKnowledgeModel', 'scorecard', 'Scorecard', 300, 220),
  };
  diagram.edges = {
    info: createEdge({ id: 'info', sourceId: 'income', targetId: 'decision', type: 'dmn:informationRequirement' }),
    know: createEdge({ id: 'know', sourceId: 'scorecard', targetId: 'decision', type: 'dmn:knowledgeRequirement' }),
    auth: createEdge({ id: 'auth', sourceId: 'policy', targetId: 'decision', type: 'dmn:authorityRequirement' }),
  };
  return diagram;
}

describe('DmnXmlConverter (aceite 10.5.5 — round-trip)', () => {
  it('exports DMN 1.x with requirements nested in the requiring element + DMNDI', () => {
    const xml = new DmnXmlConverter().toXml(drdDiagram());
    expect(xml).toContain('xmlns:dmn="https://www.omg.org/spec/DMN/20191111/MODEL/"');
    expect(xml).toContain('<dmn:inputData id="income" name="Income" />');
    const decision = xml.slice(xml.indexOf('<dmn:decision'), xml.indexOf('</dmn:decision>'));
    expect(decision).toContain('<dmn:informationRequirement id="info">');
    expect(decision).toContain('<dmn:requiredInput href="#income" />');
    expect(decision).toContain('<dmn:knowledgeRequirement id="know">');
    expect(decision).toContain('<dmn:requiredKnowledge href="#scorecard" />');
    expect(decision).toContain('<dmn:authorityRequirement id="auth">');
    expect(decision).toContain('<dmn:requiredAuthority href="#policy" />');
    expect(xml).toContain('<dmndi:DMNShape id="decision_di" dmnElementRef="decision">');
    expect(xml).toContain('<dmndi:DMNEdge id="info_di" dmnElementRef="info">');
  });

  it('writes the decision logic as a canonical <dmn:decisionTable>, not a JSON blob', () => {
    const xml = new DmnXmlConverter().toXml(drdDiagram());
    const decision = xml.slice(xml.indexOf('<dmn:decision '), xml.indexOf('</dmn:decision>'));
    // Canonical DMN decision table (interoperable with Camunda / dmn-js / TCK).
    expect(decision).toContain('<dmn:decisionTable id="decision_dt" hitPolicy="FIRST">');
    expect(decision).toContain('<dmn:input id="in_income" label="Income">');
    expect(decision).toContain('<dmn:inputExpression id="in_income_expr" typeRef="number">');
    expect(decision).toContain('<dmn:text>income</dmn:text>');
    expect(decision).toContain('<dmn:output id="out_risk" label="Risk" name="risk" typeRef="string" />');
    expect(decision).toContain('<dmn:rule id="rule_high">');
    expect(decision).toContain('<dmn:description>good income</dmn:description>');
    expect(decision).toContain('<dmn:text>"low"</dmn:text>');
    // The old proprietary encoding must be gone.
    expect(decision).not.toContain('name="decisionTable"');
  });

  it('round-trips the 4 nodes + 3 requirement edges identically (normalizeForDiff)', () => {
    const converter = () => new DmnXmlConverter();
    const original = drdDiagram();
    const xml = converter().toXml(original);
    const { diagram: imported, warnings } = converter().fromXml(xml);
    expect(warnings).toEqual([]);
    expect(imported.edges.info).toMatchObject({
      sourceId: 'income',
      targetId: 'decision',
      type: 'dmn:informationRequirement',
    });
    expect(imported.nodes.decision.properties.decisionTable).toEqual(CREDIT_TABLE);
    expect(normalizeForDiff(imported)).toEqual(normalizeForDiff(original));
    // Canonical form is byte-stable.
    expect(converter().toXml(imported)).toBe(xml);
  });

  it('still imports a legacy bpmnr:property="decisionTable" JSON blob (back-compat)', () => {
    const NS = 'https://www.omg.org/spec/DMN/20191111/MODEL/';
    const legacyTable = { hitPolicy: 'U', inputs: [], outputs: [], rules: [] };
    // Old exports stored the table as a JSON blob in a bpmnr:property value
    // (quotes XML-escaped as &quot;).
    const legacyValue = JSON.stringify(legacyTable).replace(/"/g, '&quot;');
    const legacy = `<dmn:definitions xmlns:dmn="${NS}" id="D" name="Legacy">
      <dmn:decision id="d1" name="Decide"><dmn:extensionElements><bpmnr:property xmlns:bpmnr="http://bpmn-react.io/schema/1.0" name="decisionTable" value="${legacyValue}" /></dmn:extensionElements></dmn:decision>
    </dmn:definitions>`;
    const { diagram } = new DmnXmlConverter().fromXml(legacy);
    expect(diagram.nodes.d1.properties.decisionTable).toEqual(legacyTable);
    // Re-export upgrades it to the canonical form.
    const reexported = new DmnXmlConverter().toXml(diagram);
    expect(reexported).toContain('<dmn:decisionTable');
    expect(reexported).not.toContain('name="decisionTable"');
  });

  it('maps a decision-to-decision requirement to requiredDecision', () => {
    const diagram = drdDiagram();
    const registry = createDefaultRegistry();
    for (const def of DMN_NODE_TYPES) registry.register(def);
    diagram.nodes.upstream = createNode(
      { type: 'dmn:decision', id: 'upstream', label: 'Risk class', x: 80, y: 60 },
      registry,
    );
    diagram.edges.dd = createEdge({
      id: 'dd',
      sourceId: 'upstream',
      targetId: 'decision',
      type: 'dmn:informationRequirement',
    });
    const xml = new DmnXmlConverter().toXml(diagram);
    expect(xml).toContain('<dmn:requiredDecision href="#upstream" />');
    const { diagram: imported } = new DmnXmlConverter().fromXml(xml);
    expect(imported.edges.dd).toMatchObject({ sourceId: 'upstream', targetId: 'decision' });
  });

  it('rejects DOCTYPE (XXE-safe) and grid-lays-out documents without DMNDI', () => {
    const converter = new DmnXmlConverter();
    expect(() =>
      converter.fromXml('<!DOCTYPE foo [<!ENTITY x "y">]><dmn:definitions />'),
    ).toThrow();
    const bare = `<dmn:definitions xmlns:dmn="${'https://www.omg.org/spec/DMN/20191111/MODEL/'}" id="D" name="Bare">
      <dmn:decision id="d1" name="Only decision" />
    </dmn:definitions>`;
    const { diagram, warnings } = converter.fromXml(bare);
    expect(diagram.nodes.d1.type).toBe('dmn:decision');
    expect(warnings.some((w) => w.includes('no DMNDI'))).toBe(true);
  });
});

describe('dmnPlugin (DRD on the canvas, §4.1)', () => {
  it('renders the 4 DRD shapes with their distinguishing geometry', () => {
    const { container } = render(<BpmnViewer diagram={drdDiagram()} plugins={[dmnPlugin]} />);
    // Decision: SHARP rectangle (no rx) + table glyph (decisionTable set).
    const decision = container.querySelector('[data-node-type="dmn:decision"]')!;
    expect(decision.querySelector('rect')?.getAttribute('rx')).toBeNull();
    expect(decision.querySelector('[data-decision-table-glyph]')).not.toBeNull();
    // Input data: oval (rx = h/2 = 22).
    const input = container.querySelector('[data-node-type="dmn:inputData"] rect')!;
    expect(input.getAttribute('rx')).toBe('22');
    // Knowledge source: wavy base path; BKM: cut-corner polygon + inner edge.
    expect(
      container.querySelector('[data-node-type="dmn:knowledgeSource"] path'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-node-type="dmn:businessKnowledgeModel"] polygon'),
    ).not.toBeNull();
  });

  it('styles the 3 requirement edges by form: solid/filled, dashed/open, dotted/disc', () => {
    const { container } = render(<BpmnViewer diagram={drdDiagram()} plugins={[dmnPlugin]} />);
    const line = (id: string) => container.querySelector(`[data-edge-id="${id}"] path[marker-end]`)!;
    expect(line('info').getAttribute('stroke-dasharray')).toBeNull();
    expect(line('info').getAttribute('marker-end')).toBe('url(#bpmnr-edge-filled)');
    expect(line('know').getAttribute('stroke-dasharray')).toBe('5,4');
    expect(line('know').getAttribute('marker-end')).toBe('url(#bpmnr-edge-open)');
    expect(line('auth').getAttribute('stroke-dasharray')).toBe('2,4');
    expect(line('auth').getAttribute('marker-end')).toBe('url(#bpmnr-edge-disc)');
  });

  it('routes requirement edges STRAIGHT (single line segment)', () => {
    const { container } = render(<BpmnViewer diagram={drdDiagram()} plugins={[dmnPlugin]} />);
    const d = container
      .querySelector('[data-edge-id="info"] path[marker-end]')!
      .getAttribute('d')!;
    // One M + one L — no curves, no orthogonal bends.
    expect(d).toMatch(/^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+$/);
  });
});

describe('color wheel contract (aceite 10.5.10)', () => {
  it('claims 185° and warns on a collision', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolveEditorConfig([dmnPlugin, { id: 'other', colorWheelDegree: 185 }]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('color wheel collision'));
    warn.mockRestore();
  });

  it('rejects gold/green as a domain body color', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolveEditorConfig([{ id: 'greedy', bodyColor: 'var(--btv-gold, #9a7b1e)' }]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('RESERVED color'));
    warn.mockClear();
    // The DMN plugin itself passes the lint.
    resolveEditorConfig([dmnPlugin]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('coverage of edge cases', () => {
  it('renders the palette icons and the selected state of every DRD shape', () => {
    const { container } = render(
      <BpmnDesigner diagram={drdDiagram()} plugins={[dmnPlugin]}>
        <Palette />
      </BpmnDesigner>,
    );
    // Palette icons (plugin.tsx Icon) are in the DOM.
    expect(container.querySelectorAll('.bpmnr-palette svg').length).toBeGreaterThanOrEqual(4);
    // Selecting each node exercises the selected stroke branch.
    for (const id of ['decision', 'income', 'policy', 'scorecard']) {
      const node = container.querySelector(`[data-node-id="${id}"]`)!;
      fireEvent.pointerDown(node, { button: 0 });
      fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
      expect(container.querySelector(`[data-node-id="${id}"][data-selected]`)).not.toBeNull();
    }
  });

  it('round-trips closed nodes, custom properties and explicit waypoints', () => {
    const converter = () => new DmnXmlConverter();
    const diagram = drdDiagram();
    diagram.id = 'id with spaces!';
    diagram.nodes.policy = {
      ...diagram.nodes.policy,
      createdInVersion: 'v2',
      removedInVersion: 'v3',
      properties: { note: 'legacy', weight: 3 },
    };
    diagram.edges.info = {
      ...diagram.edges.info,
      waypoints: [
        { x: 150, y: 222 },
        { x: 300, y: 90 },
      ],
    };
    const xml = converter().toXml(diagram);
    expect(xml).toContain('id="Definitions_id_with_spaces_"');
    const { diagram: imported, warnings } = converter().fromXml(xml);
    expect(warnings).toEqual([]);
    expect(imported.nodes.policy.removedInVersion).toBe('v3');
    expect(imported.nodes.policy.createdInVersion).toBe('v2');
    expect(imported.nodes.policy.properties).toEqual({ note: 'legacy', weight: 3 });
    expect(imported.edges.info.waypoints).toEqual(diagram.edges.info.waypoints);
    expect(normalizeForDiff(imported)).toEqual(normalizeForDiff(diagram));
    expect(converter().toXml(imported)).toBe(xml);
  });

  it('warns on unsupported elements, hrefless requirements, bad bounds and dangling refs', () => {
    const NS = 'https://www.omg.org/spec/DMN/20191111/MODEL/';
    const xml = `<dmn:definitions xmlns:dmn="${NS}" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" id="D" name="Messy">
      <dmn:itemDefinition id="unsupported" />
      <dmn:decision id="d1" name="Decide">
        <dmn:informationRequirement id="bad" />
        <dmn:informationRequirement id="dangling"><dmn:requiredInput href="#ghost" /></dmn:informationRequirement>
      </dmn:decision>
      <dmndi:DMNDI><dmndi:DMNDiagram id="Dg">
        <dmndi:DMNShape id="d1_di" dmnElementRef="d1"><dc:Bounds x="oops" y="1" width="2" height="3" /></dmndi:DMNShape>
      </dmndi:DMNDiagram></dmndi:DMNDI>
    </dmn:definitions>`;
    const { diagram, warnings } = new DmnXmlConverter().fromXml(xml);
    expect(warnings.some((w) => w.includes('itemDefinition'))).toBe(true);
    expect(warnings.some((w) => w.includes('without a valid href'))).toBe(true);
    expect(warnings.some((w) => w.includes('Invalid bounds'))).toBe(true);
    expect(warnings.some((w) => w.includes('not present in the document'))).toBe(true);
    expect(diagram.edges.dangling.sourceId).toBe('ghost');
    // Non-JSON property values fall back to the raw string.
    const raw = `<dmn:definitions xmlns:dmn="${NS}" id="D2" name="Raw">
      <dmn:decision id="d2" name="X"><dmn:extensionElements><bpmnr:property xmlns:bpmnr="http://bpmn-react.io/schema/1.0" name="note" value="not-json{" /></dmn:extensionElements></dmn:decision>
    </dmn:definitions>`;
    const { diagram: rawImport } = new DmnXmlConverter().fromXml(raw);
    expect(rawImport.nodes.d2.properties.note).toBe('not-json{');
  });

  it('rejects a non-definitions root', () => {
    expect(() => new DmnXmlConverter().fromXml('<dmn:decision id="x" />')).toThrow(
      'Expected <definitions>',
    );
  });
});
