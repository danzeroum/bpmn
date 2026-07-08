import {
  createDefaultRegistry,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@bpmn-react/core';
import { DOMAIN_NODE_TYPES } from '@bpmn-react/domain-example';

/** Content-production flow using the example domain vocabulary. */
export function buildSampleDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  for (const def of DOMAIN_NODE_TYPES) registry.register(def);

  const diagram = createDiagram({ name: 'Content production', createdBy: 'demo' });
  diagram.description = 'Squad produces content, a gate approves, a connector publishes.';
  const v = diagram.version.id;

  const make = (type: string, id: string, label: string, x: number, y: number, properties = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);

  const squad = make('btv:squad', 'squad', 'Content Squad', 60, 160);
  const writer = make('btv:persona', 'writer', 'Writer', 320, 80, { role: 'copywriting' });
  const reviewer = make('btv:persona', 'reviewer', 'Reviewer', 320, 260, { role: 'editorial QA' });
  const prompt = make('btv:prompt', 'prompt', 'Draft article', 540, 70);
  const gate = make('btv:gate', 'gate', 'Editorial gate', 570, 250, { approved: false });
  const publish = make('btv:connector', 'publish', 'CMS publish', 740, 150);
  const deliverable = make('btv:deliverable', 'post', 'Published post', 930, 155);
  // A non-interrupting timer boundary event on the publish step (publish times
  // out without cancelling); rides along when the host is dragged.
  const timeout = make('boundaryEvent', 'publishTimeout', 'Timeout', 812, 192, {
    attachedToRef: 'publish',
    eventDefinition: 'timer',
    cancelActivity: false,
  });

  diagram.nodes = {
    squad,
    writer,
    reviewer,
    prompt,
    gate,
    publish,
    post: deliverable,
    publishTimeout: timeout,
  };

  const edge = (
    id: string,
    sourceId: string,
    targetId: string,
    type: string,
    purpose: string,
    label?: string,
  ) => createEdge({ id, sourceId, targetId, type, purpose, label, versionId: v });

  diagram.edges = {
    e1: edge('e1', 'squad', 'writer', 'sequenceFlow', 'Squad staffs the writer'),
    e2: edge('e2', 'squad', 'reviewer', 'sequenceFlow', 'Squad staffs the reviewer'),
    e3: edge('e3', 'writer', 'prompt', 'handoff', 'Writer drafts using the prompt', 'draft'),
    e4: edge('e4', 'prompt', 'gate', 'handoff', 'Draft goes to editorial review', 'review'),
    e5: edge('e5', 'gate', 'reviewer', 'feedback', 'Gate returns change requests to the reviewer'),
    // Fixed orthogonal waypoints so the demo shows the craft-pack rounded
    // corners (the default router is bezier, which has no bends).
    e6: createEdge({
      id: 'e6',
      sourceId: 'gate',
      targetId: 'publish',
      type: 'handoff',
      purpose: 'Approved content is published',
      label: 'approved',
      versionId: v,
      waypoints: [
        { x: 642, y: 278 },
        { x: 691, y: 278 },
        { x: 691, y: 180 },
        { x: 740, y: 180 },
      ],
    }),
    e7: edge('e7', 'publish', 'post', 'sequenceFlow', 'CMS emits the deliverable'),
  };

  return diagram;
}

/**
 * Synthetic grid for the craft-pack performance NFR (60fps @ ~350 nodes):
 * a mix of shadow-casting activities/cards and flat events/gateways, chained
 * by orthogonal edges with explicit waypoints (rounded corners) and periodic
 * handoffs (purpose chips).
 */
export function buildStressDiagram(count = 350): BpmnDiagram {
  const registry = createDefaultRegistry();
  for (const def of DOMAIN_NODE_TYPES) registry.register(def);

  const diagram = createDiagram({ name: `Stress ${count}`, createdBy: 'perf' });
  diagram.description = `${count}-node synthetic grid for the 60fps NFR.`;
  const v = diagram.version.id;

  const types = [
    'userTask',
    'btv:prompt',
    'task',
    'btv:connector',
    'serviceTask',
    'btv:persona',
    'exclusiveGateway',
    'startEvent',
  ];
  const COLS = 16;
  const STEP_X = 200;
  const STEP_Y = 140;

  const nodes: BpmnDiagram['nodes'] = {};
  const sizes: Record<string, { width: number; height: number }> = {};
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const id = `n${i}`;
    nodes[id] = createNode(
      { type, id, label: `${type} ${i}`, x: 40 + col * STEP_X, y: 40 + row * STEP_Y, properties: {}, versionId: v },
      registry,
    );
    sizes[id] = registry.get(type).defaultSize;
  }
  diagram.nodes = nodes;

  const edges: BpmnDiagram['edges'] = {};
  for (let i = 1; i < count; i++) {
    const sourceId = `n${i - 1}`;
    const targetId = `n${i}`;
    const a = nodes[sourceId];
    const b = nodes[targetId];
    const start = { x: a.x + sizes[sourceId].width, y: a.y + sizes[sourceId].height / 2 };
    const end = { x: b.x, y: b.y + sizes[targetId].height / 2 };
    const midX = (start.x + end.x) / 2;
    const handoff = i % 4 === 0;
    edges[`e${i}`] = createEdge({
      id: `e${i}`,
      sourceId,
      targetId,
      type: handoff ? 'handoff' : 'sequenceFlow',
      purpose: handoff ? `handoff ${i}` : `step ${i}`,
      versionId: v,
      waypoints: [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end],
    });
  }
  diagram.edges = edges;

  return diagram;
}
