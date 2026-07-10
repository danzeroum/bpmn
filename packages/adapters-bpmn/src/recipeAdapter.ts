import type {
  ArtifactAdapter,
  ArtifactDetail,
  ArtifactSummary,
  LifecycleStatus,
} from '@buildtovalue/library';

/**
 * The acid-test fixture (Handoff 6 §1/§9-S2/§10.1): a fake adapter for
 * cooking recipes — an artifact with NO relation to BPMN whatsoever. It
 * imports ONLY from @buildtovalue/library. If the whole Biblioteca works with
 * this adapter alone, without touching library/library-react, the generic
 * architecture holds; any violation is an architecture bug.
 *
 * Exported (not test-only) so S-3/S-6 can reuse it in UI acid tests and the
 * demo. Covers all six lifecycle states.
 */

interface Recipe {
  id: string;
  name: string;
  status: LifecycleStatus;
  version: string;
  servings: number;
  updatedAt: string;
  changeSummary: string;
  history: Array<{ version: string; status: LifecycleStatus; timestamp: string; note: string }>;
}

const RECIPES: Recipe[] = [
  {
    id: 'bolo-fuba',
    name: 'Bolo de fubá cremoso',
    status: 'active',
    version: '2.1.0',
    servings: 12,
    updatedAt: '2026-06-20T09:00:00Z',
    changeSummary: 'Reduzido o açúcar em 15% após degustação com a equipe.',
    history: [
      { version: '2.1.0', status: 'active', timestamp: '2026-06-20T09:00:00Z', note: 'Menos açúcar.' },
      { version: '2.0.0', status: 'deprecated', timestamp: '2026-04-02T09:00:00Z', note: 'Versão cremosa.' },
      { version: '1.0.0', status: 'retired', timestamp: '2025-11-10T09:00:00Z', note: 'Receita original.' },
    ],
  },
  {
    id: 'pao-queijo',
    name: 'Pão de queijo mineiro',
    status: 'candidate',
    version: '1.2.0',
    servings: 30,
    updatedAt: '2026-07-01T14:30:00Z',
    changeSummary: 'Meia cura substitui o parmesão; aguardando aprovação da banca.',
    history: [
      { version: '1.2.0', status: 'candidate', timestamp: '2026-07-01T14:30:00Z', note: 'Queijo meia cura.' },
      { version: '1.1.0', status: 'active', timestamp: '2026-05-15T14:30:00Z', note: 'Polvilho azedo.' },
    ],
  },
  {
    id: 'canja',
    name: 'Canja de galinha',
    status: 'test',
    version: '0.3.0',
    servings: 6,
    updatedAt: '2026-06-28T18:00:00Z',
    changeSummary: 'Teste interno com arroz arbóreo.',
    history: [{ version: '0.3.0', status: 'test', timestamp: '2026-06-28T18:00:00Z', note: 'Arroz arbóreo.' }],
  },
  {
    id: 'moqueca',
    name: 'Moqueca capixaba',
    status: 'draft',
    version: '0.1.0',
    servings: 8,
    updatedAt: '2026-07-05T11:00:00Z',
    changeSummary: 'Rascunho inicial — falta definir o urucum.',
    history: [{ version: '0.1.0', status: 'draft', timestamp: '2026-07-05T11:00:00Z', note: 'Rascunho.' }],
  },
  {
    id: 'cuscuz',
    name: 'Cuscuz paulista',
    status: 'deprecated',
    version: '3.0.0',
    servings: 10,
    updatedAt: '2026-02-11T08:00:00Z',
    changeSummary: 'Substituída pela versão nordestina no cardápio.',
    history: [{ version: '3.0.0', status: 'deprecated', timestamp: '2026-02-11T08:00:00Z', note: 'Descontinuada.' }],
  },
  {
    id: 'pudim',
    name: 'Pudim de leite condensado',
    status: 'retired',
    version: '1.0.0',
    servings: 12,
    updatedAt: '2025-09-01T10:00:00Z',
    changeSummary: 'Arquivada: saiu do cardápio de inverno.',
    history: [{ version: '1.0.0', status: 'retired', timestamp: '2025-09-01T10:00:00Z', note: 'Arquivada.' }],
  },
];

const POT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" role="img" aria-hidden="true">' +
  '<ellipse cx="48" cy="30" rx="30" ry="7" fill="none" stroke="#44403a" stroke-width="1.5"/>' +
  '<path d="M 18 30 V 52 Q 18 62 30 62 H 66 Q 78 62 78 52 V 30" fill="none" stroke="#44403a" stroke-width="1.5"/>' +
  '<path d="M 38 20 Q 40 14 38 10 M 48 20 Q 50 14 48 10 M 58 20 Q 60 14 58 10" fill="none" stroke="#9a7b1e" stroke-width="1.5"/>' +
  '</svg>';

export interface RecipeAdapter extends ArtifactAdapter {
  /** Fires subscribers — lets tests exercise the invalidation path. */
  notifyChanged(): void;
}

export function createRecipeAdapter(): RecipeAdapter {
  const listeners = new Set<() => void>();

  function toSummary(recipe: Recipe): ArtifactSummary {
    return {
      ref: { adapterId: 'recipe', artifactId: recipe.id },
      name: recipe.name,
      typeLabel: 'RECEITA',
      version: recipe.version,
      status: recipe.status,
      meta: `rende ${recipe.servings} porções`,
      thumbnail: { kind: 'svg', svg: POT_SVG },
      updatedAt: recipe.updatedAt,
    };
  }

  return {
    id: 'recipe',
    typeLabel: 'RECEITA',
    async list() {
      return RECIPES.map(toSummary);
    },
    async get(artifactId) {
      const recipe = RECIPES.find((r) => r.id === artifactId);
      if (!recipe) throw new Error(`adapter "recipe": unknown recipe "${artifactId}"`);
      const detail: ArtifactDetail = {
        ...toSummary(recipe),
        changeSummary: recipe.changeSummary,
        versions: recipe.history.map((h) => ({ ...h })),
        actions: [
          { id: 'open-recipe', label: 'Abrir receita', kind: 'navigate', payload: { artifactId } },
          { id: 'download-pdf', label: 'Baixar PDF', kind: 'download', href: `/recipes/${artifactId}.pdf` },
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
}
