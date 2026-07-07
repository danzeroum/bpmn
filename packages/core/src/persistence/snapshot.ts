import type { BpmnDiagram } from '../model/types.js';
import { nowIso } from '../model/factory.js';
import { computeDiagramHash } from '../engine/lifecycle.js';

export interface Snapshot {
  diagram: BpmnDiagram;
  /** SHA-256 over the canonical diagram content. */
  hash: string;
  createdAt: string;
  createdBy: string;
}

/** Captures an immutable snapshot of the diagram with a content hash. */
export async function createSnapshot(
  diagram: BpmnDiagram,
  createdBy = 'anonymous',
): Promise<Snapshot> {
  return {
    diagram: structuredClone(diagram),
    hash: await computeDiagramHash(diagram),
    createdAt: nowIso(),
    createdBy,
  };
}

/** Recomputes the hash and compares — detects any content drift. */
export async function verifySnapshot(snapshot: Snapshot): Promise<boolean> {
  return (await computeDiagramHash(snapshot.diagram)) === snapshot.hash;
}
