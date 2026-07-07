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
    e6: edge('e6', 'gate', 'publish', 'handoff', 'Approved content is published', 'approved'),
    e7: edge('e7', 'publish', 'post', 'sequenceFlow', 'CMS emits the deliverable'),
  };

  return diagram;
}
