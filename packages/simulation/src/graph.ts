import {
  activeEdges,
  activeNodes,
  boundaryAttachedTo,
  eventDefinitionRefOf,
  findEventDefinition,
  flowScopeOf,
  isFlowNode,
  isNonInterrupting,
  NON_FLOW_EDGE_TYPES,
  type BpmnDiagram,
  type EventDefinitionRefKind,
} from '@buildtovalue/core';
import type { GatewayKind, SimEdge, SimNode } from './types.js';

/**
 * The control-flow graph the token engine walks. It is built from a diagram
 * using the **same flow-node / flow-edge classification the soundness analysis
 * uses** (Handoff 7 §7.2): both import it from `@buildtovalue/core`
 * (`model/flow.ts`), so the coverage checklist and the deadlock verdict agree
 * with soundness by construction. `tests/soundnessAgreement.test.ts` keeps
 * pinning the resulting adjacencies to each other end-to-end.
 */
export interface SimGraph {
  scope: string | undefined;
  nodes: Map<string, SimNode>;
  edges: Map<string, SimEdge>;
  starts: string[];
  /** Boundary event ids grouped by their host activity id. */
  boundariesByHost: Map<string, string[]>;
}

// Flow classification is hosted in core (`model/flow.ts`) — the same
// functions soundness uses, so the two analyses agree by construction.
export { isFlowNode, flowScopeOf } from '@buildtovalue/core';

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
    // E-6 (§3e): event kind + named-definition ref feed the matching; the
    // resolved name (E-3 gov-* mirrors are ordinary definitions — identical
    // lookup by id) labels the "throw" cards.
    const eventKind = node.properties.eventDefinition;
    if (typeof eventKind === 'string') {
      sim.eventKind = eventKind;
      const ref = eventDefinitionRefOf(node);
      if (ref !== undefined) {
        sim.eventRef = ref;
        if (eventKind === 'message' || eventKind === 'signal' || eventKind === 'error') {
          sim.eventRefLabel =
            findEventDefinition(diagram, eventKind as EventDefinitionRefKind, ref)?.name ?? ref;
        }
      }
    }
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
