import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactAdapter, ArtifactDetail, ArtifactSummary } from '@bpmn-react/library';
import { createRecipeAdapter } from '@bpmn-react/adapters-bpmn';
import { LibraryView } from '../src/index.js';

afterEach(cleanup);

/**
 * UI half of the acid test (Handoff 6 §10.1): the WHOLE Biblioteca — chips,
 * cards, drawer, timeline, actions — running exclusively on the fake
 * "recipe" adapter from S-2, with zero lines changed in library/library-react
 * for it. Plus generic-behavior tests on a minimal in-memory adapter.
 */

describe('LibraryView — acid test §10.1 (recipe adapter only)', () => {
  it('renders cards, dynamic type chip and live status counts', async () => {
    render(<LibraryView adapters={[createRecipeAdapter()]} onAction={() => {}} />);
    expect(await screen.findByText('Bolo de fubá cremoso')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /RECEITA/ })).not.toHaveLength(0);
    const activeChip = screen.getByRole('button', { name: /^ATIVA/ });
    expect(activeChip).toHaveTextContent('ATIVA 1');
    // every card carries the SAME canonical StatusBadge (§10.6)
    const badges = document.querySelectorAll('.bpmnr-status-badge[data-status]');
    expect(badges.length).toBeGreaterThanOrEqual(6);
  });

  it('filters by status chip and by search text', async () => {
    render(<LibraryView adapters={[createRecipeAdapter()]} onAction={() => {}} />);
    await screen.findByText('Bolo de fubá cremoso');
    fireEvent.click(screen.getByRole('button', { name: /^CANDIDATA/ }));
    await waitFor(() => {
      expect(screen.queryByText('Bolo de fubá cremoso')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Pão de queijo mineiro')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^CANDIDATA/ })); // clear
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'moqueca' } });
    await waitFor(() => {
      expect(screen.getByText('Moqueca capixaba')).toBeInTheDocument();
      expect(screen.queryByText('Pão de queijo mineiro')).not.toBeInTheDocument();
    });
  });

  it('opens the drawer with timeline and optional sections omitted (no "N/A")', async () => {
    render(<LibraryView adapters={[createRecipeAdapter()]} onAction={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Bolo de fubá cremoso/ }));
    expect(await screen.findByText('DETALHE · RECEITA')).toBeInTheDocument();
    expect(screen.getByText('VERSÕES')).toBeInTheDocument();
    // seal on the card + seal and timeline entry in the drawer
    expect(screen.getAllByText('v2.1.0').length).toBeGreaterThanOrEqual(2);
    // recipe provides no provenance/vigência → sections simply don't exist
    expect(screen.queryByText('PROVENIÊNCIA')).not.toBeInTheDocument();
    expect(screen.queryByText(/N\/A/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vigência/)).not.toBeInTheDocument();
  });

  it('routes action descriptors through onAction — the view mutates nothing', async () => {
    const onAction = vi.fn();
    render(<LibraryView adapters={[createRecipeAdapter()]} onAction={onAction} />);
    fireEvent.click(await screen.findByRole('button', { name: /Bolo de fubá cremoso/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir receita' }));
    expect(onAction).toHaveBeenCalledWith(
      { adapterId: 'recipe', artifactId: 'bolo-fuba' },
      expect.objectContaining({ id: 'open-recipe', kind: 'navigate' }),
    );
  });
});

function minimalAdapter(items: ArtifactSummary[]): ArtifactAdapter & { notify(): void } {
  const listeners = new Set<() => void>();
  return {
    id: items[0]?.ref.adapterId ?? 'mini',
    typeLabel: 'MINI',
    list: async () => items,
    get: async (id) => {
      const summary = items.find((i) => i.ref.artifactId === id)!;
      const detail: ArtifactDetail = { ...summary, versions: [], actions: [] };
      return detail;
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    notify() {
      for (const cb of listeners) cb();
    },
  };
}

function summary(id: string, name: string): ArtifactSummary {
  return {
    ref: { adapterId: 'mini', artifactId: id },
    name,
    typeLabel: 'MINI',
    version: '1.0.0',
    status: 'draft',
  };
}

describe('LibraryView — generic behavior', () => {
  it('reloads when the adapter notifies invalidation', async () => {
    const items = [summary('a', 'Primeiro')];
    const adapter = minimalAdapter(items);
    render(<LibraryView adapters={[adapter]} onAction={() => {}} />);
    await screen.findByText('Primeiro');
    items.push(summary('b', 'Segundo'));
    adapter.notify();
    expect(await screen.findByText('Segundo')).toBeInTheDocument();
  });

  it('applies initialQuery and reports query changes (URL-state seam, §10.7)', async () => {
    const onQueryChange = vi.fn();
    const adapter = minimalAdapter([summary('a', 'Alpha'), summary('b', 'Beta')]);
    render(
      <LibraryView
        adapters={[adapter]}
        onAction={() => {}}
        initialQuery={{ text: 'alpha' }}
        onQueryChange={onQueryChange}
      />,
    );
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('alpha');
    fireEvent.click(document.querySelector('.btv-lib-chip-type')!);
    expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ adapterIds: ['mini'] }));
  });

  it('shows the empty state when filters match nothing', async () => {
    const adapter = minimalAdapter([summary('a', 'Alpha')]);
    render(<LibraryView adapters={[adapter]} onAction={() => {}} initialQuery={{ text: 'zzz' }} />);
    expect(await screen.findByText('Nenhum artefato corresponde aos filtros.')).toBeInTheDocument();
  });

  it('toggling a card closes the drawer; ✕ closes too', async () => {
    const adapter = minimalAdapter([summary('a', 'Alpha')]);
    render(<LibraryView adapters={[adapter]} onAction={() => {}} />);
    const card = await screen.findByRole('button', { name: /Alpha/ });
    fireEvent.click(card);
    expect(await screen.findByText('DETALHE · MINI')).toBeInTheDocument();
    fireEvent.click(card);
    await waitFor(() => expect(screen.queryByText('DETALHE · MINI')).not.toBeInTheDocument());
    fireEvent.click(card);
    fireEvent.click(await screen.findByRole('button', { name: 'Fechar detalhe' }));
    await waitFor(() => expect(screen.queryByText('DETALHE · MINI')).not.toBeInTheDocument());
  });

  it('renders channel/runs chips, icon thumbnail and every drawer section when provided', async () => {
    const rich: ArtifactSummary = {
      ref: { adapterId: 'mini', artifactId: 'rich' },
      name: 'Completo',
      typeLabel: 'MINI',
      version: '3.0.0',
      status: 'active',
      channel: 'produção',
      boundRuns: 4,
      meta: 'linha livre',
      thumbnail: { kind: 'icon', icon: '🍲' },
    };
    const adapter = minimalAdapter([rich]);
    adapter.get = async () => ({
      ...rich,
      effectiveFrom: '2026-06-02T00:00:00.000Z',
      effectiveUntil: '2026-12-31T00:00:00.000Z',
      approvers: ['bruna', 'carla'],
      changeSummary: 'Mudança aprovada.',
      provenance: { ledgerHash: 'abc123', author: 'ana', createdAt: '2026-06-01T00:00:00.000Z' },
      versions: [{ version: '3.0.0', status: 'active', timestamp: '2026-06-01T00:00:00.000Z', note: 'atual' }],
      actions: [{ id: 'x', label: 'Ação', kind: 'download' as const }],
    });
    render(<LibraryView adapters={[adapter]} onAction={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Completo/ }));
    expect(await screen.findByText('PROVENIÊNCIA')).toBeInTheDocument();
    expect(screen.getByText('produção')).toBeInTheDocument();
    expect(screen.getByText('4 execuções presas')).toBeInTheDocument();
    expect(screen.getByText('🍲')).toBeInTheDocument();
    expect(screen.getByText(/Vigência:/).closest('p')).toHaveTextContent(
      'desde 02/06/2026 até 31/12/2026',
    );
    expect(screen.getByText(/Aprovação:/).closest('p')).toHaveTextContent('bruna, carla');
    expect(screen.getByText('Mudança aprovada.')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('deselects chips on second click and switches sort', async () => {
    const adapter = minimalAdapter([summary('a', 'Alpha'), summary('b', 'Beta')]);
    render(<LibraryView adapters={[adapter]} onAction={() => {}} />);
    await screen.findByText('Alpha');
    const draftChip = screen.getByRole('button', { name: /^RASCUNHO/ });
    fireEvent.click(draftChip);
    expect(draftChip).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(draftChip);
    expect(draftChip).toHaveAttribute('aria-pressed', 'false');
    const typeChip = document.querySelector('.btv-lib-chip-type')!;
    fireEvent.click(typeChip);
    fireEvent.click(typeChip);
    expect(typeChip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'updated' } });
    await screen.findByText('Alpha');
  });

  it('restores initialSelection and reports selection changes (§10.7)', async () => {
    const onSelectionChange = vi.fn();
    const adapter = minimalAdapter([summary('a', 'Alpha'), summary('b', 'Beta')]);
    render(
      <LibraryView
        adapters={[adapter]}
        onAction={() => {}}
        initialSelection={{ adapterId: 'mini', artifactId: 'b' }}
        onSelectionChange={onSelectionChange}
      />,
    );
    // the drawer opens straight away for the restored selection
    expect(await screen.findByText('DETALHE · MINI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Beta/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(onSelectionChange).toHaveBeenCalledWith({ adapterId: 'mini', artifactId: 'a' });
    fireEvent.click(await screen.findByRole('button', { name: 'Fechar detalhe' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(undefined);
  });

  it('surfaces adapter warnings through onWarning', async () => {
    const onWarning = vi.fn();
    const bad = { ...minimalAdapter([]), id: '' };
    render(<LibraryView adapters={[bad]} onAction={() => {}} onWarning={onWarning} />);
    await waitFor(() => expect(onWarning).toHaveBeenCalled());
  });
});
