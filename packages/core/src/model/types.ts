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

/**
 * Lifecycle status of a diagram version. `in-review` (Handoff 15 §2e) is the
 * EM REVISÃO ⟲ parking state of the request-changes cycle: a candidate whose
 * approver formally asked for changes; the only way out is re-submission
 * (back to `candidate`).
 */
export type VersionStatus =
  | 'draft'
  | 'test'
  | 'candidate'
  | 'in-review'
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

/**
 * A JSON-serializable XML subtree — the storage shape of FOREIGN extension
 * elements (`zeebe:*`, `camunda:*`, …) preserved through the round-trip
 * (passthrough PR). Mirrors the parser's element shape so re-emission is a
 * pure tree walk. Contract (format-spec §passthrough): text is
 * whitespace-trimmed at import and CDATA is re-emitted as escaped text —
 * semantically lossless, byte-stable between OUR exports.
 */
export interface XmlSubtree {
  /** Prefixed tag exactly as parsed, e.g. "zeebe:taskDefinition". */
  tag: string;
  attributes: Record<string, string>;
  children: XmlSubtree[];
  text: string;
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
  /**
   * Foreign `extensionElements` children (non-`bpmnr` namespaces) preserved
   * verbatim in original order — never interpreted, always re-exported.
   */
  foreignExtensions?: XmlSubtree[];
  /** Foreign-prefixed attributes of the source element (e.g. `zeebe:modelerTemplate`). */
  foreignAttributes?: Record<string, string>;
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
  /** Foreign `extensionElements` children preserved verbatim (passthrough). */
  foreignExtensions?: XmlSubtree[];
  /** Foreign-prefixed attributes of the source element. */
  foreignAttributes?: Record<string, string>;
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
  /**
   * Text co-authorship (Handoff 9 C4): set when the summary was PRE-FILLED by
   * the copilot and then committed by a human interaction with the field —
   * `edited` says whether the human changed the AI text. Rides into the
   * VERSION_ACTIVATED ledger entry; absent = fully human text.
   */
  changeSummaryOrigin?: {
    author: string;
    promptTemplateRef: { id: string; version: string };
    edited: boolean;
  };
  createdBy: string;
  createdAt: string;
  /** SHA-256 of the normalized diagram content at version creation. */
  snapshotHash: string;
  parentVersionId?: string;
}

/**
 * A NAMED event definition of first class (Handoff 16 §3a) — the OMG root
 * element (`bpmn:message`/`bpmn:signal`) an event references via
 * `messageRef`/`signalRef`. Events keep their KIND in
 * `properties.eventDefinition`; the reference to a named definition lives in
 * `properties.eventDefinitionRef` (the definition's `id` — rename never
 * touches nodes, E-0 decision 5).
 */
export interface NamedEventDefinition {
  id: string;
  name: string;
}

/** `bpmn:error` root element — carries the OMG `errorCode` used by matching. */
export interface ErrorEventDefinition extends NamedEventDefinition {
  errorCode?: string;
}

/** The named-definition buckets, one per referenceable kind. */
export interface EventDefinitions {
  messages: NamedEventDefinition[];
  signals: NamedEventDefinition[];
  errors: ErrorEventDefinition[];
}

export interface BpmnDiagram {
  id: string;
  name: string;
  description: string;
  version: BpmnVersion;
  nodes: Record<string, BpmnNode>;
  edges: Record<string, BpmnEdge>;
  metadata: Record<string, unknown>;
  /**
   * Named event definitions (Handoff 16 §3a): export as OMG root elements,
   * referenced by events via `properties.eventDefinitionRef`. Optional and
   * additive — absent keeps every pre-existing hash and export byte-identical.
   */
  definitions?: EventDefinitions;
  /**
   * Foreign `extensionElements` children of the `<bpmn:process>` element
   * (e.g. `zeebe:userTaskForm`) preserved verbatim (passthrough).
   */
  processForeignExtensions?: XmlSubtree[];
  /**
   * Foreign `xmlns:*` declarations captured from the imported root
   * (prefix → uri), re-declared on export in sorted-prefix order.
   */
  foreignNamespaces?: Record<string, string>;
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

/** Nesting depth of a node (0 = top level), by its parentId chain. */
function containmentDepth(diagram: BpmnDiagram, nodeId: string): number {
  let depth = 0;
  const seen = new Set<string>([nodeId]);
  let parentId = nodeParentId(diagram.nodes[nodeId] ?? ({} as BpmnNode));
  while (parentId !== undefined && !seen.has(parentId)) {
    depth += 1;
    seen.add(parentId);
    parentId = nodeParentId(diagram.nodes[parentId] ?? ({} as BpmnNode));
  }
  return depth;
}

/**
 * Hierarchical hit-test for reparent-on-drop (F7): the DEEPEST expanded
 * sub-process whose rect contains `point`, skipping any id in `exclude` — the
 * dragged nodes and their own descendants, since a node can never reparent
 * into itself or its subtree. Nested containers resolve to the innermost match
 * so a drop lands where the cursor visually is (ties on depth break to the
 * smaller rect). Collapsed sub-processes are ignored — their interior is not
 * on the canvas to drop into. Returns undefined when the point is over no
 * eligible container (a plain move, or a drop at the top level).
 */
export function subProcessContainerAt(
  diagram: BpmnDiagram,
  point: Point,
  exclude: ReadonlySet<string> = new Set<string>(),
): BpmnNode | undefined {
  let best: BpmnNode | undefined;
  let bestDepth = -1;
  for (const node of Object.values(diagram.nodes)) {
    if (node.removedInVersion !== undefined) continue;
    if (node.type !== 'subProcess' || !isSubProcessExpanded(node)) continue;
    if (exclude.has(node.id)) continue;
    const inside =
      point.x >= node.x &&
      point.x <= node.x + node.width &&
      point.y >= node.y &&
      point.y <= node.y + node.height;
    if (!inside) continue;
    const depth = containmentDepth(diagram, node.id);
    const deeper = depth > bestDepth;
    const tie = depth === bestDepth && best !== undefined &&
      node.width * node.height < best.width * best.height;
    if (deeper || tie) {
      best = node;
      bestDepth = depth;
    }
  }
  return best;
}

/**
 * A call activity invokes another process by id (`properties.calledElement`,
 * the standard BPMN attribute). The id is expected to match a registered
 * diagram — `@buildtovalue/registry` resolves it to the version in effect at a
 * given date (`resolveCallActivities`). Returns the called process id, if any.
 */
export function calledElementOf(node: BpmnNode): string | undefined {
  return node.type === 'callActivity' && typeof node.properties.calledElement === 'string'
    ? node.properties.calledElement
    : undefined;
}

/**
 * Data associations connect a data element (`dataObject`/`dataStore` or any
 * plugin type with `category: 'data'`) to an activity. On export they become
 * the standard `dataInputAssociation`/`dataOutputAssociation` nested in the
 * activity element, so the direction decides the tag: data → activity is an
 * input, activity → data an output.
 */
export const DATA_ASSOCIATION_EDGE_TYPE = 'dataAssociation';

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
