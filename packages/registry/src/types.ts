import type { BpmnDiagram, BpmnVersion, VersionStatus } from '@buildtovalue/core';

export type DateInput = Date | string;

/** A publication lane: a channel, optionally scoped to an environment. */
export interface PublicationTarget {
  /** Rollout audience, e.g. 'internal' | 'pilot' | 'general' (free-form). */
  channel: string;
  /** Deployment environment, e.g. 'dev' | 'test' | 'prod' (optional). */
  environment?: string;
}

/**
 * A version's presence on one publication lane over a time window. A new
 * publication to the same lane closes the previous one (`effectiveUntil`),
 * so a lane always has at most one open publication.
 */
export interface Publication extends PublicationTarget {
  versionId: string;
  /** Lifecycle status this version holds *on this lane* (may differ per lane). */
  status: VersionStatus;
  effectiveFrom: string;
  effectiveUntil?: string;
  publishedBy: string;
}

/**
 * One registered version: its immutable version entity, a content snapshot
 * with a matching hash, an optional technical changelog, and its
 * publications across lanes.
 */
export interface RegistryEntry {
  version: BpmnVersion;
  /** Deep, immutable copy of the diagram content at registration. */
  snapshot: BpmnDiagram;
  /** SHA-256 of the snapshot content (verified on import). */
  snapshotHash: string;
  /** Technical changelog tied to the diff (complements `version.changeSummary`). */
  technicalNotes?: string;
  registeredAt: string;
  publications: Publication[];
}

/** Optional external persistence for registry entries (database, API, file…). */
export interface RegistrySink {
  write(entry: RegistryEntry): void | Promise<void>;
}

export interface RegisterOptions {
  /** Business-facing summary override; defaults to the version's changeSummary. */
  changeSummary?: string;
  /** Technical notes tied to the structural diff. */
  technicalNotes?: string;
}

export interface PublishOptions extends PublicationTarget {
  /** Status this version takes on the lane. Default 'active'. */
  status?: VersionStatus;
  /** ISO timestamp the publication takes effect. Default: now. */
  effectiveFrom?: string;
  publishedBy?: string;
}

/**
 * An immutable execution pin: the exact version an execution/delivery was
 * bound to. A run is born pinned; later version changes never mutate it —
 * this is a plain record the host stores alongside each run.
 */
export interface RunBinding {
  runId: string;
  versionId: string;
  semanticVersion: string;
  snapshotHash: string;
  channel?: string;
  environment?: string;
  boundAt: string;
}

export interface ExportedRegistry {
  entries: RegistryEntry[];
}
