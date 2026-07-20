import type { Messages } from '../messages.js';

/**
 * Biblioteca dictionary fragment (#151). The `@buildtovalue/library-react`
 * surfaces (LibraryView / ArtifactCard / ArtifactDrawer) resolve their UI
 * strings against these keys — same contract as every other surface: host
 * injects `messages` (or an ancestor `<I18nProvider>`), English is the
 * embedded per-key fallback. Keys are namespaced by surface (`library.*`);
 * plural pairs use `_one` / `_other`.
 */
export const library: { en: Messages; ptBR: Messages } = {
  en: {
    'library.filters.aria': 'Library filters',
    'library.filters.statusAria': 'Filter by status',
    'library.filters.all': 'All',
    'library.filters.typeAria': 'Filter by type',
    'library.search.placeholder': 'Search…',
    'library.search.aria': 'Search artifacts',
    'library.sort.label': 'sort:',
    'library.sort.aria': 'Sort order',
    'library.sort.name': 'name',
    'library.sort.updated': 'updated',
    'library.sort.status': 'status',
    'library.grid.aria': 'Artifacts',
    'library.empty': 'No artifact matches the filters.',
    'library.card.boundRuns_one': '{count} pinned run',
    'library.card.boundRuns_other': '{count} pinned runs',
    'library.drawer.aria': 'Artifact detail {name}',
    'library.drawer.kicker': 'DETAIL · {type}',
    'library.drawer.closeAria': 'Close detail',
    'library.drawer.effective': 'Effective:',
    'library.drawer.effectiveSince': 'since {date}',
    'library.drawer.effectiveUntil': 'until {date}',
    'library.drawer.approval': 'Approval:',
    'library.drawer.provenance': 'PROVENANCE',
    'library.drawer.versions': 'VERSIONS',
  },
  ptBR: {
    'library.filters.aria': 'Filtros da biblioteca',
    'library.filters.statusAria': 'Filtro por status',
    'library.filters.all': 'Todos',
    'library.filters.typeAria': 'Filtro por tipo',
    'library.search.placeholder': 'Buscar…',
    'library.search.aria': 'Buscar artefatos',
    'library.sort.label': 'ordenar:',
    'library.sort.aria': 'Ordenação',
    'library.sort.name': 'nome',
    'library.sort.updated': 'atualização',
    'library.sort.status': 'status',
    'library.grid.aria': 'Artefatos',
    'library.empty': 'Nenhum artefato corresponde aos filtros.',
    'library.card.boundRuns_one': '{count} execução presa',
    'library.card.boundRuns_other': '{count} execuções presas',
    'library.drawer.aria': 'Detalhe do artefato {name}',
    'library.drawer.kicker': 'DETALHE · {type}',
    'library.drawer.closeAria': 'Fechar detalhe',
    'library.drawer.effective': 'Vigência:',
    'library.drawer.effectiveSince': 'desde {date}',
    'library.drawer.effectiveUntil': 'até {date}',
    'library.drawer.approval': 'Aprovação:',
    'library.drawer.provenance': 'PROVENIÊNCIA',
    'library.drawer.versions': 'VERSÕES',
  },
};
