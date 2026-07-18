import { nodeParentId, type BpmnDiagram, type BpmnNode } from '@buildtovalue/core';

/**
 * Executable-event matrix (Handoff 16 E-4, §3c). Lives HERE — in react, not
 * in the engine and not in a registry — because the throw/catch asymmetry is
 * OMG semantics (cerca §1.4), not an engine opinion; the engine only names
 * the property KEYS (`payloadKey`/`errorCodeVariableKey`/…).
 *
 * - `'throw'` (payload mappings var→destino): `intermediateThrowEvent` and
 *   `endEvent` whose kind is message|signal.
 * - `'catch-error'` (capture variables errCode/errMsg): error `boundaryEvent`,
 *   and an error `startEvent` CONTAINED in a subProcess — the honest
 *   approximation of the event subprocess, which remains its own pendency
 *   (§3); a TOP-LEVEL error start is exactly what `EVT_ERROR_START_TOPLEVEL`
 *   (E-5) will flag, so it gets NO tab here.
 * - Everything else → `null`: message/signal catches carry no I/O in this
 *   handoff (runtime correlation is host-owned, §3) and keep no tab.
 */
export type EventExecutionMode = 'throw' | 'catch-error';

const THROW_TYPES = new Set(['intermediateThrowEvent', 'endEvent']);
const THROW_KINDS = new Set(['message', 'signal']);

export function eventExecutionModeOf(
  diagram: BpmnDiagram,
  node: BpmnNode,
): EventExecutionMode | null {
  const kind = node.properties.eventDefinition;
  if (THROW_TYPES.has(node.type) && typeof kind === 'string' && THROW_KINDS.has(kind)) {
    return 'throw';
  }
  if (kind !== 'error') return null;
  if (node.type === 'boundaryEvent') return 'catch-error';
  if (node.type === 'startEvent') {
    const parentId = nodeParentId(node);
    const parent = parentId ? diagram.nodes[parentId] : undefined;
    if (parent?.type === 'subProcess') return 'catch-error';
  }
  return null;
}

/** One var→destino row of a throw event's payload mapping. */
export interface PayloadMapping {
  source: string;
  target: string;
}

/** The payload rows stored under the engine's payload key (absent → []). */
export function payloadMappingsOf(node: BpmnNode, key: string): PayloadMapping[] {
  const value = node.properties[key];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is PayloadMapping =>
      typeof row === 'object' &&
      row !== null &&
      typeof (row as PayloadMapping).source === 'string' &&
      typeof (row as PayloadMapping).target === 'string',
  );
}

/**
 * Clean-model pruning (E-4 reforço 7): rows with BOTH sides blank never
 * serialize, and an empty list removes the property entirely — the absent
 * field keeps the pre-E-4 bytes.
 */
export function prunePayloadMappings(rows: PayloadMapping[]): PayloadMapping[] | undefined {
  const kept = rows.filter((row) => row.source.trim() !== '' || row.target.trim() !== '');
  return kept.length > 0 ? kept : undefined;
}
