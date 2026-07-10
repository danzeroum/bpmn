import { activeNodes, type BpmnDiagram } from '@buildtovalue/core';

/**
 * The catalog kinds a registered diagram can embody. "policy" maps to the
 * BuildToValue Approval Gate (`btv:gate`) — the closest existing concept;
 * there is no dedicated policy node type today (see pendencias.md, Handoff 6).
 */
export type BtvArtifactKind = 'flow' | 'persona' | 'prompt' | 'connector' | 'policy';

export const BTV_ARTIFACT_KINDS: readonly BtvArtifactKind[] = [
  'flow',
  'persona',
  'prompt',
  'connector',
  'policy',
];

/** Node type → kind, for the heuristic fallback. */
const NODE_KIND: Record<string, Exclude<BtvArtifactKind, 'flow'>> = {
  'btv:persona': 'persona',
  'btv:prompt': 'prompt',
  'btv:connector': 'connector',
  'btv:gate': 'policy',
};

const METADATA_ALIASES: Record<string, BtvArtifactKind> = {
  flow: 'flow',
  fluxo: 'flow',
  persona: 'persona',
  prompt: 'prompt',
  connector: 'connector',
  conector: 'connector',
  policy: 'policy',
  politica: 'policy',
  política: 'policy',
};

/**
 * Classifies a registered diagram into a catalog kind:
 * 1. Explicit `diagram.metadata.artifactType` wins (documented convention of
 *    this package; accepts pt/en aliases).
 * 2. Heuristic: when every active node shares a single mapped `btv:` type,
 *    the diagram IS that artifact (a persona/prompt/connector/policy
 *    definition registered as its own versioned diagram).
 * 3. Everything else is a flow.
 */
export function classifyDiagram(diagram: BpmnDiagram): BtvArtifactKind {
  const declared = diagram.metadata['artifactType'];
  if (typeof declared === 'string') {
    const kind = METADATA_ALIASES[declared.trim().toLowerCase()];
    if (kind) return kind;
  }
  const nodes = activeNodes(diagram);
  if (nodes.length > 0) {
    const kinds = new Set(nodes.map((node) => NODE_KIND[node.type]));
    if (kinds.size === 1) {
      const [kind] = kinds;
      if (kind) return kind;
    }
  }
  return 'flow';
}
