import { registerAdapters, type AdapterWarning } from './adapters.js';
import {
  LIFECYCLE_STATUSES,
  type ArtifactAdapter,
  type ArtifactDetail,
  type ArtifactRef,
  type ArtifactSummary,
  type LibraryQuery,
  type LifecycleStatus,
} from './types.js';

export interface LibraryCounts {
  total: number;
  byStatus: Record<LifecycleStatus, number>;
  /** adapterId → count; every registered adapter has an entry (0 included). */
  byAdapter: Record<string, number>;
}

export interface LibraryResult {
  items: ArtifactSummary[];
  /**
   * Chip data: counted over the text-filtered set, BEFORE the status and
   * adapter narrowing, so each chip shows what selecting it would yield.
   */
  counts: LibraryCounts;
}

export interface LibraryCatalogOptions {
  onWarning?: (warning: AdapterWarning) => void;
}

export interface LibraryCatalog {
  /** Adapters that survived registration validation, in order. */
  adapters: readonly ArtifactAdapter[];
  list(query?: LibraryQuery): Promise<LibraryResult>;
  get(ref: ArtifactRef): Promise<ArtifactDetail>;
  /** Aggregates the adapters' optional subscribe hooks. */
  subscribe(cb: () => void): () => void;
}

const STATUS_ORDER = new Map<LifecycleStatus, number>(LIFECYCLE_STATUSES.map((s, i) => [s, i]));

function matchesText(item: ArtifactSummary, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (!needle) return true;
  return [item.name, item.typeLabel, item.meta ?? '']
    .some((field) => field.toLowerCase().includes(needle));
}

function byName(a: ArtifactSummary, b: ArtifactSummary): number {
  return a.name.localeCompare(b.name) || a.ref.artifactId.localeCompare(b.ref.artifactId);
}

function byUpdated(a: ArtifactSummary, b: ArtifactSummary): number {
  if (a.updatedAt && b.updatedAt && a.updatedAt !== b.updatedAt) {
    return a.updatedAt < b.updatedAt ? 1 : -1; // newest first
  }
  if (a.updatedAt && !b.updatedAt) return -1; // dated entries first
  if (!a.updatedAt && b.updatedAt) return 1;
  return byName(a, b);
}

function byStatus(a: ArtifactSummary, b: ArtifactSummary): number {
  return (STATUS_ORDER.get(a.status) ?? LIFECYCLE_STATUSES.length) -
    (STATUS_ORDER.get(b.status) ?? LIFECYCLE_STATUSES.length) || byName(a, b);
}

function emptyCounts(adapters: readonly ArtifactAdapter[]): LibraryCounts {
  const byStatusCount = Object.fromEntries(LIFECYCLE_STATUSES.map((s) => [s, 0])) as Record<
    LifecycleStatus,
    number
  >;
  const byAdapter = Object.fromEntries(adapters.map((a) => [a.id, 0]));
  return { total: 0, byStatus: byStatusCount, byAdapter };
}

/**
 * The headless catalog (Handoff 6 §1/§4): aggregates registered adapters and
 * implements search, status/type filtering, sorting and chip counts without
 * any DOM or knowledge of concrete artifact types. Read-only by construction
 * — there is no mutation path.
 */
export function createLibraryCatalog(
  adapters: readonly ArtifactAdapter[],
  options: LibraryCatalogOptions = {},
): LibraryCatalog {
  const warn = options.onWarning ?? (() => undefined);
  const registered = registerAdapters(adapters, { onWarning: warn });
  const byId = new Map(registered.map((a) => [a.id, a]));

  async function list(query: LibraryQuery = {}): Promise<LibraryResult> {
    const settled = await Promise.allSettled(registered.map((adapter) => adapter.list(query)));
    const aggregate: ArtifactSummary[] = [];
    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        aggregate.push(...result.value);
      } else {
        warn({
          adapterId: registered[i].id,
          message: `adapter list() failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        });
      }
    });

    const searched = query.text ? aggregate.filter((item) => matchesText(item, query.text!)) : aggregate;

    const counts = emptyCounts(registered);
    for (const item of searched) {
      counts.total += 1;
      counts.byStatus[item.status] += 1;
      if (item.ref.adapterId in counts.byAdapter) counts.byAdapter[item.ref.adapterId] += 1;
    }

    const statuses = query.statuses?.length ? new Set(query.statuses) : undefined;
    const adapterIds = query.adapterIds?.length ? new Set(query.adapterIds) : undefined;
    const items = searched.filter(
      (item) =>
        (!statuses || statuses.has(item.status)) &&
        (!adapterIds || adapterIds.has(item.ref.adapterId)),
    );

    const sort = query.sort ?? 'name';
    items.sort(sort === 'updated' ? byUpdated : sort === 'status' ? byStatus : byName);

    return { items, counts };
  }

  async function get(ref: ArtifactRef): Promise<ArtifactDetail> {
    const adapter = byId.get(ref.adapterId);
    if (!adapter) {
      throw new Error(`unknown adapter "${ref.adapterId}" — registered: ${[...byId.keys()].join(', ') || '(none)'}`);
    }
    return adapter.get(ref.artifactId);
  }

  function subscribe(cb: () => void): () => void {
    const unsubscribes = registered
      .filter((adapter) => typeof adapter.subscribe === 'function')
      .map((adapter) => adapter.subscribe!(cb));
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }

  return { adapters: registered, list, get, subscribe };
}
