import type { AggregatedLog } from './types.js';

/**
 * A serializable governance summary of a replay (Handoff 7B-3): the real
 * bottleneck, fitness and the top deviation for one version, plus a
 * ready-to-render `headline`. Neutral JSON — the host attaches it to a
 * promotion request and writes it to the ledger by injection; `@bpmn-react/
 * replay` never imports audit/registry.
 */
export interface ReplayAnalysis {
  diagramId: string;
  versionId: string;
  semanticVersion: string;
  totalCases: number;
  /** Token-replay fitness, 0–1. */
  fitness: number;
  bottleneck?: { nodeId: string; label: string; avgMs: number };
  topDeviation?: { from: string; to: string; label: string; cases: number; share: number };
  /** Candidate version this analysis argues for, if any. */
  candidateSemanticVersion?: string;
  author: string;
  timestamp: string;
  /** Human one-liner for the comparison card / review block. */
  headline: string;
}

export interface SummarizeOptions {
  diagramId: string;
  versionId: string;
  semanticVersion: string;
  author: string;
  /** ISO-8601, supplied by the host — the package never reads a clock. */
  timestamp: string;
  /** Node id → label (injected; the graph carries only ids). */
  label: (nodeId: string) => string;
  /** Duration formatter (injected so this package stays presentation-free). */
  formatMs: (ms: number) => string;
  candidateSemanticVersion?: string;
  /** What the candidate changes (its change summary), for the headline. */
  candidateChange?: string;
}

/** Resolves a deviation endpoint id (`?activity` for unmapped) to a label. */
function endpoint(id: string, label: (id: string) => string): string {
  return id.startsWith('?') ? id.slice(1) : label(id);
}

/**
 * Builds a {@link ReplayAnalysis} from an aggregated log. The bottleneck is the
 * slowest node (`bottleneckNodeId`); the top deviation is the most frequent one.
 * The headline reads "O gargalo real da vX é … — a vY ataca isso: …" when a
 * candidate change is supplied.
 */
export function summarizeReplay(log: AggregatedLog, options: SummarizeOptions): ReplayAnalysis {
  const { label, formatMs, semanticVersion } = options;

  let bottleneck: ReplayAnalysis['bottleneck'];
  if (log.bottleneckNodeId) {
    const stat = log.nodes.find((n) => n.nodeId === log.bottleneckNodeId);
    if (stat?.avgMs !== undefined) {
      bottleneck = { nodeId: stat.nodeId, label: label(stat.nodeId), avgMs: stat.avgMs };
    }
  }

  let topDeviation: ReplayAnalysis['topDeviation'];
  const dev = log.deviations[0];
  if (dev) {
    topDeviation = {
      from: dev.from,
      to: dev.to,
      label: `${endpoint(dev.from, label)} → ${endpoint(dev.to, label)}`,
      cases: dev.cases,
      share: log.totalCases > 0 ? dev.cases / log.totalCases : 0,
    };
  }

  const base = bottleneck
    ? `O gargalo real da v${semanticVersion} é "${bottleneck.label}" (⌀ ${formatMs(bottleneck.avgMs)})`
    : `A v${semanticVersion} tem fitness ${(log.fitness.fitness * 100).toFixed(1).replace('.', ',')}%`;
  const devPart = topDeviation
    ? ` · ${topDeviation.cases} casos desviam em "${topDeviation.label}"`
    : '';
  const candidatePart =
    options.candidateSemanticVersion && options.candidateChange
      ? ` — a v${options.candidateSemanticVersion} ataca isso: ${options.candidateChange}`
      : '';

  return {
    diagramId: options.diagramId,
    versionId: options.versionId,
    semanticVersion,
    totalCases: log.totalCases,
    fitness: log.fitness.fitness,
    ...(bottleneck ? { bottleneck } : {}),
    ...(topDeviation ? { topDeviation } : {}),
    ...(options.candidateSemanticVersion ? { candidateSemanticVersion: options.candidateSemanticVersion } : {}),
    author: options.author,
    timestamp: options.timestamp,
    headline: base + devPart + candidatePart,
  };
}
