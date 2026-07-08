import type { BpmnNode } from '@bpmn-react/core';
import type { ArtifactDetail, ArtifactSummary } from '@bpmn-react/library';
import type { VersionRegistry } from '@bpmn-react/registry';
import {
  logicalArtifacts,
  relevantEntry,
  type LogicalArtifact,
  type ObserverTarget,
  type RegistryArtifactAdapter,
} from './registryAdapter.js';
import { decisionThumbnail } from './thumbnails.js';

/**
 * DMN decisions as catalog artifacts — "mais um adapter, nunca caso
 * especial" (Handoff 6 §1). A decision is a `dmn:decision` node inside a
 * registered diagram, versioned with it; the artifact id is
 * `<diagramId>::<nodeId>`.
 *
 * Deliberately duck-typed on the DMN vocabulary (`dmn:decision` +
 * `properties.decisionTable`) instead of importing @bpmn-react/dmn: the dmn
 * package bundles React components, and this adapter must stay headless.
 * When the npm-scope decision lands, this file can move into the dmn package
 * — the end state the handoff describes ("<scope>/dmn entrega seu próprio
 * adapter") — without any change to library/library-react.
 */

const DECISION_TYPE = 'dmn:decision';
const SEPARATOR = '::';

interface DecisionTableLike {
  hitPolicy?: string;
  rules?: unknown[];
}

function decisionTable(node: BpmnNode): DecisionTableLike | undefined {
  const table = node.properties['decisionTable'];
  return table && typeof table === 'object' ? (table as DecisionTableLike) : undefined;
}

function activeDecisions(artifact: LogicalArtifact, entryIndex: number): BpmnNode[] {
  const snapshot = artifact.entries[entryIndex].snapshot;
  return Object.values(snapshot.nodes).filter(
    (node) => node.type === DECISION_TYPE && !node.removedInVersion,
  );
}

export interface DmnDecisionAdapterOptions {
  target?: ObserverTarget;
  now?: () => string;
}

export function dmnDecisionAdapter(
  registry: VersionRegistry,
  options: DmnDecisionAdapterOptions = {},
): RegistryArtifactAdapter {
  const { target, now = () => new Date().toISOString() } = options;
  const listeners = new Set<() => void>();
  const id = 'dmn-decision';

  function decisions(): Array<{ artifact: LogicalArtifact; node: BpmnNode }> {
    const result: Array<{ artifact: LogicalArtifact; node: BpmnNode }> = [];
    for (const artifact of logicalArtifacts(registry)) {
      const { entry } = relevantEntry(artifact, target, now());
      const index = artifact.entries.indexOf(entry);
      for (const node of activeDecisions(artifact, index)) {
        result.push({ artifact, node });
      }
    }
    return result;
  }

  function toSummary(artifact: LogicalArtifact, node: BpmnNode): ArtifactSummary {
    const { entry, publication } = relevantEntry(artifact, target, now());
    const table = decisionTable(node);
    const rules = table?.rules?.length ?? 0;
    const summary: ArtifactSummary = {
      ref: { adapterId: id, artifactId: `${artifact.id}${SEPARATOR}${node.id}` },
      name: node.label || 'Decisão',
      typeLabel: 'DECISÃO',
      version: entry.version.semanticVersion,
      status: publication?.status ?? entry.version.status,
      meta: table ? `hit policy ${table.hitPolicy ?? 'U'} · ${rules} regras` : 'sem tabela de decisão',
      thumbnail: decisionThumbnail(rules),
      updatedAt: entry.version.createdAt,
    };
    const channel = publication?.channel ?? entry.publications[entry.publications.length - 1]?.channel;
    if (channel) summary.channel = channel;
    return summary;
  }

  const adapter: RegistryArtifactAdapter = {
    id,
    typeLabel: 'DECISÃO',
    async list() {
      return decisions().map(({ artifact, node }) => toSummary(artifact, node));
    },
    async get(artifactId) {
      const [diagramId, nodeId] = artifactId.split(SEPARATOR);
      const artifact = logicalArtifacts(registry).find((a) => a.id === diagramId);
      const { entry } = artifact
        ? relevantEntry(artifact, target, now())
        : { entry: undefined };
      const node = entry?.snapshot.nodes[nodeId ?? ''];
      if (!artifact || !node || node.type !== DECISION_TYPE || node.removedInVersion) {
        throw new Error(`adapter "${id}": unknown decision "${artifactId}"`);
      }
      const detail: ArtifactDetail = {
        ...toSummary(artifact, node),
        approvers: entry!.version.approvedBy.map((a) => a.userId),
        changeSummary: entry!.version.changeSummary,
        provenance: {
          ledgerHash: entry!.snapshotHash,
          author: entry!.version.createdBy,
          createdAt: entry!.version.createdAt,
        },
        // The decision is versioned with its containing diagram: the
        // timeline lists the diagram versions where this node exists.
        versions: artifact.entries
          .filter((e) => {
            const n = e.snapshot.nodes[node.id];
            return n !== undefined && !n.removedInVersion;
          })
          .map((e) => ({
            version: e.version.semanticVersion,
            status: e.version.status,
            timestamp: e.version.createdAt,
            note: e.version.changeSummary,
          }))
          .reverse(),
        actions: [
          {
            id: 'open-designer',
            label: 'Abrir no Designer',
            kind: 'navigate',
            payload: { artifactId: artifact.id, versionId: entry!.version.id, nodeId: node.id },
          },
        ],
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
  return adapter;
}
