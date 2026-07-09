import type { AuditEntry } from '@bpmn-react/core';

/**
 * Event categorization for the Ledger Explorer filter chips (Handoff 6 §6/§8
 * — "categorização de eventos p/ filtros (função pura no studio)"). The
 * ledger's `type` is a free string; there is no central enum in core, so the
 * studio owns this mapping.
 */
export type LedgerCategory =
  | 'promotion'
  | 'approval'
  | 'command'
  | 'verification'
  | 'simulation'
  | 'replay';

export const LEDGER_CATEGORIES: ReadonlyArray<{ id: LedgerCategory; label: string }> = [
  { id: 'promotion', label: 'Promoções' },
  { id: 'approval', label: 'Aprovações' },
  { id: 'command', label: 'Comandos' },
  { id: 'verification', label: 'Verificações' },
  { id: 'simulation', label: 'Simulações' },
  { id: 'replay', label: 'Replay' },
];

const PROMOTION_TYPES = new Set([
  'VERSION_ACTIVATED',
  'VERSION_ATTESTED',
  'VERSION_REGISTERED',
  'VERSION_PUBLISHED',
]);
const APPROVAL_TYPES = new Set(['APPROVAL_RECORDED', 'PROMOTION_REJECTED']);
// Registered simulation sessions (Handoff 7A-3) — their own chip/kind.
const SIMULATION_TYPES = new Set(['SIMULATION_SESSION']);
// Replay analyses attached to a promotion (Handoff 7B-3).
const REPLAY_TYPES = new Set(['REPLAY_ANALYSIS_ATTACHED']);

export function categorizeEntry(entry: Pick<AuditEntry, 'type'>): LedgerCategory {
  const base = entry.type.replace(/_(UNDONE|REDONE)$/, '');
  if (PROMOTION_TYPES.has(base)) return 'promotion';
  if (APPROVAL_TYPES.has(base)) return 'approval';
  if (SIMULATION_TYPES.has(base)) return 'simulation';
  if (REPLAY_TYPES.has(base)) return 'replay';
  if (base.startsWith('VERIFICATION') || base.startsWith('CHAIN_')) return 'verification';
  // NODE_*/EDGE_*/COMPOSITE/DIAGRAM_*/COMMAND and any unknown domain event:
  // editor commands are the ledger's default population.
  return 'command';
}

export interface LedgerFilter {
  categories?: LedgerCategory[];
  /** Matches entry.versionId OR details.artifactId. */
  artifactId?: string;
  /** ISO timestamps, inclusive start / exclusive end. */
  from?: string;
  until?: string;
}

function matchesContext(entry: AuditEntry, filter: LedgerFilter): boolean {
  if (filter.artifactId) {
    const byVersion = entry.versionId === filter.artifactId;
    const byArtifact = entry.details['artifactId'] === filter.artifactId;
    if (!byVersion && !byArtifact) return false;
  }
  if (filter.from && entry.timestamp < filter.from) return false;
  if (filter.until && entry.timestamp >= filter.until) return false;
  return true;
}

export interface FilteredLedger {
  entries: AuditEntry[];
  /** Chip counts over the context-filtered set (before category narrowing). */
  counts: Record<LedgerCategory, number> & { total: number };
}

/** Pure filter used by the trail AND by the XES export (§6/§10.5). */
export function filterEntries(entries: readonly AuditEntry[], filter: LedgerFilter = {}): FilteredLedger {
  const counts = { promotion: 0, approval: 0, command: 0, verification: 0, simulation: 0, replay: 0, total: 0 };
  const inContext = entries.filter((entry) => matchesContext(entry, filter));
  for (const entry of inContext) {
    counts[categorizeEntry(entry)] += 1;
    counts.total += 1;
  }
  const categories = filter.categories?.length ? new Set(filter.categories) : undefined;
  const filtered = categories
    ? inContext.filter((entry) => categories.has(categorizeEntry(entry)))
    : inContext;
  return { entries: filtered, counts };
}

/** Human line for the PAYLOAD block — generic, data-driven. */
export function describeEntry(entry: AuditEntry): string[] {
  const lines = Object.entries(entry.details).map(([key, value]) =>
    `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
  );
  return lines.length > 0 ? lines : ['(sem payload)'];
}
