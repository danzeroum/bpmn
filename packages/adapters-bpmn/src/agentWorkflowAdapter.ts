import { canonicalJson, sha256Hex } from '@buildtovalue/core';
import type { AgentWorkflow } from '@buildtovalue/agentflow';
import type {
  ArtifactAction,
  ArtifactAdapter,
  ArtifactDetail,
  ArtifactSummary,
  LifecycleStatus,
  VersionEntry,
} from '@buildtovalue/library';

/**
 * Agent Lane (Handoff 12 A-6) — the "AGENTE" Library artifact adapter.
 *
 * DECISION (pendencias §14): this is a BESPOKE adapter over the generic
 * `ArtifactAdapter` contract, NOT a `kindAdapter` wrapping the AgentWorkflow as
 * a pseudo-`BpmnDiagram`. `VersionRegistry` is hardcoded to `BpmnDiagram`
 * (snapshot type + `computeDiagramHash`), and forcing an AgentWorkflow through
 * it — plus `classifyDiagram`/diff/thumbnails — would be a TYPE lie: those
 * assume BPMN semantics the JSON graph does not have. The H6 `ArtifactAdapter`
 * contract exists precisely for non-BPMN artifacts (the Library is generic by
 * design); the agent is the first artifact that proves it. So the adapter keeps
 * its own version store as canonical JSON + hash and implements the contract
 * minimum. Read-only over an injected source; it never mutates.
 */

/** One stored version of an agent artifact (canonical-JSON + hash store). */
export interface AgentArtifactVersion {
  /** The versioned sub-workflow (carries id/version/name/autonomyLevel/graph). */
  workflow: AgentWorkflow;
  status: LifecycleStatus;
  /** ISO timestamp of the version, when known. */
  createdAt?: string;
  changeSummary?: string;
  author?: string;
  /** Ledger hash of the promotion, if the host recorded one. */
  ledgerHash?: string;
  /** The template this agent was instantiated from (card "templates de origem"). */
  originTemplate?: string;
}

/** Injected source of agent versions — the adapter never fetches or mutates. */
export type AgentArtifactSource = () => AgentArtifactVersion[];

export interface AgentWorkflowAdapterOptions {
  /** Adapter id; default `btv-agent`. */
  id?: string;
  /** Type label on chips/cards; default `AGENTE`. */
  typeLabel?: string;
  source: AgentArtifactSource;
  boundRuns?: (artifactId: string) => number;
}

/** ArtifactAdapter plus the host invalidation handle (§3 subscribe). */
export interface AgentArtifactAdapter extends ArtifactAdapter {
  notifyChanged(): void;
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

interface AgentGroup {
  id: string;
  /** Ascending by semantic version. */
  versions: AgentArtifactVersion[];
}

/** Groups source versions by agent id (`workflow.id`), ascending by semver. */
export function groupAgentVersions(source: AgentArtifactSource): AgentGroup[] {
  const groups = new Map<string, AgentArtifactVersion[]>();
  for (const version of source()) {
    const list = groups.get(version.workflow.id) ?? [];
    list.push(version);
    groups.set(version.workflow.id, list);
  }
  return [...groups.entries()].map(([id, versions]) => ({
    id,
    versions: versions.sort((x, y) => compareSemver(x.workflow.version, y.workflow.version)),
  }));
}

/** The relevant version an observer sees: the active one if present, else the
 * newest by semver (mirrors the registry adapter's "latest wins"). */
function relevant(group: AgentGroup): AgentArtifactVersion {
  const active = [...group.versions].reverse().find((v) => v.status === 'active');
  return active ?? group.versions[group.versions.length - 1];
}

function summaryOf(group: AgentGroup, id: string, typeLabel: string, boundRuns?: (id: string) => number): ArtifactSummary {
  const version = relevant(group);
  const wf = version.workflow;
  const runs = boundRuns?.(group.id);
  const summary: ArtifactSummary = {
    ref: { adapterId: id, artifactId: group.id },
    name: wf.name,
    typeLabel,
    version: wf.version,
    status: version.status,
    // autonomyLevel travels as TEXT — no new AI color anywhere (cerca §1.8).
    meta: `${wf.nodes.length} nós · ${wf.edges.length} arestas · autonomia ${wf.autonomyLevel}`,
    thumbnail: { kind: 'icon', icon: '🤖' },
  };
  if (version.createdAt) summary.updatedAt = version.createdAt;
  if (runs !== undefined) summary.boundRuns = runs;
  return summary;
}

function timelineOf(group: AgentGroup): VersionEntry[] {
  return group.versions
    .map((v) => {
      const entry: VersionEntry = { version: v.workflow.version, status: v.status };
      if (v.createdAt) entry.timestamp = v.createdAt;
      const note = v.originTemplate ? `template: ${v.originTemplate}` : v.changeSummary;
      if (note) entry.note = note;
      return entry;
    })
    .reverse(); // newest first
}

function actionsOf(artifactId: string, version: string): ArtifactAction[] {
  return [
    { id: 'open-studio', label: 'Abrir Agent Studio', kind: 'navigate', payload: { artifactId, version } },
    { id: 'diff-active', label: 'Diff vs versão ativa', kind: 'navigate', payload: { artifactId, version } },
  ];
}

/**
 * Builds the "AGENTE" adapter over an injected agent-version source.
 */
export function agentWorkflowAdapter(options: AgentWorkflowAdapterOptions): AgentArtifactAdapter {
  const { id = 'btv-agent', typeLabel = 'AGENTE', source, boundRuns } = options;
  const listeners = new Set<() => void>();

  return {
    id,
    typeLabel,
    async list() {
      return groupAgentVersions(source).map((group) => summaryOf(group, id, typeLabel, boundRuns));
    },
    async get(artifactId) {
      const group = groupAgentVersions(source).find((g) => g.id === artifactId);
      if (!group) throw new Error(`adapter "${id}": unknown agent "${artifactId}"`);
      const version = relevant(group);
      const wf = version.workflow;
      const detail: ArtifactDetail = {
        ...summaryOf(group, id, typeLabel, boundRuns),
        versions: timelineOf(group),
        actions: actionsOf(group.id, wf.version),
      };
      if (version.changeSummary) detail.changeSummary = version.changeSummary;
      detail.provenance = {
        // Canonical JSON + content hash (the store's identity, path 2).
        ledgerHash: version.ledgerHash ?? (await sha256Hex(canonicalJson(wf))),
        author: version.author ?? 'unknown',
        createdAt: version.createdAt ?? '',
      };
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
