import { isEventSubprocess, nodeParentId, type BpmnDiagram, type BpmnNode } from '@buildtovalue/core';

/**
 * Executable-event matrix (Handoff 16 E-4, §3c). Lives HERE — in react, not
 * in the engine and not in a registry — because the throw/catch asymmetry is
 * OMG semantics (cerca §1.4), not an engine opinion; the engine only names
 * the property KEYS (`payloadKey`/`errorCodeVariableKey`/…).
 *
 * - `'throw'` (payload mappings var→destino): `intermediateThrowEvent` and
 *   `endEvent` whose kind is message|signal.
 * - `'catch-error'` (capture variables errCode/errMsg): error `boundaryEvent`,
 *   and an error `startEvent` contained in an EVENT SUBPROCESS — tightened in
 *   Handoff 17 ES-3 (§4c): the E-4 "any subProcess" approximation is dead;
 *   the predicate is the core `isEventSubprocess` helper (ES-1 reforço 9 —
 *   the SAME object the ES-4 lint consumes, agreement by construction). An
 *   error start anywhere else is what `EVT_ERROR_START_TOPLEVEL` flags — no
 *   tab here.
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
    if (parent !== undefined && isEventSubprocess(parent)) return 'catch-error';
  }
  return null;
}

/** One var→destino row of a throw event's payload mapping. */
export interface PayloadMapping {
  source: string;
  target: string;
  /**
   * Squad Lane SL-12 — an OPTIONAL named transformation applied to the value.
   * Absent → a plain field copy (always legal). When present, it must belong to
   * the injected transform catalog (`MAPPING_TRANSFORM_ILLEGAL` otherwise).
   * Additive/MINOR: an absent field keeps the pre-SL-12 bytes.
   */
  transform?: string;
  /**
   * Squad Lane SL-12 — the versioned adapter that performs a TYPE CONVERSION.
   * A catalog transform marked as a conversion must name one; a conversion with
   * no `adapterRef` is `MAPPING_TRANSFORM_ILLEGAL` (§6 — "conversão sem adapterRef").
   */
  adapterRef?: string;
}

/**
 * Squad Lane SL-12 — the injected transform catalog (§6/§8). The host owns the
 * set of legal transformations (versioned artifacts, like `resolveTool`), so
 * mappings can only reference transforms FROM the catalog — never a free-typed
 * one. Degradable: with no catalog injected, {@link payloadMappingIssues} runs
 * no transform check (a plain source→target copy is always legal).
 */
export interface TransformCatalog {
  /** True when `transform` is a legal catalog member. */
  has(transform: string): boolean;
  /** True when the transform is a TYPE conversion that requires a versioned
   * `adapterRef` (a value reshape has none; a type change must name its adapter). */
  requiresAdapter(transform: string): boolean;
}

/** A mapping row that violates the catalog rule (§6 `MAPPING_TRANSFORM_ILLEGAL`). */
export interface MappingIssue {
  code: 'MAPPING_TRANSFORM_ILLEGAL';
  /** Index into the mappings array. */
  index: number;
  message: string;
  remediation: string;
}

/**
 * Validates payload mappings against the injected transform catalog (§6). A row
 * is illegal when it names a transform OUTSIDE the catalog, or a catalog
 * conversion with no `adapterRef`. A row with no transform is a plain copy and
 * always legal. Pure; returns issues to surface, never throws.
 */
export function payloadMappingIssues(rows: PayloadMapping[], catalog: TransformCatalog): MappingIssue[] {
  const issues: MappingIssue[] = [];
  rows.forEach((row, index) => {
    const transform = row.transform;
    if (transform === undefined || transform === '') return; // plain copy — always legal
    if (!catalog.has(transform)) {
      issues.push({
        code: 'MAPPING_TRANSFORM_ILLEGAL',
        index,
        message: `Mapping "${row.source} → ${row.target}" uses transform "${transform}", which is not in the catalog.`,
        remediation: 'Pick a transform from the catalog, or register it — a free-typed transform is never allowed.',
      });
      return;
    }
    if (catalog.requiresAdapter(transform) && (row.adapterRef === undefined || row.adapterRef === '')) {
      issues.push({
        code: 'MAPPING_TRANSFORM_ILLEGAL',
        index,
        message: `Mapping "${row.source} → ${row.target}" applies the conversion "${transform}" without a versioned adapterRef.`,
        remediation: 'A type conversion must name the versioned adapter that performs it (adapterRef "id@semver").',
      });
    }
  });
  return issues;
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
