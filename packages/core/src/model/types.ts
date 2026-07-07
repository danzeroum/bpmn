/**
 * Core data model for bpmn-react diagrams.
 *
 * Design principles:
 * - Nodes and edges are stored as dictionaries (`Record<id, …>`) for O(1) lookup.
 * - Dates are ISO-8601 strings so the whole model is JSON-serializable and
 *   deterministic for hashing/diffing.
 * - Versioned elements are temporally immutable: they are never deleted, only
 *   closed (`removedInVersion`) and optionally superseded (`supersedesEdgeId`).
 */

/** Lifecycle status of a diagram version. */
export type VersionStatus =
  | 'draft'
  | 'test'
  | 'candidate'
  | 'active'
  | 'deprecated'
  | 'retired';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

/** A single recorded change on an element's local audit trail. */
export interface AuditEventRecord {
  type: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  userId: string;
  /** Version in which the change happened. */
  versionId: string;
  details?: Record<string, unknown>;
}

export interface AuditTrail {
  createdAt: string;
  createdBy: string;
  history: AuditEventRecord[];
}

export interface BpmnNode {
  id: string;
  /** Node type key, resolved against the {@link NodeTypeRegistry}. */
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Free-form, domain-extensible properties (exported via extensionElements). */
  properties: Record<string, unknown>;
  /** Version id in which this node was created. Immutable. */
  createdInVersion: string;
  /** Version id in which this node was closed. Present ⇒ node is retired from the flow. */
  removedInVersion?: string;
  audit: AuditTrail;
}

export interface BpmnEdge {
  id: string;
  /** Edge type key: built-ins are 'sequenceFlow', 'messageFlow', 'association'. */
  type: string;
  sourceId: string;
  targetId: string;
  label?: string;
  /** Reason for the handoff this edge represents (auditable metadata). */
  purpose?: string;
  /** Optional fixed routing points (world coordinates). */
  waypoints?: Point[];
  properties: Record<string, unknown>;
  createdInVersion: string;
  removedInVersion?: string;
  /** Id of the edge this one replaces, forming a substitution chain. */
  supersedesEdgeId?: string;
  audit: AuditTrail;
}

export interface ApprovalRecord {
  userId: string;
  role: string;
  approvedAt: string;
  reason: string;
}

export interface BpmnVersion {
  id: string;
  /** Semantic version, e.g. "2.3.1". */
  semanticVersion: string;
  status: VersionStatus;
  effectiveFrom?: string;
  effectiveUntil?: string;
  approvedBy: ApprovalRecord[];
  /** Human-readable changelog. Required (min length) for promotion to 'active'. */
  changeSummary: string;
  createdBy: string;
  createdAt: string;
  /** SHA-256 of the normalized diagram content at version creation. */
  snapshotHash: string;
  parentVersionId?: string;
}

export interface BpmnDiagram {
  id: string;
  name: string;
  description: string;
  version: BpmnVersion;
  nodes: Record<string, BpmnNode>;
  edges: Record<string, BpmnEdge>;
  metadata: Record<string, unknown>;
}

/** Identifies the acting user for commands, promotions and audit entries. */
export interface UserContext {
  id: string;
  role: string;
  name?: string;
}

/** Built-in edge types. Custom types may be registered by plugins. */
export const BUILT_IN_EDGE_TYPES = ['sequenceFlow', 'messageFlow', 'association'] as const;

/**
 * Node types that act as visual swimlane containers. They are rendered behind
 * the flow (lower z-order) and map to BPMN `participant` (pool) / `lane`
 * elements rather than to process flow nodes on export.
 */
export const CONTAINER_NODE_TYPES = ['pool', 'lane'] as const;

/** True when `type` is a swimlane container (pool or lane). */
export function isContainerType(type: string): boolean {
  return (CONTAINER_NODE_TYPES as readonly string[]).includes(type);
}

/**
 * Lane membership is stored on the lane node under `properties.flowNodeRefs`
 * (an array of flow-node ids). Returns it defensively as a string array.
 */
export function laneFlowNodeRefs(node: BpmnNode): string[] {
  const refs = node.properties.flowNodeRefs;
  return Array.isArray(refs) ? refs.filter((r): r is string => typeof r === 'string') : [];
}

/** Returns nodes that are part of the current flow (not closed). */
export function activeNodes(diagram: BpmnDiagram): BpmnNode[] {
  return Object.values(diagram.nodes).filter((n) => !n.removedInVersion);
}

/** Returns edges that are part of the current flow (not closed). */
export function activeEdges(diagram: BpmnDiagram): BpmnEdge[] {
  return Object.values(diagram.edges).filter((e) => !e.removedInVersion);
}
