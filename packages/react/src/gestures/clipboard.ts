import {
  activeEdges,
  activeNodes,
  addEdgeCommand,
  addNodeCommand,
  boundaryAttachedTo,
  compositeCommand,
  generateId,
  laneFlowNodeRefs,
  nodeParentId,
  type BpmnDiagram,
  type BpmnEdge,
  type BpmnNode,
  type Command,
} from '@buildtovalue/core';

/** Serialized clipboard content — self-describing so foreign JSON is ignored. */
export interface ClipboardPayload {
  kind: 'bpmnr-elements';
  nodes: BpmnNode[];
  edges: BpmnEdge[];
}

export const PASTE_OFFSET = 24;

/**
 * Collects the copyable subset of a selection: the selected active nodes plus
 * every active edge whose two endpoints are in that set (selected or not —
 * copying two connected tasks always carries their connection).
 */
export function collectClipboardPayload(
  diagram: BpmnDiagram,
  selectedIds: readonly string[],
): ClipboardPayload | null {
  const selected = new Set(selectedIds);
  const nodes = activeNodes(diagram).filter((n) => selected.has(n.id));
  if (nodes.length === 0) return null;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = activeEdges(diagram).filter(
    (e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId),
  );
  return { kind: 'bpmnr-elements', nodes: structuredClone(nodes), edges: structuredClone(edges) };
}

export function serializeClipboardPayload(payload: ClipboardPayload): string {
  return JSON.stringify(payload);
}

export function parseClipboardPayload(text: string): ClipboardPayload | null {
  try {
    const parsed = JSON.parse(text) as Partial<ClipboardPayload>;
    if (parsed?.kind !== 'bpmnr-elements') return null;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return parsed as ClipboardPayload;
  } catch {
    return null;
  }
}

/**
 * Builds one undoable composite that inserts the payload as fresh elements:
 * new UUIDs, endpoints/containment/boundary/lane references remapped to the
 * new ids (references to elements outside the payload are kept when the
 * target still exists in the diagram, dropped otherwise), fresh audit trails,
 * `createdInVersion` = the current version.
 */
export function buildPasteCommand(
  diagram: BpmnDiagram,
  payload: ClipboardPayload,
  options: { description?: string; offsetX?: number; offsetY?: number; userId?: string } = {},
): { command: Command; newIds: string[] } | null {
  if (payload.nodes.length === 0) return null;
  const dx = options.offsetX ?? PASTE_OFFSET;
  const dy = options.offsetY ?? PASTE_OFFSET;
  const userId = options.userId ?? 'anonymous';
  const versionId = diagram.version.id;
  const idMap = new Map<string, string>();
  for (const node of payload.nodes) idMap.set(node.id, generateId());
  for (const edge of payload.edges) idMap.set(edge.id, generateId());

  const remapRef = (ref: string | undefined): string | undefined => {
    if (ref === undefined) return undefined;
    if (idMap.has(ref)) return idMap.get(ref);
    return diagram.nodes[ref] ? ref : undefined;
  };
  const freshAudit = () => ({
    createdAt: new Date().toISOString(),
    createdBy: userId,
    history: [],
  });

  const commands: Command[] = [];
  const insertedIds: string[] = [];
  for (const node of payload.nodes) {
    const properties: Record<string, unknown> = { ...node.properties };
    const parent = remapRef(nodeParentId(node));
    if (parent !== undefined) properties.parentId = parent;
    else delete properties.parentId;
    const host = remapRef(boundaryAttachedTo(node));
    if (node.type === 'boundaryEvent') {
      if (host === undefined) continue; // a boundary event without a host is invalid
      properties.attachedToRef = host;
    }
    if (node.type === 'lane') {
      properties.flowNodeRefs = laneFlowNodeRefs(node)
        .map((ref) => remapRef(ref))
        .filter((ref): ref is string => ref !== undefined);
    }
    const clone: BpmnNode = {
      ...structuredClone(node),
      id: idMap.get(node.id) as string,
      x: node.x + dx,
      y: node.y + dy,
      properties,
      createdInVersion: versionId,
      audit: freshAudit(),
    };
    delete clone.removedInVersion;
    commands.push(addNodeCommand(clone));
    insertedIds.push(clone.id);
  }
  const keptNodeIds = new Set(insertedIds);
  for (const edge of payload.edges) {
    const sourceId = idMap.get(edge.sourceId);
    const targetId = idMap.get(edge.targetId);
    if (!sourceId || !targetId || !keptNodeIds.has(sourceId) || !keptNodeIds.has(targetId)) {
      continue;
    }
    const clone: BpmnEdge = {
      ...structuredClone(edge),
      id: idMap.get(edge.id) as string,
      sourceId,
      targetId,
      ...(edge.waypoints
        ? { waypoints: edge.waypoints.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
        : {}),
      createdInVersion: versionId,
      audit: freshAudit(),
    };
    delete clone.supersedesEdgeId;
    delete clone.removedInVersion;
    commands.push(addEdgeCommand(clone));
    insertedIds.push(clone.id);
  }
  if (commands.length === 0) return null;
  return {
    command: compositeCommand(options.description ?? 'Paste elements', commands),
    newIds: insertedIds,
  };
}

// ---------------------------------------------------------------- transport

// Module-level fallback so copy/paste works when the async Clipboard API is
// unavailable (insecure context, denied permission, jsdom).
let internalClipboard: ClipboardPayload | null = null;

export async function writeClipboardPayload(payload: ClipboardPayload): Promise<void> {
  internalClipboard = payload;
  try {
    await navigator.clipboard?.writeText(serializeClipboardPayload(payload));
  } catch {
    // Fallback already stored.
  }
}

export async function readClipboardPayload(): Promise<ClipboardPayload | null> {
  try {
    const text = await navigator.clipboard?.readText();
    if (text) {
      const parsed = parseClipboardPayload(text);
      if (parsed) return parsed;
    }
  } catch {
    // Fall through to the internal fallback.
  }
  return internalClipboard;
}

/** True when a paste could produce something (used to show the menu item). */
export function hasClipboardContent(): boolean {
  return internalClipboard !== null || typeof navigator.clipboard?.readText === 'function';
}
