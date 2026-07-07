import { describe, expect, it } from 'vitest';
import {
  computeDiff,
  createDiagram,
  createEdge,
  createNode,
  isEmptyDiff,
  normalizeForDiff,
  type BpmnDiagram,
} from '../src/index.js';

function base(): BpmnDiagram {
  const diagram = createDiagram({ name: 'T', id: 'd1' });
  diagram.nodes.n1 = createNode({ type: 'task', id: 'n1', label: 'A', x: 0, y: 0 });
  diagram.nodes.n2 = createNode({ type: 'task', id: 'n2', label: 'B', x: 200, y: 0 });
  diagram.edges.e1 = createEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2' });
  return diagram;
}

describe('computeDiff', () => {
  it('reports an empty diff for identical diagrams', () => {
    const diagram = base();
    const diff = computeDiff(diagram, structuredClone(diagram));
    expect(isEmptyDiff(diff)).toBe(true);
  });

  it('detects added and removed nodes', () => {
    const before = base();
    const after = structuredClone(before);
    const added = createNode({ type: 'endEvent', id: 'n3' });
    after.nodes.n3 = added;
    delete after.nodes.n2;
    delete after.edges.e1;

    const diff = computeDiff(before, after);
    expect(diff.nodes).toContainEqual({ op: 'add', node: added });
    expect(diff.nodes).toContainEqual({ op: 'remove', nodeId: 'n2' });
    expect(diff.edges).toContainEqual({ op: 'remove', edgeId: 'e1' });
  });

  it('detects field-level updates with from/to values', () => {
    const before = base();
    const after = structuredClone(before);
    after.nodes.n1 = { ...after.nodes.n1, label: 'Renamed', x: 50 };

    const diff = computeDiff(before, after);
    const update = diff.nodes.find((op) => op.op === 'update');
    expect(update).toBeDefined();
    if (update?.op === 'update') {
      expect(update.changes.label).toEqual({ from: 'A', to: 'Renamed' });
      expect(update.changes.x).toEqual({ from: 0, to: 50 });
      expect(update.changes.y).toBeUndefined();
    }
  });

  it('ignores audit-only changes', () => {
    const before = base();
    const after = structuredClone(before);
    after.nodes.n1.audit.history.push({
      type: 'X',
      timestamp: 't',
      userId: 'u',
      versionId: 'v',
    });
    expect(isEmptyDiff(computeDiff(before, after))).toBe(true);
  });

  it('reports supersede as a single linked operation', () => {
    const before = base();
    const after = structuredClone(before);
    after.edges.e1 = { ...after.edges.e1, removedInVersion: 'v2' };
    const replacement = createEdge({
      id: 'e2',
      sourceId: 'n1',
      targetId: 'n2',
      supersedesEdgeId: 'e1',
    });
    after.edges.e2 = replacement;

    const diff = computeDiff(before, after);
    expect(diff.edges).toContainEqual({ op: 'supersede', edgeId: 'e1', newEdgeId: 'e2' });
    // The closing of e1 is an update, not a remove
    expect(diff.edges.some((op) => op.op === 'remove')).toBe(false);
  });

  it('detects metadata changes', () => {
    const before = base();
    const after = structuredClone(before);
    after.metadata.owner = 'team-x';
    const diff = computeDiff(before, after);
    expect(diff.metadata.owner).toEqual({ from: undefined, to: 'team-x' });
  });
});

describe('normalizeForDiff', () => {
  it('sorts elements, rounds floats and strips audit/version', () => {
    const a = base();
    a.nodes.n1.x = 10.001;
    const b = structuredClone(a);
    b.nodes.n1.x = 10.0009; // rounds to the same value
    b.nodes.n1.audit.history.push({ type: 'X', timestamp: 't', userId: 'u', versionId: 'v' });
    b.version.id = 'different-version';

    expect(JSON.stringify(normalizeForDiff(a))).toBe(JSON.stringify(normalizeForDiff(b)));
  });

  it('treats missing and empty labels as equivalent', () => {
    const a = base();
    a.edges.e1.label = '';
    const b = structuredClone(a);
    delete b.edges.e1.label;
    expect(JSON.stringify(normalizeForDiff(a))).toBe(JSON.stringify(normalizeForDiff(b)));
  });
});
