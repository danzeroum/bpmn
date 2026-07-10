import {
  LIFECYCLE_STATUSES,
  type AdapterWarning,
  type ArtifactAction,
  type ArtifactAdapter,
  type ArtifactRef,
  type LibraryQuery,
  type LibrarySort,
  type LifecycleStatus,
} from '@buildtovalue/library';
import { SEAL_LABELS } from '@buildtovalue/react';
import { ArtifactCard } from './ArtifactCard.js';
import { ArtifactDrawer } from './ArtifactDrawer.js';
import { useLibrary } from './useLibrary.js';

export interface LibraryViewProps {
  /** The only source of artifacts — no prop knows concrete types (§4). */
  adapters: ArtifactAdapter[];
  /** The host resolves action descriptors (open in Designer, diff…) (§3.2). */
  onAction: (ref: ArtifactRef, action: ArtifactAction) => void;
  initialQuery?: LibraryQuery;
  /** Fired on every query change so the host can sync URL state (§10.7). */
  onQueryChange?: (query: LibraryQuery) => void;
  /** Restores a selection (deep link / back navigation — §10.7). */
  initialSelection?: ArtifactRef;
  /** Fired on every selection change so the host can sync URL state (§10.7). */
  onSelectionChange?: (ref: ArtifactRef | undefined) => void;
  onWarning?: (warning: AdapterWarning) => void;
}

const SORTS: Array<{ value: LibrarySort; label: string }> = [
  { value: 'name', label: 'nome' },
  { value: 'updated', label: 'atualização' },
  { value: 'status', label: 'status' },
];

/**
 * TELA 1 — Biblioteca (Handoff 6 §4, visual spec Handoff 3 §5): status chips
 * (fixed vocabulary), type chips (one per registered adapter — dynamic),
 * search, sortable card grid and the detail drawer. Read-only by
 * construction: the only outbound calls are `onAction` descriptors.
 */
export function LibraryView({
  adapters,
  onAction,
  initialQuery,
  onQueryChange,
  initialSelection,
  onSelectionChange,
  onWarning,
}: LibraryViewProps) {
  const library = useLibrary({
    adapters,
    ...(initialQuery ? { initialQuery } : {}),
    ...(onQueryChange ? { onQueryChange } : {}),
    ...(initialSelection ? { initialSelection } : {}),
    ...(onSelectionChange ? { onSelectionChange } : {}),
    ...(onWarning ? { onWarning } : {}),
  });
  const { query, setQuery, result, selected, select, detail } = library;

  const toggleStatus = (status: LifecycleStatus) => {
    const current = new Set(query.statuses ?? []);
    if (current.has(status)) current.delete(status);
    else current.add(status);
    setQuery({ ...query, statuses: [...current] });
  };
  const toggleAdapter = (adapterId: string) => {
    const current = new Set(query.adapterIds ?? []);
    if (current.has(adapterId)) current.delete(adapterId);
    else current.add(adapterId);
    setQuery({ ...query, adapterIds: [...current] });
  };

  const isSelected = (ref: ArtifactRef) =>
    selected?.adapterId === ref.adapterId && selected.artifactId === ref.artifactId;

  return (
    <div className="btv-lib" data-testid="library-view">
      <div className="btv-lib-filters" role="toolbar" aria-label="Filtros da biblioteca">
        <div className="btv-lib-chip-row" aria-label="Filtro por status">
          <button
            type="button"
            className="btv-lib-chip"
            aria-pressed={!query.statuses?.length}
            onClick={() => setQuery({ ...query, statuses: [] })}
          >
            Todos <span className="btv-lib-chip-count">{result?.counts.total ?? 0}</span>
          </button>
          {LIFECYCLE_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className="btv-lib-chip"
              data-status={status}
              aria-pressed={query.statuses?.includes(status) ?? false}
              onClick={() => toggleStatus(status)}
            >
              {SEAL_LABELS[status]}{' '}
              <span className="btv-lib-chip-count">{result?.counts.byStatus[status] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="btv-lib-chip-row" aria-label="Filtro por tipo">
          {library.adapters.map((adapter) => (
            <button
              key={adapter.id}
              type="button"
              className="btv-lib-chip btv-lib-chip-type"
              data-adapter={adapter.id}
              aria-pressed={query.adapterIds?.includes(adapter.id) ?? false}
              onClick={() => toggleAdapter(adapter.id)}
            >
              {adapter.typeLabel}{' '}
              <span className="btv-lib-chip-count">{result?.counts.byAdapter[adapter.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="btv-lib-tools">
          <input
            type="search"
            className="btv-lib-search"
            placeholder="Buscar…"
            aria-label="Buscar artefatos"
            value={query.text ?? ''}
            onChange={(e) => setQuery({ ...query, text: e.target.value })}
          />
          <label className="btv-lib-sort">
            ordenar:
            <select
              aria-label="Ordenação"
              value={query.sort ?? 'name'}
              onChange={(e) => setQuery({ ...query, sort: e.target.value as LibrarySort })}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="btv-lib-body">
        <div className="btv-lib-grid" role="list" aria-label="Artefatos">
          {result?.items.map((item) => (
            // role="listitem" satisfies the list's required-children contract
            // (a11y, N-8); display:contents keeps the card as the real grid item.
            <div
              key={`${item.ref.adapterId}:${item.ref.artifactId}`}
              role="listitem"
              style={{ display: 'contents' }}
            >
              <ArtifactCard
                item={item}
                selected={isSelected(item.ref)}
                onSelect={() => select(isSelected(item.ref) ? undefined : item.ref)}
              />
            </div>
          ))}
          {result && result.items.length === 0 && (
            <p className="btv-lib-empty">Nenhum artefato corresponde aos filtros.</p>
          )}
        </div>
        {detail && <ArtifactDrawer detail={detail} onAction={onAction} onClose={() => select(undefined)} />}
      </div>
    </div>
  );
}
