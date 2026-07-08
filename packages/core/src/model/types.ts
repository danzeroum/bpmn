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
 * BPMN event-definition kinds. An event node (`startEvent`, `endEvent`,
 * `intermediateCatchEvent`, `intermediateThrowEvent`) carries its kind under
 * `properties.eventDefinition`; on export it becomes the standard child element
 * `<bpmn:{kind}EventDefinition/>`, so typed events round-trip with Camunda and
 * bpmn.io. `undefined`/absent means a plain (none) event.
 */
export const EVENT_DEFINITION_KINDS = [
  'message',
  'timer',
  'error',
  'signal',
  'escalation',
  'conditional',
  'link',
  'terminate',
] as const;

export type EventDefinitionKind = (typeof EVENT_DEFINITION_KINDS)[number];

/**
 * Activity loop markers (BPMN loopCharacteristics), stored on an activity node
 * under `properties.marker`. On export they become the standard child element
 * (`standardLoopCharacteristics` / `multiInstanceLoopCharacteristics`).
 */
export const ACTIVITY_MARKERS = [
  'loop',
  'parallelMultiInstance',
  'sequentialMultiInstance',
] as const;

export type ActivityMarker = (typeof ACTIVITY_MARKERS)[number];

/** Returns the activity marker stored on a node, if it is a valid marker. */
export function activityMarkerOf(node: BpmnNode): ActivityMarker | undefined {
  const marker = node.properties.marker;
  return typeof marker === 'string' && (ACTIVITY_MARKERS as readonly string[]).includes(marker)
    ? (marker as ActivityMarker)
    : undefined;
}

/** Event node types (built-in). Plugins may register more via `category: 'event'`. */
export const EVENT_NODE_TYPES = [
  'startEvent',
  'endEvent',
  'intermediateCatchEvent',
  'intermediateThrowEvent',
  'boundaryEvent',
] as const;

/** True when `type` is one of the built-in event node types. */
export function isEventType(type: string): boolean {
  return (EVENT_NODE_TYPES as readonly string[]).includes(type);
}

/**
 * A boundary event is attached to a host activity via
 * `properties.attachedToRef` and survives the host's move (see the editor's
 * drag handling). Returns the host node id, if any.
 */
export function boundaryAttachedTo(node: BpmnNode): string | undefined {
  return node.type === 'boundaryEvent' && typeof node.properties.attachedToRef === 'string'
    ? node.properties.attachedToRef
    : undefined;
}

/**
 * A boundary event is interrupting (`cancelActivity`) by default; a
 * `cancelActivity: false` property makes it non-interrupting (dashed border).
 */
export function isNonInterrupting(node: BpmnNode): boolean {
  return node.type === 'boundaryEvent' && node.properties.cancelActivity === false;
}

/** Ids of boundary events attached to any of the given host node ids. */
export function attachedBoundaryEventIds(diagram: BpmnDiagram, hostIds: Iterable<string>): string[] {
  const hosts = new Set(hostIds);
  return activeNodes(diagram)
    .filter((n) => {
      const ref = boundaryAttachedTo(n);
      return ref !== undefined && hosts.has(ref);
    })
    .map((n) => n.id);
}

/**
 * Sub-process containment (F7): a node nested inside a sub-process stores its
 * container id under `properties.parentId` — the child holds the reference,
 * same side as boundary `attachedToRef`. The XML converter encodes it
 * structurally (children nest inside `<bpmn:subProcess>`), so it never
 * appears as a `bpmnr:property`. Returns the container id, if any.
 */
export function nodeParentId(node: BpmnNode): string | undefined {
  return typeof node.properties.parentId === 'string' ? node.properties.parentId : undefined;
}

/** Direct children of a sub-process, in diagram insertion order. */
export function childrenOf(diagram: BpmnDiagram, nodeId: string): BpmnNode[] {
  return Object.values(diagram.nodes).filter((n) => nodeParentId(n) === nodeId);
}

/** All transitive descendant ids of a node (children, grandchildren, …). */
export function descendantIdsOf(diagram: BpmnDiagram, nodeId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>([nodeId]);
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of childrenOf(diagram, current)) {
      if (seen.has(child.id)) continue; // defensive: cycles are a validation error
      seen.add(child.id);
      out.push(child.id);
      stack.push(child.id);
    }
  }
  return out;
}

/**
 * Expanded sub-processes render their children on the canvas; collapsed ones
 * (the default) hide them behind the `[+]` marker. Round-trips as the BPMN DI
 * `isExpanded` attribute on the sub-process shape.
 */
export function isSubProcessExpanded(node: BpmnNode): boolean {
  return node.type === 'subProcess' && node.properties.isExpanded === true;
}

/** Returns the event-definition kind stored on a node, if it is a valid kind. */
export function eventDefinitionOf(node: BpmnNode): EventDefinitionKind | undefined {
  const kind = node.properties.eventDefinition;
  return typeof kind === 'string' && (EVENT_DEFINITION_KINDS as readonly string[]).includes(kind)
    ? (kind as EventDefinitionKind)
    : undefined;
}

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
