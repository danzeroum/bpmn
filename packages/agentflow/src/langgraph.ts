/**
 * LangGraph JSON interop (Handoff 12 A-7) — a DOCUMENTED SUBSET, ≥0.2.
 *
 * Honesty rule (same discipline as S-FEEL): this is not "almost LangGraph".
 * The subset that round-trips is exactly:
 *
 *   AgentWorkflow                  ⇄  LangGraph JSON subset
 *   ─────────────────────────────────────────────────────────
 *   id / name / version            ⇄  id / name / version (identity)
 *   inputSchema / outputSchema     ⇄  input_schema / output_schema
 *   node.id                        ⇄  nodes[].id
 *   node.type (llm|tool|decision)  ⇄  nodes[].type   (any other → import ERROR)
 *   node.config                    ⇄  nodes[].data
 *   edge.from/to/edgeType/when     ⇄  edges[].source/target/data.{edgeType,when}
 *
 * IGNORED on import (declared, never silent): every top-level key outside the
 * set above — `interrupts`, `checkpointer`/`checkpoints`, and anything else.
 * A node whose `type` is not one of the three fails the import with an error
 * naming the node — never a silent lossy conversion.
 *
 * LEFT OUT on export (declared in warnings): agentflow constructs LangGraph
 * cannot represent — `autonomyLevel`, decorators (memory/planner/errorBoundary),
 * and `delegate` edges (a2a:1.0 semantics, not a protocol).
 *
 * Pure JSON, zero ecosystem imports (independence test).
 */

import { minCoherentLevel } from './autonomy.js';
import type {
  AgentEdge,
  AgentNode,
  AgentWorkflow,
  EdgeType,
  NodeType,
  SchemaShape,
} from './types.js';

/** One node of the LangGraph JSON subset. */
export interface LangGraphNode {
  id: string;
  /** Must be `llm` | `tool` | `decision` to import. */
  type: string;
  data?: Record<string, unknown>;
}

/** One edge of the LangGraph JSON subset. */
export interface LangGraphEdge {
  source: string;
  target: string;
  /** True for a decision/routing edge (LangGraph conditional edge). */
  conditional?: boolean;
  data?: { edgeType?: string; when?: string };
}

/** The LangGraph JSON document subset we read/write. Extra top-level keys are
 * tolerated (and, on import, declared as ignored). */
export interface LangGraphJson {
  id?: string;
  name?: string;
  version?: string;
  nodes: LangGraphNode[];
  edges: LangGraphEdge[];
  input_schema?: SchemaShape;
  output_schema?: SchemaShape;
  [key: string]: unknown;
}

/** Thrown when a LangGraph node cannot be mapped (unknown type) — the import
 * fails loudly rather than dropping semantics. */
export class LangGraphImportError extends Error {
  constructor(
    message: string,
    readonly nodeId: string,
  ) {
    super(message);
    this.name = 'LangGraphImportError';
  }
}

export interface LangGraphImportResult {
  workflow: AgentWorkflow;
  /** Declared, human-readable notes for every ignored out-of-subset field. */
  warnings: string[];
}

export interface LangGraphExportResult {
  json: LangGraphJson;
  /** Declared notes for every agentflow construct with no LangGraph form. */
  warnings: string[];
}

const NODE_TYPES = new Set<NodeType>(['llm', 'tool', 'decision']);
const EDGE_TYPES = new Set<EdgeType>(['toolCall', 'data', 'delegate']);
const KNOWN_TOP_LEVEL = new Set(['id', 'name', 'version', 'nodes', 'edges', 'input_schema', 'output_schema']);

/**
 * Imports a LangGraph JSON subset into an AgentWorkflow. Out-of-subset
 * top-level keys are ignored and DECLARED in `warnings`; an unmappable node
 * type throws {@link LangGraphImportError} naming the node. `autonomyLevel` is
 * recomputed from the graph (it is not part of the subset).
 */
export function importLangGraph(json: LangGraphJson): LangGraphImportResult {
  const warnings: string[] = [];
  for (const key of Object.keys(json)) {
    if (!KNOWN_TOP_LEVEL.has(key)) {
      warnings.push(`Ignored out-of-subset field "${key}" (not part of the imported LangGraph subset).`);
    }
  }

  const nodes: AgentNode[] = (json.nodes ?? []).map((node) => {
    if (!NODE_TYPES.has(node.type as NodeType)) {
      throw new LangGraphImportError(
        `LangGraph node "${node.id}" has unmappable type "${node.type}" (expected llm | tool | decision).`,
        node.id,
      );
    }
    const data = node.data ?? {};
    // Config is arbitrary JSON at the import boundary; graph validation
    // (validateGraph) is what checks it is well-formed, not this cast.
    return { id: node.id, type: node.type as NodeType, config: data } as unknown as AgentNode;
  });

  const edges: AgentEdge[] = (json.edges ?? []).map((edge) => {
    const edgeType = EDGE_TYPES.has(edge.data?.edgeType as EdgeType)
      ? (edge.data!.edgeType as EdgeType)
      : 'data';
    const built: AgentEdge = { from: edge.source, to: edge.target, edgeType };
    if (edge.data?.when !== undefined) built.when = edge.data.when;
    return built;
  });

  const workflow: AgentWorkflow = {
    kind: 'AgentWorkflow',
    id: json.id ?? 'imported-agent',
    version: json.version ?? '0.1.0',
    name: json.name ?? 'Imported Agent',
    autonomyLevel: 0, // placeholder; replaced below by what the graph justifies
    inputSchema: json.input_schema ?? {},
    outputSchema: json.output_schema ?? {},
    nodes,
    edges,
  };
  workflow.autonomyLevel = minCoherentLevel(workflow);
  return { workflow, warnings };
}

/**
 * Exports an AgentWorkflow to the LangGraph JSON subset. Constructs with no
 * LangGraph representation are omitted and DECLARED in `warnings`:
 * `autonomyLevel` (always), decorators, and `delegate` edges.
 */
export function exportLangGraph(workflow: AgentWorkflow): LangGraphExportResult {
  const warnings: string[] = [
    `autonomyLevel (${workflow.autonomyLevel}) is agentflow-specific and is not represented in LangGraph.`,
  ];

  const nodes: LangGraphNode[] = workflow.nodes.map((node) => {
    if (node.decorators && node.decorators.length > 0) {
      warnings.push(
        `Node "${node.id}" decorators [${node.decorators.map((d) => d.type).join(', ')}] have no LangGraph representation and were dropped.`,
      );
    }
    return { id: node.id, type: node.type, data: { ...node.config } };
  });

  const edges: LangGraphEdge[] = [];
  for (const edge of workflow.edges) {
    if (edge.edgeType === 'delegate') {
      warnings.push(
        `Delegate edge "${edge.from}" → "${edge.to}" (a2a:1.0 semantics) has no LangGraph representation and was dropped.`,
      );
      continue;
    }
    const built: LangGraphEdge = { source: edge.from, target: edge.to };
    if (edge.when !== undefined) {
      built.conditional = true;
      built.data = { edgeType: edge.edgeType, when: edge.when };
    } else {
      built.data = { edgeType: edge.edgeType };
    }
    edges.push(built);
  }

  const json: LangGraphJson = {
    id: workflow.id,
    name: workflow.name,
    version: workflow.version,
    nodes,
    edges,
    input_schema: workflow.inputSchema,
    output_schema: workflow.outputSchema,
  };
  return { json, warnings };
}
