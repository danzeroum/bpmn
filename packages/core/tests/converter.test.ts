import { describe, expect, it } from 'vitest';
import {
  BpmnParseError,
  BpmnXmlConverter,
  createDefaultRegistry,
  createDiagram,
  createEdge,
  createNode,
  normalizeForDiff,
  type BpmnDiagram,
} from '../src/index.js';

function sampleDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Order flow', id: 'order-flow' });
  diagram.description = 'Handles orders';
  diagram.metadata = { team: 'ops', priority: 3 };
  diagram.version.changeSummary = 'Initial modelling of the order flow.';

  const start = createNode({ type: 'startEvent', id: 'start', x: 100, y: 100 });
  const review = createNode({
    type: 'userTask',
    id: 'review',
    label: 'Review order ✅ <urgent> & "check"',
    x: 220,
    y: 80,
    properties: { assignee: 'alice', limits: { max: 10 }, tags: ['a', 'b'] },
  });
  const gateway = createNode({ type: 'exclusiveGateway', id: 'gw', x: 420, y: 90 });
  const done = createNode({ type: 'endEvent', id: 'done', x: 560, y: 100 });
  diagram.nodes = { start, review, gw: gateway, done };

  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'review', purpose: 'kick-off' }),
    e2: createEdge({ id: 'e2', sourceId: 'review', targetId: 'gw', label: 'reviewed' }),
    e3: {
      ...createEdge({ id: 'e3', sourceId: 'gw', targetId: 'done' }),
      waypoints: [
        { x: 470, y: 115 },
        { x: 560, y: 118 },
      ],
    },
  };
  return diagram;
}

describe('BpmnXmlConverter.toXml', () => {
  it('produces a BPMN 2.0 document with namespaces and DI', () => {
    const xml = new BpmnXmlConverter().toXml(sampleDiagram());
    expect(xml).toContain('xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"');
    expect(xml).toContain('<bpmn:process id="order-flow"');
    expect(xml).toContain('<bpmn:startEvent id="start"');
    expect(xml).toContain('<bpmn:userTask id="review"');
    expect(xml).toContain('sourceRef="start"');
    expect(xml).toContain('<bpmndi:BPMNShape id="review_di" bpmnElement="review">');
    expect(xml).toContain('<dc:Bounds x="220" y="80" width="120" height="60" />');
    expect(xml).toContain('<bpmndi:BPMNEdge id="e3_di" bpmnElement="e3">');
    expect(xml).toContain('<di:waypoint x="470" y="115" />');
  });

  it('emits waypoints for every edge (computed when absent)', () => {
    const xml = new BpmnXmlConverter().toXml(sampleDiagram());
    for (const id of ['e1', 'e2', 'e3']) {
      expect(xml).toContain(`<bpmndi:BPMNEdge id="${id}_di"`);
    }
  });

  it('escapes special characters in labels', () => {
    const xml = new BpmnXmlConverter().toXml(sampleDiagram());
    expect(xml).toContain('Review order ✅ &lt;urgent&gt; &amp; &quot;check&quot;');
    expect(xml).not.toContain('<urgent>');
  });
});

describe('BpmnXmlConverter round-trip', () => {
  it('round-trips content losslessly (normalized diff is identical)', () => {
    const original = sampleDiagram();
    const converter = new BpmnXmlConverter();
    const xml = converter.toXml(original);
    const { diagram: imported, warnings } = converter.fromXml(xml);

    expect(warnings).toEqual([]);
    expect(imported.name).toBe(original.name);
    expect(imported.description).toBe(original.description);
    expect(imported.metadata).toEqual(original.metadata);
    expect(imported.version.semanticVersion).toBe(original.version.semanticVersion);
    expect(imported.version.status).toBe(original.version.status);
    expect(imported.version.id).toBe(original.version.id);

    // Coordinates come back through DI
    expect(imported.nodes.review.x).toBe(220);
    expect(imported.nodes.review.y).toBe(80);
    expect(imported.edges.e3.waypoints).toEqual(original.edges.e3.waypoints);
    expect(imported.edges.e1.purpose).toBe('kick-off');

    const before = JSON.stringify(normalizeForDiff(original));
    const after = JSON.stringify(normalizeForDiff(imported));
    expect(after).toBe(before);
  });

  it('round-trips temporal immutability metadata (closed + superseded edges)', () => {
    const diagram = sampleDiagram();
    diagram.edges.e1 = { ...diagram.edges.e1, removedInVersion: 'v42' };
    diagram.edges.e4 = createEdge({
      id: 'e4',
      sourceId: 'start',
      targetId: 'gw',
      supersedesEdgeId: 'e1',
      versionId: 'v42',
    });
    const converter = new BpmnXmlConverter();
    const { diagram: imported } = converter.fromXml(converter.toXml(diagram));
    expect(imported.edges.e1.removedInVersion).toBe('v42');
    expect(imported.edges.e4.supersedesEdgeId).toBe('e1');
    expect(imported.edges.e4.createdInVersion).toBe('v42');
  });

  it('round-trips custom node types via meta + preferred mapping', () => {
    const registry = createDefaultRegistry();
    registry.register({
      type: 'demo:persona',
      label: 'Persona',
      category: 'custom',
      defaultSize: { width: 140, height: 80 },
      xml: { tag: 'userTask' },
    });
    const converter = new BpmnXmlConverter({ registry });

    const diagram = createDiagram({ name: 'D', id: 'd' });
    const persona = createNode(
      { type: 'demo:persona', id: 'p1', label: 'Editor', x: 10, y: 20 },
      registry,
    );
    diagram.nodes = { p1: persona };

    const xml = converter.toXml(diagram);
    expect(xml).toContain('<bpmn:userTask id="p1"'); // interoperable tag
    expect(xml).toContain('type="demo:persona"'); // identity preserved

    const { diagram: imported } = converter.fromXml(xml);
    expect(imported.nodes.p1.type).toBe('demo:persona');
    expect(imported.nodes.p1.width).toBe(140); // registry default size, then DI overrides
  });
});

describe('BpmnXmlConverter.fromXml — external documents', () => {
  it('imports a minimal Camunda-style document without extensions', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="defs" targetNamespace="http://example.com">
  <bpmn2:process id="proc_1" name="External">
    <bpmn2:startEvent id="s1" name="Begin"/>
    <bpmn2:userTask id="t1" name="Do work"/>
    <bpmn2:sequenceFlow id="f1" sourceRef="s1" targetRef="t1"/>
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="d1">
    <bpmndi:BPMNPlane id="p1" bpmnElement="proc_1">
      <bpmndi:BPMNShape id="s1_di" bpmnElement="s1"><dc:Bounds x="10" y="20" width="36" height="36"/></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(diagram.name).toBe('External');
    expect(diagram.version.status).toBe('draft');
    expect(diagram.nodes.s1.type).toBe('startEvent');
    expect(diagram.nodes.s1.x).toBe(10);
    expect(diagram.nodes.t1.type).toBe('userTask');
    expect(diagram.edges.f1.sourceId).toBe('s1');
    expect(warnings).toEqual([]);
  });

  it('warns about unsupported elements instead of failing', () => {
    const xml = `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <process id="p">
        <startEvent id="s"/>
        <callActivity id="weird"/>
      </process>
    </definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(diagram.nodes.s).toBeDefined();
    expect(diagram.nodes.weird).toBeUndefined();
    expect(warnings.some((w) => w.includes('callActivity'))).toBe(true);
  });

  it('applies a grid layout and warns when DI is missing', () => {
    const xml = `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <process id="p">
        <startEvent id="a"/>
        <task id="b"/>
      </process>
    </definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(warnings.some((w) => w.includes('no BPMN DI'))).toBe(true);
    expect(diagram.nodes.a.x).not.toBe(diagram.nodes.b.x);
  });

  it('warns about dangling edge references', () => {
    const xml = `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <process id="p">
        <startEvent id="a"/>
        <sequenceFlow id="f" sourceRef="a" targetRef="ghost"/>
      </process>
    </definitions>`;
    const { warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(warnings.some((w) => w.includes('references a node'))).toBe(true);
  });

  it('warns about (and drops) a sequenceFlow missing sourceRef or targetRef outright', () => {
    const xml = `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <process id="p">
        <startEvent id="a"/>
        <task id="b"/>
        <sequenceFlow id="no-source" targetRef="b"/>
        <sequenceFlow id="no-target" sourceRef="a"/>
        <sequenceFlow id="neither"/>
        <sequenceFlow id="fine" sourceRef="a" targetRef="b"/>
      </process>
    </definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);

    expect(diagram.edges['no-source']).toBeUndefined();
    expect(diagram.edges['no-target']).toBeUndefined();
    expect(diagram.edges.neither).toBeUndefined();
    expect(diagram.edges.fine).toBeDefined();

    expect(warnings.filter((w) => w.includes('without source/target refs'))).toHaveLength(3);
    expect(warnings.some((w) => w.includes('no-source'))).toBe(true);
    expect(warnings.some((w) => w.includes('no-target'))).toBe(true);
    expect(warnings.some((w) => w.includes('neither'))).toBe(true);
  });

  it('warns about (and ignores) non-numeric or missing dc:Bounds attributes', () => {
    const xml = `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
      xmlns:dc="http://www.omg.org/spec/DD/20100524/DC">
      <process id="p">
        <startEvent id="a" name="Broken bounds"/>
        <task id="b" name="Missing bounds"/>
        <task id="c" name="Good bounds"/>
      </process>
      <bpmndi:BPMNDiagram id="d1">
        <bpmndi:BPMNPlane id="pl1" bpmnElement="p">
          <bpmndi:BPMNShape id="a_di" bpmnElement="a">
            <dc:Bounds x="not-a-number" y="10" width="36" height="36"/>
          </bpmndi:BPMNShape>
          <bpmndi:BPMNShape id="b_di" bpmnElement="b"/>
          <bpmndi:BPMNShape id="c_di" bpmnElement="c">
            <dc:Bounds x="200" y="80" width="120" height="60"/>
          </bpmndi:BPMNShape>
        </bpmndi:BPMNPlane>
      </bpmndi:BPMNDiagram>
    </definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);

    // Invalid bounds: the node keeps its registry-default geometry rather
    // than adopting NaN coordinates.
    expect(Number.isNaN(diagram.nodes.a.x)).toBe(false);
    expect(warnings.some((w) => w.includes('Invalid bounds for shape a'))).toBe(true);

    // A shape with no <dc:Bounds> at all is simply left unpositioned by
    // applyDi (no crash, no warning specific to it — the grid-layout
    // fallback only triggers when *no* shape in the document has DI at all).
    expect(diagram.nodes.b).toBeDefined();

    // A well-formed shape elsewhere in the same document is unaffected.
    expect(diagram.nodes.c.x).toBe(200);
    expect(diagram.nodes.c.y).toBe(80);
  });

  it('throws readable errors for invalid documents', () => {
    const converter = new BpmnXmlConverter();
    expect(() => converter.fromXml('not xml at all')).toThrow(BpmnParseError);
    expect(() => converter.fromXml('<definitions/>')).toThrow(/process/);
    expect(() => converter.fromXml('<wrong><process/></wrong>')).toThrow(/definitions/);
    expect(() =>
      converter.fromXml('<!DOCTYPE x><definitions><process/></definitions>'),
    ).toThrow(/DOCTYPE/);
  });
});
