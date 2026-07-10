import {
  activeEdges,
  activeNodes,
  boundaryAttachedTo,
  isContainerType,
  isNonInterrupting,
  nodeParentId,
  type BpmnDiagram,
  type BpmnNode,
} from '@buildtovalue/core';
import type { GatewayKind, SimEdge, SimNode } from './types.js';

/**
 * The control-flow graph the token engine walks. It is built from a diagram
 * using the **same flow-node / flow-edge classification the soundness analysis
 * uses** (Handoff 7 §7.2). Because `simulation` may only depend on `core`, that
 * classification is duplicated here rather than imported from `@buildtovalue/
 * soundness`; `tests/soundnessAgreement.test.ts` pins the two to identical
 * adjacency so the coverage checklist and the deadlock verdict agree with
 * soundness by construction, not by coincidence.
 */
export interface SimGraph {
  scope: string | undefined;
  nodes: Map<string, SimNode>;
  edges: Map<string, SimEdge>;
  starts: string[];
  /** Boundary event ids grouped by their host activity id. */
  boundariesByHost: Map<string, string[]>;
}

// Kept identical to @buildtovalue/soundness graph.ts (see class doc above).
const NON_FLOW_TYPES = new Set(['dataObject', 'dataStore', 'textAnnotation', 'group']);
const NON_FLOW_EDGE_TYPES = new Set(['messageFlow', 'association', 'dataAssociation']);

export function isFlowNode(node: BpmnNode): boolean {
  return !isContainerType(node.type) && !NON_FLOW_TYPES.has(node.type);
}

/** Scope a node's flow runs in: a boundary event works in its host's scope. */
export function flowScopeOf(diagram: BpmnDiagram, node: BpmnNode): string | undefined {
  const host = boundaryAttachedTo(node);
  const anchor = host ? (diagram.nodes[host] ?? node) : node;
  return nodeParentId(anchor);
}

/** Resolves the gateway control-flow role for a node type (undefined if none). */
export function gatewayKindOf(type: string): GatewayKind | undefined {
  switch (type) {
    case 'exclusiveGateway':
      return 'exclusive';
    case 'parallelGateway':
      return 'parallel';
    case 'inclusiveGateway':
      return 'inclusive';
    case 'eventBasedGateway':
      return 'eventBased';
    default:
      return undefined;
  }
}

/**
 * Builds the simulation graph for one scope of a diagram (the top process level
 * by default). Closed elements are excluded; boundary events are recorded
 * against their host instead of wired as sequence flow — the engine moves the
 * token onto them when the boundary is fired, matching BPMN attachment
 * semantics.
 */
export function buildSimGraph(diagram: BpmnDiagram, scope: string | undefined = undefined): SimGraph {
  const nodes = new Map<string, SimNode>();
  const edges = new Map<string, SimEdge>();
  const starts: string[] = [];
  const boundariesByHost = new Map<string, string[]>();
  const inScope = new Set<string>();

  for (const node of activeNodes(diagram)) {
    if (!isFlowNode(node)) continue;
    if (flowScopeOf(diagram, node) !== scope) continue;
    inScope.add(node.id);
  }

  for (const node of activeNodes(diagram)) {
    if (!inScope.has(node.id)) continue;
    const host = boundaryAttachedTo(node);
    const sim: SimNode = {
      id: node.id,
      type: node.type,
      label: node.label,
      gateway: gatewayKindOf(node.type),
      outgoing: [],
      incoming: [],
      isStart: node.type === 'startEvent',
      isEnd: node.type === 'endEvent',
    };
    if (host && inScope.has(host)) {
      sim.boundaryHost = host;
      sim.interrupting = !isNonInterrupting(node);
      const list = boundariesByHost.get(host) ?? [];
      list.push(node.id);
      boundariesByHost.set(host, list);
    }
    nodes.set(node.id, sim);
    if (sim.isStart) starts.push(node.id);
  }

  for (const edge of activeEdges(diagram)) {
    if (NON_FLOW_EDGE_TYPES.has(edge.type)) continue;
    const source = nodes.get(edge.sourceId);
    const target = nodes.get(edge.targetId);
    // Endpoints must both be flow nodes in this scope (cross-scope / dangling
    // refs are core validation errors, not simulation input — same as soundness).
    if (!source || !target) continue;
    const label = edge.label && edge.label.trim().length > 0 ? edge.label : target.label || edge.id;
    edges.set(edge.id, { id: edge.id, source: edge.sourceId, target: edge.targetId, label });
    source.outgoing.push(edge.id);
    target.incoming.push(edge.id);
  }

  return { scope, nodes, edges, starts, boundariesByHost };
}
