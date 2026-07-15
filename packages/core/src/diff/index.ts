import type { BpmnDiagram, BpmnEdge, BpmnNode } from '../model/types.js';
import { canonicalJson, roundCoord } from '../persistence/hash.js';

export interface FieldChange {
  from: unknown;
  to: unknown;
}

export type NodeDiffOp =
  | { op: 'add'; node: BpmnNode }
  | { op: 'remove'; nodeId: string }
  | { op: 'update'; nodeId: string; changes: Record<string, FieldChange> };

export type EdgeDiffOp =
  | { op: 'add'; edge: BpmnEdge }
  | { op: 'remove'; edgeId: string }
  | { op: 'update'; edgeId: string; changes: Record<string, FieldChange> }
  | { op: 'supersede'; edgeId: string; newEdgeId: string };

export interface BpmnDiff {
  nodes: NodeDiffOp[];
  edges: EdgeDiffOp[];
  metadata: Record<string, FieldChange>;
}

export function isEmptyDiff(diff: BpmnDiff): boolean {
  return (
    diff.nodes.length === 0 &&
    diff.edges.length === 0 &&
    Object.keys(diff.metadata).length === 0
  );
}

const NODE_FIELDS: (keyof BpmnNode)[] = [
  'type',
  'label',
  'x',
  'y',
  'width',
  'height',
  'properties',
  'removedInVersion',
];

const EDGE_FIELDS: (keyof BpmnEdge)[] = [
  'type',
  'sourceId',
  'targetId',
  'label',
  'purpose',
  'waypoints',
  'properties',
  'removedInVersion',
];

/**
 * Same equality semantics as `canonicalJson(a) !== canonicalJson(b)` — numbers
 * compare rounded to two decimals — without serializing primitives to JSON.
 * Only objects/arrays fall back to canonical serialization.
 */
function differs(rawA: unknown, rawB: unknown): boolean {
  const a = rawA ?? null;
  const b = rawB ?? null;
  if (typeof a === 'number' && typeof b === 'number') {
    return roundCoord(a) !== roundCoord(b);
  }
  const aPrimitive = a === null || typeof a !== 'object';
  const bPrimitive = b === null || typeof b !== 'object';
  if (aPrimitive && bPrimitive) return !Object.is(a, b);
  return canonicalJson(a) !== canonicalJson(b);
}

function fieldChanges<T extends object>(
  before: T,
  after: T,
  fields: (keyof T)[],
): Record<string, FieldChange> | null {
  const changes: Record<string, FieldChange> = {};
  for (const field of fields) {
    const a = before[field];
    const b = after[field];
    if (differs(a, b)) {
      changes[field as string] = { from: a, to: b };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Structured diff between two diagram states. Superseded edges are reported
 * as a single `supersede` operation (old edge id → replacement id) instead of
 * an unrelated remove+add pair.
 */
export function computeDiff(before: BpmnDiagram, after: BpmnDiagram): BpmnDiff {
  const diff: BpmnDiff = { nodes: [], edges: [], metadata: {} };

  for (const [id, node] of Object.entries(after.nodes)) {
    const previous = before.nodes[id];
    if (!previous) {
      diff.nodes.push({ op: 'add', node });
    } else {
      const changes = fieldChanges(previous, node, NODE_FIELDS);
      if (changes) diff.nodes.push({ op: 'update', nodeId: id, changes });
    }
  }
  for (const id of Object.keys(before.nodes)) {
    if (!after.nodes[id]) diff.nodes.push({ op: 'remove', nodeId: id });
  }

  const supersededOldIds = new Set<string>();
  for (const [id, edge] of Object.entries(after.edges)) {
    const previous = before.edges[id];
    if (!previous) {
      if (edge.supersedesEdgeId && before.edges[edge.supersedesEdgeId]) {
        diff.edges.push({ op: 'supersede', edgeId: edge.supersedesEdgeId, newEdgeId: id });
        supersededOldIds.add(edge.supersedesEdgeId);
      } else {
        diff.edges.push({ op: 'add', edge });
      }
    } else {
      const changes = fieldChanges(previous, edge, EDGE_FIELDS);
      if (changes) diff.edges.push({ op: 'update', edgeId: id, changes });
    }
  }
  for (const id of Object.keys(before.edges)) {
    if (!after.edges[id] && !supersededOldIds.has(id)) {
      diff.edges.push({ op: 'remove', edgeId: id });
    }
  }

  for (const key of new Set([...Object.keys(before.metadata), ...Object.keys(after.metadata)])) {
    const a = before.metadata[key];
    const b = after.metadata[key];
    if (differs(a, b)) {
      diff.metadata[key] = { from: a, to: b };
    }
  }

  return diff;
}

/**
 * Diff between two ADJACENT versions of an edge in a supersession chain
 * (Handoff 5 §5 — the pedigree strip's DiffView plug): the supersede op
 * plus the field changes between the two edge objects, in the same BpmnDiff
 * shape the DiffView already renders.
 */
export function edgeVersionDiff(before: BpmnEdge, after: BpmnEdge): BpmnDiff {
  const diff: BpmnDiff = { nodes: [], edges: [], metadata: {} };
  diff.edges.push({ op: 'supersede', edgeId: before.id, newEdgeId: after.id });
  const changes = fieldChanges(before, after, EDGE_FIELDS);
  if (changes) diff.edges.push({ op: 'update', edgeId: after.id, changes });
  return diff;
}

export interface NormalizedDiagramContent {
  nodes: unknown[];
  edges: unknown[];
}

/**
 * Canonical, comparison-friendly projection of a diagram's *content* —
 * elements sorted by id, coordinates rounded, audit trails and version
 * metadata stripped. Used to verify XML round-trips.
 */
export function normalizeForDiff(diagram: BpmnDiagram): NormalizedDiagramContent {
  // Canonicalize property key order so a round-trip that preserves values but
  // reorders keys (e.g. import building `properties` in a different order than
  // creation) compares equal.
  const canonProps = (props: Record<string, unknown>): Record<string, unknown> =>
    JSON.parse(canonicalJson(props)) as Record<string, unknown>;
  const nodes = Object.values(diagram.nodes)
    .map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      x: roundCoord(n.x),
      y: roundCoord(n.y),
      width: roundCoord(n.width),
      height: roundCoord(n.height),
      properties: canonProps(n.properties),
      ...(n.removedInVersion ? { removedInVersion: n.removedInVersion } : {}),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const edges = Object.values(diagram.edges)
    .map((e) => ({
      id: e.id,
      type: e.type,
      sourceId: e.sourceId,
      targetId: e.targetId,
      ...(e.label !== undefined && e.label !== '' ? { label: e.label } : {}),
      ...(e.purpose !== undefined && e.purpose !== '' ? { purpose: e.purpose } : {}),
      properties: canonProps(e.properties),
      ...(e.removedInVersion ? { removedInVersion: e.removedInVersion } : {}),
      ...(e.supersedesEdgeId ? { supersedesEdgeId: e.supersedesEdgeId } : {}),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  return { nodes, edges };
}
