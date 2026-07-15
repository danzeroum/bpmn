import { describe, expect, it } from 'vitest';
import {
  BpmnParseError,
  BpmnXmlConverter,
  childrenOf,
  createDefaultRegistry,
  createDiagram,
  createEdge,
  createNode,
  descendantIdsOf,
  isSubProcessExpanded,
  nodeParentId,
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
    // Handoff 11 N-1: the import DERIVES the parametric anchor from the DI
    // geometry — editor-only state, outside the round-trip identity. Assert
    // the derivation, then strip the pair before comparing.
    expect(imported.nodes.timeout.properties.boundarySide).toBe('bottom');
    expect(imported.nodes.msg.properties.boundarySide).toBe('right');
    for (const node of Object.values(imported.nodes)) {
      delete node.properties.boundarySide;
      delete node.properties.boundaryT;
    }
    const before = JSON.stringify(normalizeForDiff(diagram));
    const after = JSON.stringify(normalizeForDiff(imported));
    expect(after).toBe(before);
  });

  it('round-trips send/receive/manual tasks and activity markers', () => {
    const converter = new BpmnXmlConverter();
    const diagram = createDiagram({ name: 'Tasks', id: 'tk' });
    diagram.nodes = {
      send: createNode({ type: 'sendTask', id: 'send', label: 'Notify', x: 20, y: 20 }),
      recv: createNode({ type: 'receiveTask', id: 'recv', label: 'Await', x: 160, y: 20 }),
      man: createNode({ type: 'manualTask', id: 'man', label: 'Sign', x: 300, y: 20 }),
      loop: createNode({ type: 'task', id: 'loop', label: 'Retry', x: 20, y: 120, properties: { marker: 'loop' } }),
      mi: createNode({ type: 'userTask', id: 'mi', label: 'Reviewers', x: 160, y: 120, properties: { marker: 'parallelMultiInstance' } }),
    };
    const xml = converter.toXml(diagram);
    expect(xml).toContain('<bpmn:sendTask id="send"');
    expect(xml).toContain('<bpmn:receiveTask id="recv"');
    expect(xml).toContain('<bpmn:manualTask id="man"');
    expect(xml).toContain('<bpmn:standardLoopCharacteristics');
    expect(xml).toContain('<bpmn:multiInstanceLoopCharacteristics isSequential="false"');
    expect(xml).not.toContain('name="marker"'); // native child, not a bpmnr:property

    const { diagram: imported, warnings } = converter.fromXml(xml);
    expect(warnings).toEqual([]);
    expect(imported.nodes.loop.properties.marker).toBe('loop');
    expect(imported.nodes.mi.properties.marker).toBe('parallelMultiInstance');
    expect(JSON.stringify(normalizeForDiff(imported))).toBe(
      JSON.stringify(normalizeForDiff(diagram)),
    );
  });

  it('round-trips an event-based gateway and a group artifact', () => {
    const converter = new BpmnXmlConverter();
    const diagram = createDiagram({ name: 'GwGroup', id: 'gg' });
    diagram.nodes = {
      g: createNode({ type: 'eventBasedGateway', id: 'g', x: 40, y: 40 }),
      grp: createNode({ type: 'group', id: 'grp', label: 'Cluster', x: 120, y: 20 }),
    };
    const xml = converter.toXml(diagram);
    expect(xml).toContain('<bpmn:eventBasedGateway id="g"');
    expect(xml).toContain('<bpmn:group id="grp"');
    const { diagram: imported, warnings } = converter.fromXml(xml);
    expect(warnings).toEqual([]);
    expect(JSON.stringify(normalizeForDiff(imported))).toBe(
      JSON.stringify(normalizeForDiff(diagram)),
    );
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

  it('imports a Camunda multi-instance task without warnings', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="defs" targetNamespace="http://example.com">
  <bpmn2:process id="proc_1" name="MI">
    <bpmn2:userTask id="t1" name="Approve">
      <bpmn2:multiInstanceLoopCharacteristics isSequential="true"/>
    </bpmn2:userTask>
    <bpmn2:sendTask id="t2" name="Notify"/>
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="d1">
    <bpmndi:BPMNPlane id="p1" bpmnElement="proc_1">
      <bpmndi:BPMNShape id="t1_di" bpmnElement="t1"><dc:Bounds x="40" y="40" width="120" height="60"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="t2_di" bpmnElement="t2"><dc:Bounds x="200" y="40" width="120" height="60"/></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(warnings).toEqual([]);
    expect(diagram.nodes.t1.properties.marker).toBe('sequentialMultiInstance');
    expect(diagram.nodes.t2.type).toBe('sendTask');
  });

  it('imports an event-based gateway and a group artifact without warnings', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="defs" targetNamespace="http://example.com">
  <bpmn2:process id="proc_1" name="Gateway + group">
    <bpmn2:eventBasedGateway id="g1" name="Wait for"/>
    <bpmn2:group id="grp1" name="Cluster"/>
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="d1">
    <bpmndi:BPMNPlane id="p1" bpmnElement="proc_1">
      <bpmndi:BPMNShape id="g1_di" bpmnElement="g1"><dc:Bounds x="40" y="40" width="50" height="50"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="grp1_di" bpmnElement="grp1"><dc:Bounds x="120" y="20" width="220" height="140"/></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(warnings).toEqual([]);
    expect(diagram.nodes.g1.type).toBe('eventBasedGateway');
    expect(diagram.nodes.grp1.type).toBe('group');
    expect(diagram.nodes.grp1.width).toBe(220);
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
        <transaction id="weird"/>
      </process>
    </definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(diagram.nodes.s).toBeDefined();
    expect(diagram.nodes.weird).toBeUndefined();
    expect(warnings.some((w) => w.includes('transaction'))).toBe(true);
  });

  it('drops complexGateway with a named warning suggesting an inclusive gateway', () => {
    const xml = `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <process id="p">
        <startEvent id="s"/>
        <complexGateway id="cx"/>
      </process>
    </definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(diagram.nodes.cx).toBeUndefined();
    const warning = warnings.find((w) => w.includes('complexGateway'));
    expect(warning).toBeDefined();
    // Names the element (with its id) and points at the concrete remedy —
    // not the generic "Ignored unsupported element" line.
    expect(warning).toContain('id="cx"');
    expect(warning).toContain('inclusive gateway');
    expect(warning).not.toContain('Ignored unsupported element');
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

describe('BpmnXmlConverter — nested sub-processes (F7)', () => {
  // Structural mirror of a Camunda Modeler export: an expanded embedded
  // sub-process with its own start/task/end, a boundary event on the inner
  // task, and a second (collapsed) level of nesting.
  const NESTED = `<?xml version="1.0" encoding="UTF-8"?>
  <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Defs_nested"
    targetNamespace="http://bpmn.io/schema/bpmn">
    <bpmn:process id="Process_nested" isExecutable="true">
      <bpmn:startEvent id="Start_1" />
      <bpmn:subProcess id="Sub_outer" name="Handle order">
        <bpmn:startEvent id="Sub_start" />
        <bpmn:userTask id="Sub_task" name="Pick items" />
        <bpmn:boundaryEvent id="Sub_bnd" attachedToRef="Sub_task" cancelActivity="false">
          <bpmn:timerEventDefinition id="Td_1" />
        </bpmn:boundaryEvent>
        <bpmn:subProcess id="Sub_inner" name="Quality check">
          <bpmn:task id="Deep_task" name="Inspect" />
        </bpmn:subProcess>
        <bpmn:endEvent id="Sub_end" />
        <bpmn:sequenceFlow id="Sub_f1" sourceRef="Sub_start" targetRef="Sub_task" />
        <bpmn:sequenceFlow id="Sub_f2" sourceRef="Sub_task" targetRef="Sub_inner" />
        <bpmn:sequenceFlow id="Sub_f3" sourceRef="Sub_inner" targetRef="Sub_end" />
      </bpmn:subProcess>
      <bpmn:endEvent id="End_1" />
      <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Sub_outer" />
      <bpmn:sequenceFlow id="Flow_2" sourceRef="Sub_outer" targetRef="End_1" />
    </bpmn:process>
    <bpmndi:BPMNDiagram id="Diag_nested">
      <bpmndi:BPMNPlane id="Plane_nested" bpmnElement="Process_nested">
        <bpmndi:BPMNShape id="Sub_outer_di" bpmnElement="Sub_outer" isExpanded="true">
          <dc:Bounds x="200" y="80" width="420" height="240" />
        </bpmndi:BPMNShape>
        <bpmndi:BPMNShape id="Sub_inner_di" bpmnElement="Sub_inner" isExpanded="false">
          <dc:Bounds x="440" y="150" width="120" height="80" />
        </bpmndi:BPMNShape>
        <bpmndi:BPMNShape id="Sub_task_di" bpmnElement="Sub_task">
          <dc:Bounds x="280" y="140" width="120" height="60" />
        </bpmndi:BPMNShape>
      </bpmndi:BPMNPlane>
    </bpmndi:BPMNDiagram>
  </bpmn:definitions>`;

  it('imports children as first-class nodes with parentId set', () => {
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(NESTED);
    expect(warnings).toEqual([]);
    expect(Object.keys(diagram.nodes).sort()).toEqual([
      'Deep_task', 'End_1', 'Start_1', 'Sub_bnd', 'Sub_end', 'Sub_inner',
      'Sub_outer', 'Sub_start', 'Sub_task',
    ]);
    expect(nodeParentId(diagram.nodes.Sub_task)).toBe('Sub_outer');
    expect(nodeParentId(diagram.nodes.Sub_bnd)).toBe('Sub_outer');
    expect(nodeParentId(diagram.nodes.Sub_inner)).toBe('Sub_outer');
    expect(nodeParentId(diagram.nodes.Deep_task)).toBe('Sub_inner');
    expect(nodeParentId(diagram.nodes.Start_1)).toBeUndefined();
    // Inner edges import flat but keep endpoint scoping.
    expect(Object.keys(diagram.edges).sort()).toEqual([
      'Flow_1', 'Flow_2', 'Sub_f1', 'Sub_f2', 'Sub_f3',
    ]);
    // DI expansion round-trips into properties.
    expect(isSubProcessExpanded(diagram.nodes.Sub_outer)).toBe(true);
    expect(isSubProcessExpanded(diagram.nodes.Sub_inner)).toBe(false);
    // Containment helpers see the hierarchy.
    expect(childrenOf(diagram, 'Sub_outer').map((n) => n.id)).toEqual([
      'Sub_start', 'Sub_task', 'Sub_bnd', 'Sub_inner', 'Sub_end',
    ]);
    expect(descendantIdsOf(diagram, 'Sub_outer')).toContain('Deep_task');
  });

  it('re-exports the hierarchy nested and round-trips losslessly', () => {
    const converter = () => new BpmnXmlConverter();
    const first = converter().fromXml(NESTED);
    const xml = converter().toXml(first.diagram);

    // Children and inner flows are nested inside their container element
    // (the LAST closing tag belongs to Sub_outer — top-level flows follow it).
    const outer = xml.slice(
      xml.indexOf('<bpmn:subProcess id="Sub_outer"'),
      xml.lastIndexOf('</bpmn:subProcess>'),
    );
    expect(outer).toContain('<bpmn:userTask id="Sub_task"');
    expect(outer).toContain('<bpmn:sequenceFlow id="Sub_f1"');
    expect(outer).toContain('<bpmn:subProcess id="Sub_inner"');
    // parentId is encoded structurally, never as a bpmnr:property.
    expect(xml).not.toContain('name="parentId"');
    expect(xml).not.toContain('name="isExpanded"');
    // DI carries expansion.
    expect(xml).toContain('bpmnElement="Sub_outer" isExpanded="true"');
    expect(xml).toContain('bpmnElement="Sub_inner" isExpanded="false"');

    const second = converter().fromXml(xml);
    expect(second.warnings).toEqual([]);
    expect(normalizeForDiff(second.diagram)).toEqual(normalizeForDiff(first.diagram));
    // Canonical form is stable.
    expect(converter().toXml(second.diagram)).toBe(xml);
  });

  it('warns and skips a laneSet inside a sub-process', () => {
    const xml = `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">
      <bpmn:process id="P">
        <bpmn:subProcess id="Sub_1">
          <bpmn:laneSet id="Ls"><bpmn:lane id="L1" /></bpmn:laneSet>
          <bpmn:task id="T1" />
        </bpmn:subProcess>
      </bpmn:process>
    </bpmn:definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(warnings.some((w) => w.includes('laneSet') && w.includes('Sub_1'))).toBe(true);
    expect(diagram.nodes.L1).toBeUndefined();
    expect(nodeParentId(diagram.nodes.T1)).toBe('Sub_1');
  });
});

describe('BpmnXmlConverter — reparent export contract (F7 · pre-PR2)', () => {
  const converter = () => new BpmnXmlConverter();

  // A flat diagram: an expanded (already populated) sub-process alongside two
  // top-level tasks joined by a flow. This is the pre-reparent state — nothing
  // belongs to the sub-process yet. Reparent-on-drop (PR2) will set the two
  // tasks' properties.parentId to the sub-process; these tests pin the export
  // contract that gesture relies on. The round-trip is already correct on main,
  // so this is a regression trap: PR2's authored output can never silently
  // start exporting broken (children left at the process level, coordinates
  // translated, or parentId leaking as a bpmnr:property).
  function flatDiagram(): BpmnDiagram {
    const diagram = createDiagram({ name: 'Fulfilment', id: 'reparent-flow' });
    const v = diagram.version.id;
    diagram.nodes = {
      sub: createNode({
        type: 'subProcess', id: 'sub', label: 'Handle order', x: 200, y: 80,
        width: 400, height: 260, properties: { isExpanded: true }, versionId: v,
      }),
      // Seed child so the sub-process starts populated (as after an IMPORT).
      s0: createNode({
        type: 'startEvent', id: 's0', x: 240, y: 180,
        properties: { parentId: 'sub' }, versionId: v,
      }),
      A: createNode({ type: 'task', id: 'A', label: 'Pick', x: 700, y: 160, versionId: v }),
      B: createNode({ type: 'task', id: 'B', label: 'Pack', x: 860, y: 160, versionId: v }),
    };
    diagram.edges = {
      F: createEdge({ id: 'F', sourceId: 'A', targetId: 'B', versionId: v }),
    };
    return diagram;
  }

  /** Slice of the serialized <subProcess id="sub"> element (its own children). */
  function subBody(xml: string): string {
    return xml.slice(xml.indexOf('<bpmn:subProcess id="sub"'), xml.indexOf('</bpmn:subProcess>'));
  }

  it('leaves un-reparented nodes at the process level (baseline)', () => {
    const xml = converter().toXml(flatDiagram());
    const body = subBody(xml);
    expect(body).not.toContain('id="A"');
    expect(body).not.toContain('id="B"');
    // The flow between two top-level nodes stays at the process level.
    expect(body).not.toContain('<bpmn:sequenceFlow id="F"');
  });

  it('nests a formerly top-level node once its parentId is set (the reparent gesture)', () => {
    const diagram = flatDiagram();
    const beforeA = { x: diagram.nodes.A.x, y: diagram.nodes.A.y };
    // Exactly what reparent-on-drop writes: parentId onto existing nodes. Both
    // endpoints join the sub-process, so their flow scopes into it too.
    diagram.nodes.A.properties.parentId = 'sub';
    diagram.nodes.B.properties.parentId = 'sub';

    const xml = converter().toXml(diagram);
    const body = subBody(xml);
    expect(body).toContain('<bpmn:task id="A"');
    expect(body).toContain('<bpmn:task id="B"');
    expect(body).toContain('<bpmn:sequenceFlow id="F"');
    // parentId is structural, never a bpmnr:property.
    expect(xml).not.toContain('name="parentId"');
    // DI is absolute — reparent does NOT translate coordinates (pendencias 8.0).
    // A's bounds (unique x) prove the shape kept its pre-reparent position.
    expect(xml).toContain(`bpmnElement="A">`);
    expect(xml).toContain(`<dc:Bounds x="${beforeA.x}" y="${beforeA.y}" width="120" height="60" />`);
  });

  it('round-trips the reparented result losslessly and byte-stable', () => {
    const diagram = flatDiagram();
    diagram.nodes.A.properties.parentId = 'sub';
    diagram.nodes.B.properties.parentId = 'sub';

    const xml = converter().toXml(diagram);
    const first = converter().fromXml(xml);
    expect(first.warnings).toEqual([]);
    expect(nodeParentId(first.diagram.nodes.A)).toBe('sub');
    expect(nodeParentId(first.diagram.nodes.B)).toBe('sub');
    expect(childrenOf(first.diagram, 'sub').map((n) => n.id).sort()).toEqual(['A', 'B', 's0']);
    // The internal flow survives with its endpoints intact.
    expect(first.diagram.edges.F).toMatchObject({ sourceId: 'A', targetId: 'B' });

    expect(normalizeForDiff(converter().fromXml(xml).diagram)).toEqual(
      normalizeForDiff(first.diagram),
    );
    expect(converter().toXml(first.diagram)).toBe(xml);
  });

  it('nests recursively when parentId points at a nested sub-process (hit-test edge case)', () => {
    // The PR2 hierarchical hit-test can drop a node into the DEEPEST container:
    // outer ⊃ inner ⊃ deep. Authored purely via parentId chains — the export
    // must recurse, not flatten.
    const diagram = createDiagram({ name: 'Nested', id: 'nested-reparent' });
    const v = diagram.version.id;
    diagram.nodes = {
      outer: createNode({
        type: 'subProcess', id: 'outer', label: 'Outer', x: 100, y: 80,
        width: 460, height: 300, properties: { isExpanded: true }, versionId: v,
      }),
      inner: createNode({
        type: 'subProcess', id: 'inner', label: 'Inner', x: 160, y: 150,
        width: 320, height: 180,
        properties: { isExpanded: true, parentId: 'outer' }, versionId: v,
      }),
      deep: createNode({
        type: 'task', id: 'deep', label: 'Inspect', x: 220, y: 210,
        properties: { parentId: 'inner' }, versionId: v,
      }),
    };

    const xml = converter().toXml(diagram);
    // deep nests inside inner, which nests inside outer.
    const outerBody = xml.slice(
      xml.indexOf('<bpmn:subProcess id="outer"'),
      xml.lastIndexOf('</bpmn:subProcess>'),
    );
    const innerBody = outerBody.slice(
      outerBody.indexOf('<bpmn:subProcess id="inner"'),
      outerBody.indexOf('</bpmn:subProcess>'),
    );
    expect(innerBody).toContain('<bpmn:task id="deep"');

    const back = converter().fromXml(xml);
    expect(back.warnings).toEqual([]);
    expect(nodeParentId(back.diagram.nodes.deep)).toBe('inner');
    expect(nodeParentId(back.diagram.nodes.inner)).toBe('outer');
    expect(descendantIdsOf(back.diagram, 'outer').sort()).toEqual(['deep', 'inner']);
    expect(normalizeForDiff(back.diagram)).toEqual(normalizeForDiff(diagram));
    expect(converter().toXml(back.diagram)).toBe(xml);
  });
});

describe('BpmnXmlConverter — call activities & data elements (F7-3)', () => {
  function dataDiagram(): BpmnDiagram {
    const diagram = createDiagram({ name: 'Data flow', id: 'data-flow' });
    const v = diagram.version.id;
    diagram.nodes = {
      call: createNode({
        type: 'callActivity', id: 'call', label: 'Charge customer', x: 100, y: 100,
        properties: { calledElement: 'billing-process' }, versionId: v,
      }),
      store: createNode({
        type: 'dataStore', id: 'store', label: 'Orders DB', x: 300, y: 220,
        properties: { dataStoreRef: 'DS_orders' }, versionId: v,
      }),
      doc: createNode({ type: 'dataObject', id: 'doc', label: 'Invoice', x: 60, y: 220, versionId: v }),
      sub: (() => {
        const n = createNode({
          type: 'subProcess', id: 'sub', label: 'Fulfil', x: 260, y: 60,
          properties: { isExpanded: true }, versionId: v,
        });
        n.width = 300; n.height = 140;
        return n;
      })(),
      inner: createNode({
        type: 'task', id: 'inner', label: 'Pack', x: 300, y: 100,
        properties: { parentId: 'sub' }, versionId: v,
      }),
    };
    diagram.edges = {
      // Input: data → activity; output: activity → data.
      din: createEdge({ id: 'din', sourceId: 'doc', targetId: 'call', type: 'dataAssociation', versionId: v }),
      dout: createEdge({ id: 'dout', sourceId: 'call', targetId: 'store', type: 'dataAssociation', versionId: v }),
      // Crosses the sub-process boundary — legal for data associations.
      dnested: createEdge({ id: 'dnested', sourceId: 'inner', targetId: 'store', type: 'dataAssociation', versionId: v }),
    };
    return diagram;
  }

  it('exports native attributes and nested standard data associations', () => {
    const xml = new BpmnXmlConverter().toXml(dataDiagram());
    expect(xml).toContain('<bpmn:callActivity id="call" name="Charge customer" calledElement="billing-process"');
    expect(xml).toContain('<bpmn:dataStoreReference id="store" name="Orders DB" dataStoreRef="DS_orders"');
    // Encoded natively — never double-encoded as bpmnr:property.
    expect(xml).not.toContain('name="calledElement"');
    expect(xml).not.toContain('name="dataStoreRef"');
    // Input association nests in the activity with the data-side sourceRef.
    const call = xml.slice(xml.indexOf('<bpmn:callActivity'), xml.indexOf('</bpmn:callActivity>'));
    expect(call).toContain('<bpmn:dataInputAssociation id="din">');
    expect(call).toContain('<bpmn:sourceRef>doc</bpmn:sourceRef>');
    expect(call).toContain('<bpmn:dataOutputAssociation id="dout">');
    expect(call).toContain('<bpmn:targetRef>store</bpmn:targetRef>');
    // The nested activity carries its own association inside the sub-process.
    const sub = xml.slice(xml.indexOf('<bpmn:subProcess'), xml.indexOf('</bpmn:subProcess>'));
    expect(sub).toContain('<bpmn:dataOutputAssociation id="dnested">');
    // Data associations never appear at the process level as sequence flows.
    expect(xml).not.toContain('<bpmn:sequenceFlow id="din"');
  });

  it('round-trips losslessly and byte-stable', () => {
    const converter = () => new BpmnXmlConverter();
    const original = dataDiagram();
    const xml = converter().toXml(original);
    const { diagram: imported, warnings } = converter().fromXml(xml);
    expect(warnings).toEqual([]);
    expect(imported.edges.din).toMatchObject({ sourceId: 'doc', targetId: 'call', type: 'dataAssociation' });
    expect(imported.edges.dout).toMatchObject({ sourceId: 'call', targetId: 'store', type: 'dataAssociation' });
    expect(imported.edges.dnested).toMatchObject({ sourceId: 'inner', targetId: 'store', type: 'dataAssociation' });
    expect(imported.nodes.call.properties.calledElement).toBe('billing-process');
    expect(imported.nodes.store.properties.dataStoreRef).toBe('DS_orders');
    expect(normalizeForDiff(imported)).toEqual(normalizeForDiff(original));
    expect(converter().toXml(imported)).toBe(xml);
  });

  it('imports bpmn.io-style associations (synthesized property targets ignored)', () => {
    const xml = `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">
      <bpmn:process id="P">
        <bpmn:dataObjectReference id="Doc_1" name="Order" />
        <bpmn:dataStoreReference id="Store_1" name="CRM" />
        <bpmn:task id="T1" name="Handle">
          <bpmn:property id="Property_1" name="__targetRef_placeholder" />
          <bpmn:ioSpecification id="Io_1" />
          <bpmn:dataInputAssociation id="Din_1">
            <bpmn:sourceRef>Doc_1</bpmn:sourceRef>
            <bpmn:targetRef>Property_1</bpmn:targetRef>
          </bpmn:dataInputAssociation>
          <bpmn:dataOutputAssociation id="Dout_1">
            <bpmn:targetRef>Store_1</bpmn:targetRef>
          </bpmn:dataOutputAssociation>
        </bpmn:task>
      </bpmn:process>
    </bpmn:definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    // Only the missing-DI grid fallback — property/ioSpecification are silent.
    expect(warnings).toEqual(['Document has no BPMN DI — applied automatic grid layout']);
    expect(diagram.nodes.T1.type).toBe('task');
    expect(diagram.nodes.Store_1.type).toBe('dataStore');
    // Input edge targets the OWNING ACTIVITY, not the synthesized property.
    expect(diagram.edges.Din_1).toMatchObject({ sourceId: 'Doc_1', targetId: 'T1', type: 'dataAssociation' });
    expect(diagram.edges.Dout_1).toMatchObject({ sourceId: 'T1', targetId: 'Store_1', type: 'dataAssociation' });
  });

  it('warns on a data association without a ref', () => {
    const xml = `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">
      <bpmn:process id="P">
        <bpmn:task id="T1">
          <bpmn:dataInputAssociation id="Din_bad" />
        </bpmn:task>
      </bpmn:process>
    </bpmn:definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(warnings.some((w) => w.includes('Din_bad') && w.includes('sourceRef'))).toBe(true);
    expect(diagram.edges.Din_bad).toBeUndefined();
  });
});

describe('BpmnXmlConverter — businessRuleTask (Handoff 5 F-A)', () => {
  it('imports natively and round-trips the decisionRef losslessly', () => {
    const converter = () => new BpmnXmlConverter();
    const diagram = createDiagram({ name: 'Rules', id: 'rules' });
    diagram.nodes = {
      score: createNode({
        type: 'businessRuleTask',
        id: 'score',
        label: 'Score risk',
        x: 10,
        y: 10,
        properties: { decisionRef: 'decision-risk' },
      }),
    };
    const xml = converter().toXml(diagram);
    expect(xml).toContain('<bpmn:businessRuleTask id="score"');
    const { diagram: imported, warnings } = converter().fromXml(xml);
    expect(warnings).toEqual([]);
    expect(imported.nodes.score.type).toBe('businessRuleTask');
    expect(imported.nodes.score.properties.decisionRef).toBe('decision-risk');
    expect(normalizeForDiff(imported)).toEqual(normalizeForDiff(diagram));
    expect(converter().toXml(imported)).toBe(xml);
  });
});

describe('BpmnXmlConverter — multi-process documents', () => {
  it('imports the first process and warns that the others were dropped', () => {
    const xml = `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">
      <bpmn:process id="P1">
        <bpmn:task id="T1" name="In first" />
      </bpmn:process>
      <bpmn:process id="P2">
        <bpmn:task id="T2" name="In second" />
      </bpmn:process>
    </bpmn:definitions>`;
    const { diagram, warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(diagram.nodes.T1).toBeDefined();
    expect(diagram.nodes.T2).toBeUndefined();
    expect(warnings.some((w) => w.includes('2 <process>') && w.includes('P1'))).toBe(true);
  });

  it('does not warn for single-process documents', () => {
    const xml = `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">
      <bpmn:process id="P1">
        <bpmn:task id="T1" />
      </bpmn:process>
    </bpmn:definitions>`;
    const { warnings } = new BpmnXmlConverter().fromXml(xml);
    expect(warnings.some((w) => w.includes('<process>'))).toBe(false);
  });
});
