import { useEffect, useMemo, useState } from 'react';
import {
  createLibraryCatalog,
  type AdapterWarning,
  type ArtifactAdapter,
  type ArtifactDetail,
  type ArtifactRef,
  type LibraryQuery,
  type LibraryResult,
} from '@bpmn-react/library';

export interface UseLibraryOptions {
  adapters: ArtifactAdapter[];
  initialQuery?: LibraryQuery;
  onQueryChange?: (query: LibraryQuery) => void;
  onWarning?: (warning: AdapterWarning) => void;
}

export interface UseLibraryState {
  query: LibraryQuery;
  setQuery: (next: LibraryQuery) => void;
  result: LibraryResult | undefined;
  selected: ArtifactRef | undefined;
  select: (ref: ArtifactRef | undefined) => void;
  detail: ArtifactDetail | undefined;
  adapters: readonly ArtifactAdapter[];
}

/**
 * The headless-to-React seam of the Biblioteca: query state, catalog results,
 * selection + drawer detail, and adapter invalidation (subscribe → reload).
 * All catalog logic lives in @bpmn-react/library; this hook only wires state.
 */
export function useLibrary(options: UseLibraryOptions): UseLibraryState {
  const { adapters, initialQuery, onQueryChange, onWarning } = options;
  // Adapters are wiring, not state: hosts pass a stable array.
  const catalog = useMemo(
    () => createLibraryCatalog(adapters, onWarning ? { onWarning } : {}),
    [adapters, onWarning],
  );
  const [query, setQueryState] = useState<LibraryQuery>(initialQuery ?? {});
  const [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<LibraryResult>();
  const [selected, setSelected] = useState<ArtifactRef>();
  const [detail, setDetail] = useState<ArtifactDetail>();

  useEffect(() => catalog.subscribe(() => setGeneration((g) => g + 1)), [catalog]);

  useEffect(() => {
    let alive = true;
    void catalog.list(query).then((next) => {
      if (alive) setResult(next);
    });
    return () => {
      alive = false;
    };
  }, [catalog, query, generation]);

  useEffect(() => {
    if (!selected) {
      setDetail(undefined);
      return;
    }
    let alive = true;
    void catalog
      .get(selected)
      .then((next) => {
        if (alive) setDetail(next);
      })
      .catch(() => {
        if (alive) setDetail(undefined);
      });
    return () => {
      alive = false;
    };
  }, [catalog, selected, generation]);

  const setQuery = (next: LibraryQuery) => {
    setQueryState(next);
    onQueryChange?.(next);
  };

  return {
    query,
    setQuery,
    result,
    selected,
    select: setSelected,
    detail,
    adapters: catalog.adapters,
  };
}
