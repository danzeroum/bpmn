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

  it('round-trips typed events via native EventDefinition children', () => {
    const converter = new BpmnXmlConverter();
    const diagram = createDiagram({ name: 'Events', id: 'ev' });
    diagram.nodes = {
      s: createNode({ type: 'startEvent', id: 's', x: 40, y: 40, properties: { eventDefinition: 'message' } }),
      c: createNode({ type: 'intermediateCatchEvent', id: 'c', x: 160, y: 40, properties: { eventDefinition: 'timer' } }),
      t: createNode({ type: 'intermediateThrowEvent', id: 't', x: 280, y: 40, properties: { eventDefinition: 'signal' } }),
    };
    diagram.edges = {
      e1: createEdge({ id: 'e1', sourceId: 's', targetId: 'c' }),
      e2: createEdge({ id: 'e2', sourceId: 'c', targetId: 't' }),
    };

    const xml = converter.toXml(diagram);
    // Standard child elements, not bpmnr:property duplicates.
    expect(xml).toContain('<bpmn:messageEventDefinition');
    expect(xml).toContain('<bpmn:timerEventDefinition');
    expect(xml).toContain('<bpmn:intermediateThrowEvent id="t"');
    expect(xml).not.toContain('name="eventDefinition"');

    const { diagram: imported, warnings } = converter.fromXml(xml);
    expect(warnings).toEqual([]);
    const before = JSON.stringify(normalizeForDiff(diagram));
    const after = JSON.stringify(normalizeForDiff(imported));
    expect(after).toBe(before);
  });

  it('round-trips boundary events (attachedToRef + cancelActivity + kind)', () => {
    const converter = new BpmnXmlConverter();
    const diagram = createDiagram({ name: 'Boundary', id: 'bnd' });
    diagram.nodes = {
      task: createNode({ type: 'task', id: 'task', label: 'Do work', x: 40, y: 40 }),
      timeout: createNode({
        type: 'boundaryEvent',
        id: 'timeout',
        x: 90,
        y: 68,
        properties: { attachedToRef: 'task', eventDefinition: 'timer' },
      }),
      msg: createNode({
        type: 'boundaryEvent',
        id: 'msg',
        x: 130,
        y: 68,
        properties: { attachedToRef: 'task', eventDefinition: 'message', cancelActivity: false },
      }),
    };

    const xml = converter.toXml(diagram);
    expect(xml).toContain('<bpmn:boundaryEvent id="timeout"');
    expect(xml).toContain('attachedToRef="task"');
    expect(xml).toContain('cancelActivity="false"'); // non-interrupting
    expect(xml).toContain('<bpmn:timerEventDefinition');
    expect(xml).not.toContain('name="attachedToRef"'); // not double-encoded as a property

    const { diagram: imported, warnings } = converter.fromXml(xml);
    expect(warnings).toEqual([]);
    expect(imported.nodes.timeout.properties.attachedToRef).toBe('task');
    expect(imported.nodes.timeout.properties.cancelActivity).toBeUndefined(); // interrupting default
    expect(imported.nodes.msg.properties.cancelActivity).toBe(false);
    const before = JSON.stringify(normalizeForDiff(diagram));
    const after = JSON.stringify(normalizeForDiff(imported));
    expect(after).toBe(before);
  });
});

describe('BpmnXmlConverter — pools & lanes', () => {
  function swimlaneDiagram(): BpmnDiagram {
    const diagram = createDiagram({ name: 'Swimlane flow', id: 'swim' });
    diagram.version.changeSummary = 'Swimlane modelling of the review flow.';
    const pool = createNode({ type: 'pool', id: 'pool1', label: 'Editorial', x: 60, y: 40, width: 640, height: 260 });
    const laneA = createNode({
      type: 'lane',
      id: 'laneA',
      label: 'Authors',
      x: 90, y: 40, width: 610, height: 130,
      properties: { flowNodeRefs: ['start', 'write'] },
    });
    const laneB = createNode({
      type: 'lane',
      id: 'laneB',
      label: 'Editors',
      x: 90, y: 170, width: 610, height: 130,
      properties: { flowNodeRefs: ['review'] },
    });
    const start = createNode({ type: 'startEvent', id: 'start', x: 120, y: 80 });
    const write = createNode({ type: 'task', id: 'write', label: 'Write', x: 220, y: 70 });
    const review = createNode({ type: 'userTask', id: 'review', label: 'Review', x: 220, y: 210 });
    diagram.nodes = { pool1: pool, laneA, laneB, start, write, review };
    diagram.edges = {
      e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'write' }),
      e2: createEdge({ id: 'e2', sourceId: 'write', targetId: 'review' }),
    };
    return diagram;
  }

  it('exports a collaboration/participant for pools and a laneSet for lanes', () => {
    const xml = new BpmnXmlConverter().toXml(swimlaneDiagram());
    expect(xml).toContain('<bpmn:collaboration id="Collaboration_swim">');
    expect(xml).toContain('<bpmn:participant id="pool1" name="Editorial" processRef="swim" />');
    expect(xml).toContain('<bpmn:laneSet id="LaneSet_swim">');
    expect(xml).toContain('<bpmn:lane id="laneA" name="Authors">');
    expect(xml).toContain('<bpmn:flowNodeRef>start</bpmn:flowNodeRef>');
    expect(xml).toContain('<bpmn:flowNodeRef>write</bpmn:flowNodeRef>');
    // The plane targets the collaboration when pools exist, and pools/lanes
    // carry the swimlane orientation flag.
    expect(xml).toContain('bpmnElement="Collaboration_swim"');
    expect(xml).toContain('<bpmndi:BPMNShape id="pool1_di" bpmnElement="pool1" isHorizontal="true">');
    // Participants live only in the collaboration, never inside <process>.
    expect(xml).not.toMatch(/<bpmn:process[^>]*>[\s\S]*<bpmn:participant/);
  });

  it('round-trips pools, lanes and lane membership losslessly', () => {
    const original = swimlaneDiagram();
    const converter = new BpmnXmlConverter();
    const { diagram: imported, warnings } = converter.fromXml(converter.toXml(original));

    expect(warnings).toEqual([]);
    expect(imported.nodes.pool1.type).toBe('pool');
    expect(imported.nodes.pool1.label).toBe('Editorial');
    expect(imported.nodes.laneA.type).toBe('lane');
    expect(imported.nodes.laneA.properties.flowNodeRefs).toEqual(['start', 'write']);
    expect(imported.nodes.laneB.properties.flowNodeRefs).toEqual(['review']);
    // Bounds come back through DI.
    expect(imported.nodes.pool1.x).toBe(60);
    expect(imported.nodes.laneA.height).toBe(130);

    const before = JSON.stringify(normalizeForDiff(original));
    const after = JSON.stringify(normalizeForDiff(imported));
    expect(after).toBe(before);
  });

  it('exports messageFlow edges inside the collaboration and round-trips them', () => {
    const diagram = swimlaneDiagram();
    diagram.edges.m1 = createEdge({
      id: 'm1',
      type: 'messageFlow',
      sourceId: 'write',
      targetId: 'review',
      label: 'notify',
    });
    const converter = new BpmnXmlConverter();
    const xml = converter.toXml(diagram);

    // Written as a real message flow in the collaboration, not inside <process>.
    expect(xml).toContain('<bpmn:messageFlow id="m1" sourceRef="write" targetRef="review" name="notify" />');
    expect(xml).not.toMatch(/<bpmn:process[^>]*>[\s\S]*<bpmn:messageFlow/);
    // Its DI edge is still emitted like any other edge.
    expect(xml).toContain('<bpmndi:BPMNEdge id="m1_di" bpmnElement="m1">');

    const { diagram: imported, warnings } = converter.fromXml(xml);
    expect(warnings).toEqual([]);
    expect(imported.edges.m1.type).toBe('messageFlow');
    expect(imported.edges.m1.sourceId).toBe('write');
    expect(imported.edges.m1.label).toBe('notify');

    const before = JSON.stringify(normalizeForDiff(diagram));
    const after = JSON.stringify(normalizeForDiff(imported));
    expect(after).toBe(before);
  });

  it('falls back to sequenceFlow + meta for messageFlow edges when there is no pool', () => {
    const diagram = sampleDiagram(); // no pools
    diagram.edges.m1 = createEdge({ id: 'm1', type: 'messageFlow', sourceId: 'start', targetId: 'gw' });
    const converter = new BpmnXmlConverter();
    const xml = converter.toXml(diagram);
    expect(xml).not.toContain('<bpmn:messageFlow');
    expect(xml).toContain('type="messageFlow"'); // preserved via bpmnr:meta

    const { diagram: imported } = converter.fromXml(xml);
    expect(imported.edges.m1.type).toBe('messageFlow');
  });

  it('exports association edges as bpmn:association and round-trips them', () => {
    const diagram = sampleDiagram();
    diagram.nodes.note = createNode({ type: 'textAnnotation', id: 'note', label: 'A note', x: 400, y: 200 });
    diagram.edges.a1 = createEdge({ id: 'a1', type: 'association', sourceId: 'review', targetId: 'note' });
    const converter = new BpmnXmlConverter();
    const xml = converter.toXml(diagram);
    expect(xml).toContain('<bpmn:association id="a1" sourceRef="review" targetRef="note" />');

    const { diagram: imported, warnings } = converter.fromXml(xml);
    expect(warnings).toEqual([]);
    expect(imported.edges.a1.type).toBe('association');

    const before = JSON.stringify(normalizeForDiff(diagram));
    const after = JSON.stringify(normalizeForDiff(imported));
    expect(after).toBe(before);
  });

  it('drops stale flowNodeRefs (deleted nodes) on export', () => {
    const diagram = swimlaneDiagram();
    diagram.nodes.laneA = {
      ...diagram.nodes.laneA,
      properties: { flowNodeRefs: ['start', 'ghost-deleted', 'write'] },
    };
    const xml = new BpmnXmlConverter().toXml(diagram);
    expect(xml).not.toContain('ghost-deleted');
    expect(xml).toContain('<bpmn:flowNodeRef>start</bpmn:flowNodeRef>');
    expect(xml).toContain('<bpmn:flowNodeRef>write</bpmn:flowNodeRef>');
  });

  it('imports lanes from an external document without pools', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="p" name="Lanes only">
    <bpmn:laneSet id="ls">
      <bpmn:lane id="l1" name="Team A">
        <bpmn:flowNodeRef>t1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:task id="t1" name="Work"/>
  </bpmn:process>
</bpmn:definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(diagram.nodes.l1.type).toBe('lane');
    expect(diagram.nodes.l1.label).toBe('Team A');
    expect(diagram.nodes.l1.properties.flowNodeRefs).toEqual(['t1']);
    expect(diagram.nodes.t1.type).toBe('task');
    // laneSet is not misread as an unknown flow element.
    expect(warnings.some((w) => w.includes('laneSet'))).toBe(false);
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

  it('imports typed events (message start, timer intermediate) without warnings', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="defs" targetNamespace="http://example.com">
  <bpmn2:process id="proc_1" name="Typed events">
    <bpmn2:startEvent id="s1" name="Order received">
      <bpmn2:messageEventDefinition id="s1_def"/>
    </bpmn2:startEvent>
    <bpmn2:intermediateCatchEvent id="w1" name="Wait 1d">
      <bpmn2:timerEventDefinition id="w1_def"/>
    </bpmn2:intermediateCatchEvent>
    <bpmn2:endEvent id="e1" name="Stop">
      <bpmn2:terminateEventDefinition id="e1_def"/>
    </bpmn2:endEvent>
    <bpmn2:sequenceFlow id="f1" sourceRef="s1" targetRef="w1"/>
    <bpmn2:sequenceFlow id="f2" sourceRef="w1" targetRef="e1"/>
  </bpmn2:process>
  <bpmndi:BPMNDiagram xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="d1">
    <bpmndi:BPMNPlane id="p1" bpmnElement="proc_1">
      <bpmndi:BPMNShape id="s1_di" bpmnElement="s1"><dc:Bounds x="40" y="40" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="w1_di" bpmnElement="w1"><dc:Bounds x="160" y="40" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="e1_di" bpmnElement="e1"><dc:Bounds x="280" y="40" width="36" height="36"/></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(warnings).toEqual([]);
    expect(diagram.nodes.s1.type).toBe('startEvent');
    expect(diagram.nodes.s1.properties.eventDefinition).toBe('message');
    expect(diagram.nodes.w1.type).toBe('intermediateCatchEvent');
    expect(diagram.nodes.w1.properties.eventDefinition).toBe('timer');
    expect(diagram.nodes.e1.type).toBe('endEvent');
    expect(diagram.nodes.e1.properties.eventDefinition).toBe('terminate');
  });

  it('imports a Camunda boundary event without warnings', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="defs" targetNamespace="http://example.com">
  <bpmn2:process id="proc_1" name="Boundary import">
    <bpmn2:task id="t1" name="Work"/>
    <bpmn2:boundaryEvent id="b1" name="Timeout" attachedToRef="t1" cancelActivity="false">
      <bpmn2:timerEventDefinition id="b1_def"/>
    </bpmn2:boundaryEvent>
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="d1">
    <bpmndi:BPMNPlane id="p1" bpmnElement="proc_1">
      <bpmndi:BPMNShape id="t1_di" bpmnElement="t1"><dc:Bounds x="40" y="40" width="120" height="60"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="b1_di" bpmnElement="b1"><dc:Bounds x="142" y="82" width="36" height="36"/></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(warnings).toEqual([]);
    expect(diagram.nodes.b1.type).toBe('boundaryEvent');
    expect(diagram.nodes.b1.properties.attachedToRef).toBe('t1');
    expect(diagram.nodes.b1.properties.cancelActivity).toBe(false);
    expect(diagram.nodes.b1.properties.eventDefinition).toBe('timer');
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
