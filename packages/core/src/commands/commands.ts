import type { BpmnDiagram, BpmnEdge, BpmnNode, Point, Size, UserContext } from '../model/types.js';
import { descendantIdsOf } from '../model/types.js';
import { generateId, nowIso } from '../model/factory.js';
import type { Command } from './types.js';

const SYSTEM_USER: UserContext = { id: 'system', role: 'system' };

function withNode(diagram: BpmnDiagram, node: BpmnNode): BpmnDiagram {
  return { ...diagram, nodes: { ...diagram.nodes, [node.id]: node } };
}

function withEdge(diagram: BpmnDiagram, edge: BpmnEdge): BpmnDiagram {
  return { ...diagram, edges: { ...diagram.edges, [edge.id]: edge } };
}

function withoutNode(diagram: BpmnDiagram, nodeId: string): BpmnDiagram {
  const { [nodeId]: _removed, ...nodes } = diagram.nodes;
  return { ...diagram, nodes };
}

function withoutEdge(diagram: BpmnDiagram, edgeId: string): BpmnDiagram {
  const { [edgeId]: _removed, ...edges } = diagram.edges;
  return { ...diagram, edges };
}

function appendHistory<T extends BpmnNode | BpmnEdge>(
  element: T,
  type: string,
  versionId: string,
  actor: UserContext,
  details?: Record<string, unknown>,
): T {
  return {
    ...element,
    audit: {
      ...element.audit,
      history: [
        ...element.audit.history,
        { type, timestamp: nowIso(), userId: actor.id, versionId, ...(details ? { details } : {}) },
      ],
    },
  };
}

export function addNodeCommand(node: BpmnNode): Command {
  return {
    id: generateId(),
    description: `Add ${node.type} "${node.label}"`,
    execute: (diagram) => withNode(diagram, node),
    undo: (diagram) => withoutNode(diagram, node.id),
    toAuditEvent: () => ({
      type: 'NODE_ADDED',
      details: { nodeId: node.id, nodeType: node.type, label: node.label },
    }),
  };
}

export function moveNodeCommand(nodeId: string, from: Point, to: Point): Command {
  const apply = (diagram: BpmnDiagram, position: Point): BpmnDiagram => {
    const node = diagram.nodes[nodeId];
    if (!node) return diagram;
    return withNode(diagram, { ...node, x: position.x, y: position.y });
  };
  return {
    id: generateId(),
    description: `Move node`,
    execute: (diagram) => apply(diagram, to),
    undo: (diagram) => apply(diagram, from),
    toAuditEvent: () => ({ type: 'NODE_MOVED', details: { nodeId, from, to } }),
  };
}

export function resizeNodeCommand(
  nodeId: string,
  from: Point & Size,
  to: Point & Size,
): Command {
  const apply = (diagram: BpmnDiagram, rect: Point & Size): BpmnDiagram => {
    const node = diagram.nodes[nodeId];
    if (!node) return diagram;
    return withNode(diagram, { ...node, ...rect });
  };
  return {
    id: generateId(),
    description: `Resize node`,
    execute: (diagram) => apply(diagram, to),
    undo: (diagram) => apply(diagram, from),
    toAuditEvent: () => ({ type: 'NODE_RESIZED', details: { nodeId, from, to } }),
  };
}

/** Full node snapshot the boundary attach/detach commands restore on undo. */
interface BoundarySnapshot {
  type: string;
  x: number;
  y: number;
  properties: Record<string, unknown>;
}

/**
 * Attaches an event to a host activity's border as a boundary event
 * (Handoff 11 N-1, pendências §6): ONE atomic command — type becomes
 * `boundaryEvent`, `attachedToRef` + the parametric anchor
 * (`boundarySide`/`boundaryT`, editor-only — never XML) are written and the
 * node moves onto the border, all in a single undoable step. Re-attaching an
 * already-attached boundary (new host, or sliding to a new side/t) is the
 * same command.
 */
export function attachBoundaryCommand(
  nodeId: string,
  hostId: string,
  side: 'top' | 'right' | 'bottom' | 'left',
  t: number,
  position: Point,
): Command {
  let previous: BoundarySnapshot | undefined;
  return {
    id: generateId(),
    description: 'Attach boundary event',
    execute: (diagram) => {
      const node = diagram.nodes[nodeId];
      if (!node) return diagram;
      previous = { type: node.type, x: node.x, y: node.y, properties: node.properties };
      return withNode(diagram, {
        ...node,
        type: 'boundaryEvent',
        x: position.x,
        y: position.y,
        properties: {
          ...node.properties,
          attachedToRef: hostId,
          boundarySide: side,
          boundaryT: t,
        },
      });
    },
    undo: (diagram) => {
      const node = diagram.nodes[nodeId];
      if (!node || !previous) return diagram;
      return withNode(diagram, { ...node, ...previous });
    },
    toAuditEvent: () => ({
      type: 'BOUNDARY_ATTACHED',
      details: { nodeId, hostId, side, t },
    }),
  };
}

/**
 * Detaches a boundary event from its host (the drag-out gesture): ONE atomic
 * command — the parametric anchor and `attachedToRef` are cleared, the node
 * becomes an intermediate catch event at the drop position. Undo restores the
 * attachment whole.
 */
export function detachBoundaryCommand(nodeId: string, position: Point): Command {
  let previous: BoundarySnapshot | undefined;
  return {
    id: generateId(),
    description: 'Detach boundary event',
    execute: (diagram) => {
      const node = diagram.nodes[nodeId];
      if (!node) return diagram;
      previous = { type: node.type, x: node.x, y: node.y, properties: node.properties };
      const properties = { ...node.properties };
      delete properties.attachedToRef;
      delete properties.boundarySide;
      delete properties.boundaryT;
      return withNode(diagram, {
        ...node,
        type: 'intermediateCatchEvent',
        x: position.x,
        y: position.y,
        properties,
      });
    },
    undo: (diagram) => {
      const node = diagram.nodes[nodeId];
      if (!node || !previous) return diagram;
      return withNode(diagram, { ...node, ...previous });
    },
    toAuditEvent: () => ({
      type: 'BOUNDARY_DETACHED',
      details: { nodeId },
    }),
  };
}

export interface NodePatch {
  label?: string;
  properties?: Record<string, unknown>;
}

export function updateNodeCommand(nodeId: string, patch: NodePatch): Command {
  let previous: NodePatch | undefined;
  return {
    id: generateId(),
    description: `Update node`,
    execute: (diagram) => {
      const node = diagram.nodes[nodeId];
      if (!node) return diagram;
      previous = { label: node.label, properties: node.properties };
      return withNode(diagram, {
        ...node,
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.properties !== undefined
          ? { properties: { ...node.properties, ...patch.properties } }
          : {}),
      });
    },
    undo: (diagram) => {
      const node = diagram.nodes[nodeId];
      if (!node || !previous) return diagram;
      return withNode(diagram, {
        ...node,
        label: previous.label ?? node.label,
        properties: previous.properties ?? node.properties,
      });
    },
    toAuditEvent: () => ({ type: 'NODE_UPDATED', details: { nodeId, patch } }),
  };
}

export interface EdgePatch {
  label?: string;
  purpose?: string;
  properties?: Record<string, unknown>;
  /** Routed waypoints (Handoff 10 R-2b). `null` clears them back to auto. */
  waypoints?: Point[] | null;
}

export function updateEdgeCommand(edgeId: string, patch: EdgePatch): Command {
  let previous: EdgePatch | undefined;
  return {
    id: generateId(),
    description: `Update edge`,
    execute: (diagram) => {
      const edge = diagram.edges[edgeId];
      if (!edge) return diagram;
      previous = {
        label: edge.label,
        purpose: edge.purpose,
        properties: edge.properties,
        waypoints: edge.waypoints ?? null,
      };
      const next: BpmnEdge = {
        ...edge,
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.purpose !== undefined ? { purpose: patch.purpose } : {}),
        ...(patch.properties !== undefined
          ? { properties: { ...edge.properties, ...patch.properties } }
          : {}),
      };
      if (patch.waypoints === null) delete next.waypoints;
      else if (patch.waypoints !== undefined) next.waypoints = patch.waypoints;
      return withEdge(diagram, next);
    },
    undo: (diagram) => {
      const edge = diagram.edges[edgeId];
      if (!edge || !previous) return diagram;
      const restored: BpmnEdge = { ...edge, properties: previous.properties ?? edge.properties };
      if (previous.label === undefined) delete restored.label;
      else restored.label = previous.label;
      if (previous.purpose === undefined) delete restored.purpose;
      else restored.purpose = previous.purpose;
      if (previous.waypoints == null) delete restored.waypoints;
      else restored.waypoints = previous.waypoints;
      return withEdge(diagram, restored);
    },
    toAuditEvent: () => ({ type: 'EDGE_UPDATED', details: { edgeId, patch } }),
  };
}

export function addEdgeCommand(edge: BpmnEdge): Command {
  return {
    id: generateId(),
    description: `Connect ${edge.sourceId} → ${edge.targetId}`,
    execute: (diagram) => withEdge(diagram, edge),
    undo: (diagram) => withoutEdge(diagram, edge.id),
    toAuditEvent: () => ({
      type: 'EDGE_CREATED',
      details: { edgeId: edge.id, sourceId: edge.sourceId, targetId: edge.targetId },
    }),
  };
}

/**
 * Removes a node. In a `draft` version the node (and its connected edges) is
 * hard-deleted; in any other status it is *closed* (`removedInVersion`),
 * preserving temporal immutability.
 */
export function removeNodeCommand(nodeId: string, actor: UserContext = SYSTEM_USER): Command {
  let deletedNodes: BpmnNode[] = [];
  let deletedEdges: BpmnEdge[] = [];
  let closedIds: string[] = [];
  let closed = false;
  return {
    id: generateId(),
    description: `Remove node`,
    execute: (diagram) => {
      const node = diagram.nodes[nodeId];
      if (!node) return diagram;
      const versionId = diagram.version.id;
      // Removing a sub-process cascades over its descendants: a child without
      // its container is meaningless (and would fail INVALID_PARENT_REF).
      const ids = new Set([nodeId, ...descendantIdsOf(diagram, nodeId)]);
      const touches = (edge: BpmnEdge) => ids.has(edge.sourceId) || ids.has(edge.targetId);
      if (diagram.version.status === 'draft') {
        closed = false;
        deletedNodes = [...ids]
          .map((id) => diagram.nodes[id])
          .filter((n): n is BpmnNode => n !== undefined);
        deletedEdges = Object.values(diagram.edges).filter(touches);
        let next = diagram;
        for (const removed of deletedNodes) next = withoutNode(next, removed.id);
        for (const edge of deletedEdges) next = withoutEdge(next, edge.id);
        return next;
      }
      closed = true;
      closedIds = [...ids];
      let next = diagram;
      for (const id of ids) {
        const target = diagram.nodes[id];
        if (!target || target.removedInVersion) continue;
        next = withNode(
          next,
          appendHistory({ ...target, removedInVersion: versionId }, 'REMOVED', versionId, actor),
        );
      }
      for (const edge of Object.values(diagram.edges)) {
        if (touches(edge) && !edge.removedInVersion) {
          next = withEdge(
            next,
            appendHistory({ ...edge, removedInVersion: versionId }, 'REMOVED', versionId, actor),
          );
        }
      }
      return next;
    },
    undo: (diagram) => {
      if (closed) {
        const ids = new Set(closedIds);
        let next = diagram;
        for (const id of closedIds) {
          const node = diagram.nodes[id];
          if (!node || node.removedInVersion !== diagram.version.id) continue;
          const { removedInVersion: _r, ...reopened } = node;
          next = withNode(next, reopened as BpmnNode);
        }
        for (const edge of Object.values(diagram.edges)) {
          if (
            (ids.has(edge.sourceId) || ids.has(edge.targetId)) &&
            edge.removedInVersion === diagram.version.id
          ) {
            const { removedInVersion: _e, ...reopenedEdge } = edge;
            next = withEdge(next, reopenedEdge as BpmnEdge);
          }
        }
        return next;
      }
      if (deletedNodes.length === 0) return diagram;
      let next = diagram;
      for (const restored of deletedNodes) next = withNode(next, restored);
      for (const edge of deletedEdges) next = withEdge(next, edge);
      return next;
    },
    toAuditEvent: () => ({ type: 'NODE_REMOVED', details: { nodeId } }),
  };
}

/** Removes an edge — hard delete in `draft`, closed otherwise. */
export function removeEdgeCommand(edgeId: string, actor: UserContext = SYSTEM_USER): Command {
  let deleted: BpmnEdge | undefined;
  let closed = false;
  return {
    id: generateId(),
    description: `Remove edge`,
    execute: (diagram) => {
      const edge = diagram.edges[edgeId];
      if (!edge) return diagram;
      if (diagram.version.status === 'draft') {
        closed = false;
        deleted = edge;
        return withoutEdge(diagram, edgeId);
      }
      closed = true;
      const versionId = diagram.version.id;
      return withEdge(
        diagram,
        appendHistory({ ...edge, removedInVersion: versionId }, 'REMOVED', versionId, actor),
      );
    },
    undo: (diagram) => {
      if (closed) {
        const edge = diagram.edges[edgeId];
        if (!edge) return diagram;
        const { removedInVersion: _r, ...reopened } = edge;
        return withEdge(diagram, reopened as BpmnEdge);
      }
      if (!deleted) return diagram;
      return withEdge(diagram, deleted);
    },
    toAuditEvent: () => ({ type: 'EDGE_REMOVED', details: { edgeId } }),
  };
}

/**
 * Closes `oldEdgeId` and adds `replacement` (which must reference the old edge
 * via `supersedesEdgeId`) as a single reversible step.
 */
export function supersedeEdgeCommand(
  oldEdgeId: string,
  replacement: BpmnEdge,
  actor: UserContext = SYSTEM_USER,
): Command {
  return {
    id: generateId(),
    description: `Supersede edge`,
    execute: (diagram) => {
      const oldEdge = diagram.edges[oldEdgeId];
      if (!oldEdge) return diagram;
      const versionId = diagram.version.id;
      const next = withEdge(
        diagram,
        appendHistory(
          { ...oldEdge, removedInVersion: versionId },
          'SUPERSEDED',
          versionId,
          actor,
          { supersededBy: replacement.id },
        ),
      );
      return withEdge(next, { ...replacement, supersedesEdgeId: oldEdgeId });
    },
    undo: (diagram) => {
      const oldEdge = diagram.edges[oldEdgeId];
      let next = withoutEdge(diagram, replacement.id);
      if (oldEdge) {
        const { removedInVersion: _r, ...reopened } = oldEdge;
        next = withEdge(next, reopened as BpmnEdge);
      }
      return next;
    },
    toAuditEvent: () => ({
      type: 'EDGE_SUPERSEDED',
      details: { oldEdgeId, newEdgeId: replacement.id },
    }),
  };
}

/**
 * Groups several commands into a single undo/redo step (e.g. a gesture that
 * adds an edge and updates node properties atomically).
 */
export function compositeCommand(description: string, commands: Command[]): Command {
  return {
    id: generateId(),
    description,
    execute: (diagram) => commands.reduce((d, cmd) => cmd.execute(d), diagram),
    undo: (diagram) => [...commands].reverse().reduce((d, cmd) => cmd.undo(d), diagram),
    toAuditEvent: () => ({
      type: 'COMPOSITE',
      details: {
        description,
        events: commands.map((c) => c.toAuditEvent?.()).filter(Boolean),
      },
    }),
  };
}

/**
 * Replaces the whole diagram with a snapshot — the undoable path for
 * restoring an autosaved draft (editor resilience). `undo` returns the
 * diagram as it was at execution time, captured on `execute`.
 */
export function restoreDiagramCommand(
  snapshot: BpmnDiagram,
  description = 'Restore autosaved draft',
): Command {
  let before: BpmnDiagram | null = null;
  return {
    id: generateId(),
    description,
    execute: (diagram) => {
      before = diagram;
      return snapshot;
    },
    undo: (diagram) => before ?? diagram,
    toAuditEvent: () => ({
      type: 'DIAGRAM_RESTORED',
      details: { description, restoredVersionId: snapshot.version.id },
    }),
  };
}
