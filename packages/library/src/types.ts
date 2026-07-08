/**
 * ArtifactAdapter contract — the heart of the generic library (Handoff 6 §3).
 *
 * This package deliberately imports NOTHING from the rest of the ecosystem
 * (no @bpmn-react/core, no @bpmn-react/registry, no react): the six-state
 * LifecycleStatus below is the only shared vocabulary, structurally
 * compatible with core's VersionStatus without a nominal dependency.
 * Adapters that use a different lifecycle must map into these six states
 * (documenting the loss). Enforced by tests/independence.test.ts.
 */

/** Canonical lifecycle order — also the sort order for `sort: 'status'`. */
export const LIFECYCLE_STATUSES = [
  'draft',
  'test',
  'candidate',
  'active',
  'deprecated',
  'retired',
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

/** Stable address of an artifact: which adapter owns it + its id there. */
export interface ArtifactRef {
  adapterId: string;
  artifactId: string;
}

/**
 * Thumbnails arrive as data, never as imported components (§3.1): the
 * adapter draws (an SVG string or a named icon), the library only places it.
 */
export type ThumbnailSpec =
  | { kind: 'svg'; svg: string }
  | { kind: 'icon'; icon: string }
  | { kind: 'none' };

/**
 * Actions are descriptors the host (Studio) resolves (§3.2). The library
 * renders buttons — it never executes a mutation itself.
 */
export interface ArtifactAction {
  id: string;
  label: string;
  kind: 'navigate' | 'download' | 'external';
  href?: string;
  payload?: unknown;
}

/** One row of the version timeline shown in the artifact drawer. */
export interface VersionEntry {
  version: string;
  status: LifecycleStatus;
  /** ISO timestamp of the entry, when the adapter knows it. */
  timestamp?: string;
  /** Free-form note ("supersedeu v1.2.0", "3 execuções presas"…). */
  note?: string;
}

export interface ArtifactSummary {
  ref: ArtifactRef;
  name: string;
  /** Free label from the adapter — "FLUXO", "PERSONA", "DECISÃO"… */
  typeLabel: string;
  /** Semver of the version relevant to the observer's channel. */
  version: string;
  status: LifecycleStatus;
  channel?: string;
  /** Pinned executions (bindRun) — derived by the adapter, optional. */
  boundRuns?: number;
  /** Free context line. */
  meta?: string;
  thumbnail?: ThumbnailSpec;
  /**
   * ISO timestamp of the latest relevant change. Extension over Handoff 6
   * §3: required by the §4 "atualização" sort; entries without it sort
   * after dated ones.
   */
  updatedAt?: string;
}

export interface ArtifactDetail extends ArtifactSummary {
  effectiveFrom?: string;
  effectiveUntil?: string;
  approvers?: string[];
  changeSummary?: string;
  provenance?: { ledgerHash: string; author: string; createdAt: string };
  /** Full version timeline, newest first by adapter convention. */
  versions: VersionEntry[];
  actions: ArtifactAction[];
}

export type LibrarySort = 'name' | 'updated' | 'status';

export interface LibraryQuery {
  /** Case-insensitive match against name, typeLabel and meta. */
  text?: string;
  /** Fixed vocabulary — the six LifecycleStatus states. */
  statuses?: LifecycleStatus[];
  /** Dynamic vocabulary — ids of registered adapters (type chips). */
  adapterIds?: string[];
  sort?: LibrarySort;
}

export interface ArtifactAdapter {
  /** Unique id — "bpmn-diagram", "prompt", "dmn-decision"… */
  id: string;
  typeLabel: string;
  list(query: LibraryQuery): Promise<ArtifactSummary[]>;
  get(id: string): Promise<ArtifactDetail>;
  /** Optional invalidation: call cb when the adapter's data changes. */
  subscribe?(cb: () => void): () => void;
}
