import { activeEdges, activeNodes, isContainerType, type BpmnDiagram } from '@bpmn-react/core';
import type { ReplayGraph } from '@bpmn-react/replay';

const NON_FLOW_EDGE_TYPES = new Set(['messageFlow', 'association', 'dataAssociation']);
const NON_FLOW_NODE_TYPES = new Set(['dataObject', 'dataStore', 'textAnnotation', 'group']);

/**
 * Host adapter (injection, not import): projects a BPMN diagram onto the
 * abstract `{ nodes, edges }` the headless `@bpmn-react/replay` engine expects.
 * Node `name` is the label (matched against log activity names), `id` stays the
 * diagram id so heatmap stats map straight back onto edges/nodes on the canvas.
 * `@bpmn-react/replay` never sees this — it only ever gets the plain graph.
 */
export function diagramToReplayGraph(diagram: BpmnDiagram): ReplayGraph {
  const nodes = activeNodes(diagram)
    .filter((node) => !isContainerType(node.type) && !NON_FLOW_NODE_TYPES.has(node.type))
    .map((node) => ({ id: node.id, name: node.label || node.id }));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = activeEdges(diagram)
    .filter(
      (edge) =>
        !NON_FLOW_EDGE_TYPES.has(edge.type) &&
        nodeIds.has(edge.sourceId) &&
        nodeIds.has(edge.targetId),
    )
    .map((edge) => ({ id: edge.id, source: edge.sourceId, target: edge.targetId }));
  return { nodes, edges };
}
