import {
  activeEdges,
  activeNodes,
  boundaryAttachedTo,
  flowScopeOf,
  isFlowNode,
  isNonInterrupting,
  NON_FLOW_EDGE_TYPES,
  timerPropertyOf,
  type BpmnDiagram,
  type TimerProperty,
} from '@buildtovalue/core';

/**
 * Grafo de execução do engine (v1, single-process). Derivado do diagrama com
 * os MESMOS classificadores de fluxo do `core` que `simulation` e `soundness`
 * usam (`isFlowNode`/`flowScopeOf`) — os três concordam por construção (D10).
 *
 * Convenção de condição (a MESMA do lint `EXEC_UNCONDITIONED_FLOWS`):
 * `edge.properties.conditionExpression ?? edge.properties.condition` (string
 * S-FEEL) e `sourceNode.properties.defaultFlow === edge.id` para o default;
 * UM fluxo sem condição é tolerado como default implícito.
 */
export interface EngineEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
  isDefault: boolean;
}

export interface EngineNode {
  id: string;
  type: string;
  label: string;
  outgoing: string[];
  incoming: string[];
  /** Host activity id quando este nó é boundary event. */
  boundaryHost?: string;
  interrupting?: boolean;
  /** `properties.eventDefinition` (timer, message, …). */
  eventKind?: string;
  timer?: TimerProperty;
  /** Propriedades autorais do nó (formRef, jobType, …) — leitura direta. */
  props: Readonly<Record<string, unknown>>;
}

export interface EngineGraph {
  nodes: Map<string, EngineNode>;
  edges: Map<string, EngineEdge>;
  starts: string[];
  boundariesByHost: Map<string, string[]>;
}

export function buildEngineGraph(diagram: BpmnDiagram): EngineGraph {
  const nodes = new Map<string, EngineNode>();
  const edges = new Map<string, EngineEdge>();
  const starts: string[] = [];
  const boundariesByHost = new Map<string, string[]>();
  const inScope = new Set<string>();

  // v1 executa só o nível de processo (escopo raiz) — mesmo recorte do
  // simulation com scope=undefined.
  for (const node of activeNodes(diagram)) {
    if (!isFlowNode(node)) continue;
    if (flowScopeOf(diagram, node) !== undefined) continue;
    inScope.add(node.id);
  }

  for (const node of activeNodes(diagram)) {
    if (!inScope.has(node.id)) continue;
    const engineNode: EngineNode = {
      id: node.id,
      type: node.type,
      label: node.label,
      outgoing: [],
      incoming: [],
      props: node.properties as Readonly<Record<string, unknown>>,
    };
    const eventKind = node.properties.eventDefinition;
    if (typeof eventKind === 'string') engineNode.eventKind = eventKind;
    const timer = timerPropertyOf(node);
    if (timer) engineNode.timer = timer;
    const host = boundaryAttachedTo(node);
    if (host && inScope.has(host)) {
      engineNode.boundaryHost = host;
      engineNode.interrupting = !isNonInterrupting(node);
      const list = boundariesByHost.get(host) ?? [];
      list.push(node.id);
      boundariesByHost.set(host, list);
    }
    nodes.set(node.id, engineNode);
    if (node.type === 'startEvent') starts.push(node.id);
  }

  for (const edge of activeEdges(diagram)) {
    if (NON_FLOW_EDGE_TYPES.has(edge.type)) continue;
    const source = nodes.get(edge.sourceId);
    const target = nodes.get(edge.targetId);
    if (!source || !target) continue;
    const rawCondition = edge.properties.conditionExpression ?? edge.properties.condition;
    const condition =
      typeof rawCondition === 'string' && rawCondition.trim() !== '' ? rawCondition : undefined;
    const isDefault = diagram.nodes[edge.sourceId]?.properties.defaultFlow === edge.id;
    edges.set(edge.id, {
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      ...(condition !== undefined ? { condition } : {}),
      isDefault,
    });
    source.outgoing.push(edge.id);
    target.incoming.push(edge.id);
  }

  return { nodes, edges, starts, boundariesByHost };
}
