import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@bpmn-react/core';

/**
 * Terse diagram builder (same shape as the soundness fixtures so the two
 * suites read alike). Nodes are `id:type`; edges are `source->target` or
 * `source->target:label` for gateway choice labels. `patch` sets properties
 * such as boundary `attachedToRef` / `cancelActivity`.
 */
export function flow(
  nodeSpecs: string[],
  edgeSpecs: string[],
  patch?: (d: BpmnDiagram) => void,
): BpmnDiagram {
  const diagram = createDiagram({ name: 'Fixture' });
  for (const spec of nodeSpecs) {
    const [id, type] = spec.split(':');
    diagram.nodes[id] = createNode({ id, type, label: id, x: 0, y: 0 });
  }
  edgeSpecs.forEach((spec, index) => {
    const [ends, label] = spec.split(':');
    const [sourceId, targetId] = ends.split('->');
    const id = `e${index}`;
    diagram.edges[id] = createEdge({ id, sourceId, targetId, ...(label ? { label } : {}) });
  });
  patch?.(diagram);
  return diagram;
}

/** start → task → end. */
export const linear = () =>
  flow(['s:startEvent', 'a:task', 'e:endEvent'], ['s->a', 'a->e']);

/** start → XOR(approve/reject) → two ends. */
export const xorSplit = () =>
  flow(
    ['s:startEvent', 'x:exclusiveGateway', 'ok:task', 'no:task', 'e1:endEvent', 'e2:endEvent'],
    ['s->x', 'x->ok:approve', 'x->no:reject', 'ok->e1', 'no->e2'],
  );

/** AND-split → two tasks → AND-join → end (sound parallel region). */
export const andParallel = () =>
  flow(
    ['s:startEvent', 'f:parallelGateway', 'a:task', 'b:task', 'j:parallelGateway', 'e:endEvent'],
    ['s->f', 'f->a', 'f->b', 'a->j', 'b->j', 'j->e'],
  );

/** The trap: XOR-split feeding an AND-join. Deadlocks by construction. */
export const trap = () =>
  flow(
    ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'j:parallelGateway', 'e:endEvent'],
    ['s->x', 'x->a', 'x->b', 'a->j', 'b->j', 'j->e'],
  );

/** event-based gateway racing two catch events. */
export const eventBased = () =>
  flow(
    [
      's:startEvent', 'g:eventBasedGateway', 'm:intermediateCatchEvent',
      't:intermediateCatchEvent', 'e1:endEvent', 'e2:endEvent',
    ],
    ['s->g', 'g->m:message', 'g->t:timer', 'm->e1', 't->e2'],
  );

/** OR-split(two branches) → OR-join → end. */
export const orRegion = () =>
  flow(
    ['s:startEvent', 'o:inclusiveGateway', 'a:task', 'b:task', 'j:inclusiveGateway', 'e:endEvent'],
    ['s->o', 'o->a:left', 'o->b:right', 'a->j', 'b->j', 'j->e'],
  );

/**
 * The three-path prototype: a task with an interrupting timeout boundary, then
 * an XOR (approve/reject). Sessions: happy (approve), rejection (reject),
 * timeout (boundary) → 3 structural paths.
 */
export const threePaths = () =>
  flow(
    [
      's:startEvent', 'prod:task', 'x:exclusiveGateway',
      'ship:task', 'fix:task', 'timer:boundaryEvent',
      'done:endEvent', 'rejected:endEvent', 'timedout:endEvent',
    ],
    [
      's->prod', 'prod->x', 'x->ship:approve', 'x->fix:reject',
      'ship->done', 'fix->rejected', 'timer->timedout',
    ],
    (d) => {
      d.nodes.timer.properties.attachedToRef = 'prod';
      d.nodes.timer.label = '48h timeout';
    },
  );

/** A task with a non-interrupting boundary (spawns a second token). */
export const nonInterruptingBoundary = () =>
  flow(
    ['s:startEvent', 'a:task', 'e:endEvent', 'sig:boundaryEvent', 'notify:task', 'e2:endEvent'],
    ['s->a', 'a->e', 'sig->notify', 'notify->e2'],
    (d) => {
      d.nodes.sig.properties.attachedToRef = 'a';
      d.nodes.sig.properties.cancelActivity = false;
      d.nodes.sig.label = 'signal';
    },
  );
