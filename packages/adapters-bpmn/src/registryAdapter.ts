import { AdapterError } from './errors.js';
import type { BpmnDiagram, VersionStatus } from '@buildtovalue/core';
import type {
  ArtifactAction,
  ArtifactAdapter,
  ArtifactDetail,
  ArtifactSummary,
  LifecycleStatus,
  ThumbnailSpec,
  VersionEntry,
} from '@buildtovalue/library';
import type { Publication, RegistryEntry, VersionRegistry } from '@buildtovalue/registry';
import { diagramThumbnail } from './thumbnails.js';

/**
 * Observer target: when set, the summary reflects the version in effect on
 * that channel (Handoff 6 §3: "versão relevante ao canal do observador");
 * without it, the latest registered version wins.
 */
export interface ObserverTarget {
  channel: string;
  environment?: string;
}

export interface RegistryAdapterOptions {
  /** Unique adapter id ("bpmn-diagram", "btv-persona"…). */
  id: string;
  /** Free type label shown on chips/cards ("FLUXO", "PERSONA"…). */
  typeLabel: string;
  registry: VersionRegistry;
  /** Claims a logical artifact by inspecting its latest snapshot. */
  match?: (diagram: BpmnDiagram) => boolean;
  target?: ObserverTarget;
  /** ISO clock — injectable for tests; defaults to the real time. */
  now?: () => string;
  /** Pinned-run counter, provided by the host (the registry stores none). */
  boundRuns?: (artifactId: string) => number;
  thumbnail?: (diagram: BpmnDiagram) => ThumbnailSpec;
}

/** ArtifactAdapter plus the invalidation handle the host wires (§3 subscribe). */
export interface RegistryArtifactAdapter extends ArtifactAdapter {
  /** Call after register/publish so subscribed views refresh. */
  notifyChanged(): void;
}

/** All registered versions of one logical artifact (same snapshot.id). */
export interface LogicalArtifact {
  id: string;
  /** Ascending by version.createdAt. */
  entries: RegistryEntry[];
}

/** Groups registry entries by logical artifact (`entry.snapshot.id`). */
export function logicalArtifacts(registry: VersionRegistry): LogicalArtifact[] {
  const groups = new Map<string, RegistryEntry[]>();
  for (const entry of registry.list()) {
    const list = groups.get(entry.snapshot.id) ?? [];
    list.push(entry);
    groups.set(entry.snapshot.id, list);
  }
  return [...groups.entries()].map(([id, entries]) => ({
    id,
    entries: entries.sort((a, b) => a.version.createdAt.localeCompare(b.version.createdAt)),
  }));
}

function openPublicationAt(entry: RegistryEntry, target: ObserverTarget, at: string): Publication | undefined {
  return entry.publications.find(
    (p) =>
      p.channel === target.channel &&
      (target.environment === undefined || p.environment === target.environment) &&
      p.effectiveFrom <= at &&
      (p.effectiveUntil === undefined || at < p.effectiveUntil),
  );
}

/**
 * Picks the entry (and publication) the observer should see: with a target,
 * the version published on that lane at `at`; otherwise the newest version.
 */
export function relevantEntry(
  artifact: LogicalArtifact,
  target: ObserverTarget | undefined,
  at: string,
): { entry: RegistryEntry; publication?: Publication } {
  if (target) {
    for (let i = artifact.entries.length - 1; i >= 0; i--) {
      const entry = artifact.entries[i];
      const publication = openPublicationAt(entry, target, at);
      if (publication) return { entry, publication };
    }
  }
  return { entry: artifact.entries[artifact.entries.length - 1] };
}

/**
 * VersionStatus → the library's fixed six-state LifecycleStatus (V-0
 * decision 2, documented loss): `in-review` (§2e) maps to `candidate` — for
 * the Biblioteca it is still an unapproved candidate; the request-changes
 * nuance survives as the ⟲ seal in `meta` (see `toSummary`), never as a new
 * library state.
 */
export function toLifecycleStatus(status: VersionStatus): LifecycleStatus {
  return status === 'in-review' ? 'candidate' : status;
}

function versionTimeline(artifact: LogicalArtifact): VersionEntry[] {
  return artifact.entries
    .map((entry) => ({
      version: entry.version.semanticVersion,
      status: toLifecycleStatus(entry.version.status),
      timestamp: entry.version.createdAt,
      note: entry.version.changeSummary,
    }))
    .reverse(); // newest first
}

function defaultActions(artifactId: string, versionId: string): ArtifactAction[] {
  return [
    {
      id: 'open-designer',
      label: 'Abrir no Designer',
      kind: 'navigate',
      payload: { artifactId, versionId },
    },
    {
      id: 'diff-active',
      label: 'Diff vs versão ativa',
      kind: 'navigate',
      payload: { artifactId, versionId },
    },
  ];
}

/**
 * The generic bridge registry → library: every concrete adapter of this
 * package (flow, persona, prompt, connector, policy) is a thin configuration
 * of this factory. Read-only over the registry; mutations never happen here.
 */
export function createRegistryAdapter(options: RegistryAdapterOptions): RegistryArtifactAdapter {
  const {
    id,
    typeLabel,
    registry,
    match = () => true,
    target,
    now = () => new Date().toISOString(),
    boundRuns,
    thumbnail = diagramThumbnail,
  } = options;
  const listeners = new Set<() => void>();

  function matching(): LogicalArtifact[] {
    return logicalArtifacts(registry).filter((artifact) =>
      match(artifact.entries[artifact.entries.length - 1].snapshot),
    );
  }

  function toSummary(artifact: LogicalArtifact): ArtifactSummary {
    const { entry, publication } = relevantEntry(artifact, target, now());
    const snapshot = entry.snapshot;
    const runs = boundRuns?.(artifact.id);
    const nodes = Object.values(snapshot.nodes).filter((n) => !n.removedInVersion).length;
    const inReview = entry.version.status === 'in-review';
    const baseMeta = snapshot.description || `${nodes} nós`;
    const summary: ArtifactSummary = {
      ref: { adapterId: id, artifactId: artifact.id },
      name: snapshot.name,
      typeLabel,
      version: entry.version.semanticVersion,
      status: toLifecycleStatus(publication?.status ?? entry.version.status),
      // §2e gallery seal: the request-changes state survives the documented
      // status loss as the ⟲ marker in the meta line (V-0 decision 2).
      meta: inReview ? `⟲ EM REVISÃO · ${baseMeta}` : baseMeta,
      thumbnail: thumbnail(snapshot),
      updatedAt: entry.version.createdAt,
    };
    const channel = publication?.channel ?? entry.publications[entry.publications.length - 1]?.channel;
    if (channel) summary.channel = channel;
    if (runs !== undefined) summary.boundRuns = runs;
    return summary;
  }

  return {
    id,
    typeLabel,
    async list() {
      return matching().map(toSummary);
    },
    async get(artifactId) {
      const artifact = matching().find((a) => a.id === artifactId);
      if (!artifact) {
        throw new AdapterError(`adapter "${id}": unknown artifact "${artifactId}"`);
      }
      const { entry } = relevantEntry(artifact, target, now());
      const detail: ArtifactDetail = {
        ...toSummary(artifact),
        approvers: entry.version.approvedBy.map((a) => a.userId),
        changeSummary: entry.version.changeSummary,
        provenance: {
          ledgerHash: entry.snapshotHash,
          author: entry.version.createdBy,
          createdAt: entry.version.createdAt,
        },
        versions: versionTimeline(artifact),
        actions: defaultActions(artifact.id, entry.version.id),
      };
      if (entry.version.effectiveFrom) detail.effectiveFrom = entry.version.effectiveFrom;
      if (entry.version.effectiveUntil) detail.effectiveUntil = entry.version.effectiveUntil;
      return detail;
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    notifyChanged() {
      for (const cb of listeners) cb();
    },
  };
}
