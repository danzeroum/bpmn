import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';

/** Mesmo builder terso das suítes de simulation/soundness — as suítes leem igual. */
export function flow(
  nodeSpecs: string[],
  edgeSpecs: string[],
  patch?: (d: BpmnDiagram) => void,
): BpmnDiagram {
  const diagram = createDiagram({ name: 'EngineFixture' });
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

export const NOW = '2026-07-22T12:00:00.000Z';
export const DEF_REF = { registryRef: 'reg:test@1', bpmnVersion: '1.0.0' };
