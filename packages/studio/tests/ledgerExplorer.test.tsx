import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditLedger } from '@buildtovalue/core';
import { anchorRecordedEntry } from '@buildtovalue/audit';
import { I18nProvider, PT_BR } from '@buildtovalue/react';
import { categorizeEntry, LedgerExplorer } from '../src/index.js';

/** Wrap every render in the Brazilian-Portuguese dictionary (Handoff 11 N-6). */
const render = (ui: ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <I18nProvider messages={PT_BR}>{children}</I18nProvider> });

afterEach(cleanup);

async function seededLedger(): Promise<AuditLedger> {
  const ledger = new AuditLedger();
  await ledger.append({ type: 'NODE_ADDED', userId: 'ana', versionId: 'onb-v2', details: { nodeId: 'auto', artifactId: 'onboarding' } });
  await ledger.append({ type: 'APPROVAL_RECORDED', userId: 'bruna', versionId: 'onb-v2', details: { role: 'process-owner', artifactId: 'onboarding' } });
  await ledger.append({ type: 'VERSION_ACTIVATED', userId: 'ana', versionId: 'onb-v2', details: { artifactId: 'onboarding' } });
  await ledger.append({
    type: 'VERSION_ATTESTED',
    userId: 'ana',
    versionId: 'onb-v2',
    details: {
      artifactId: 'onboarding',
      xmlHash: 'aaa111',
      ledgerHeadHash: 'bbb222',
      effectiveFrom: '2026-07-10T00:00:00.000Z',
      approvers: [{ userId: 'carla' }, { userId: 'bruna' }],
    },
  });
  return ledger;
}

describe('LedgerExplorer — TELA 3 (§6)', () => {
  it('renders the trail with category chips and live counts', async () => {
    render(<LedgerExplorer ledger={await seededLedger()} />);
    expect(screen.getByRole('button', { name: 'Todos 4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Promoções 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprovações 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comandos 1' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('category chip narrows the trail; XES export honours the SAME filter (§10.5)', async () => {
    const onDownload = vi.fn();
    render(<LedgerExplorer ledger={await seededLedger()} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Promoções 2' }));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar XES' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    const [filename, content, mime] = onDownload.mock.calls[0] as [string, string, string];
    expect(filename).toBe('ledger-export.xes');
    expect(mime).toBe('application/xml');
    expect(content).toContain('VERSION_ACTIVATED');
    expect(content).not.toContain('NODE_ADDED'); // filtered out
  });

  it('Verificar cadeia: green banner with n/n, head hash and report download', async () => {
    const onDownload = vi.fn();
    const ledger = await seededLedger();
    render(<LedgerExplorer ledger={ledger} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar cadeia' }));
    expect(await screen.findByText('Cadeia íntegra (4/4)')).toBeInTheDocument();
    const head = ledger.getEntries()[3].hash;
    expect(screen.getByText(`head ${head}`)).toBeInTheDocument();
    expect(screen.getByText(/SHA-256/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'baixar VerificationReport.json' }));
    const [filename, content] = onDownload.mock.calls[0] as [string, string];
    expect(filename).toBe('VerificationReport.json');
    expect(JSON.parse(content)).toMatchObject({ intact: true, entries: 4 });
  });

  it('a tampered chain: red banner with the exact index; later entries untrusted (§10.5)', async () => {
    const ledger = await seededLedger();
    const tampered = ledger.export();
    tampered.entries[1].details = { forged: true }; // 1 byte seria suficiente; o hash diverge igual
    render(<LedgerExplorer ledger={tampered} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar cadeia' }));
    expect(await screen.findByText('Cadeia quebrada na entrada 1')).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options[0]).not.toHaveAttribute('data-untrusted');
    expect(options[1]).toHaveAttribute('data-untrusted');
    expect(options[2]).toHaveAttribute('data-untrusted');
    expect(options[3]).toHaveAttribute('data-untrusted');
    // detail of an untrusted entry says so
    fireEvent.click(options[1]);
    expect(screen.getByTestId('entry-trust')).toHaveTextContent('não-confiável ✕');
  });

  it('detail block: index/hash/prev visible chaining and attestation on activation entries', async () => {
    const onDownload = vi.fn();
    const ledger = await seededLedger();
    render(<LedgerExplorer ledger={ledger} onDownload={onDownload} />);
    const options = screen.getAllByRole('option');
    fireEvent.click(options[3]); // VERSION_ATTESTED
    const entries = ledger.getEntries();
    expect(screen.getByText(`hash: ${entries[3].hash}`)).toBeInTheDocument();
    expect(screen.getByText(`prev: ${entries[2].hash}`)).toBeInTheDocument();
    expect(screen.getByText('ATTESTATION')).toBeInTheDocument();
    // in the PAYLOAD block and again in the gold ATTESTATION block
    expect(screen.getAllByText('xmlHash: aaa111')).toHaveLength(2);
    expect(screen.getByText('aprovadores: carla, bruna')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'baixar attestation.json' }));
    expect(onDownload.mock.calls[0][0]).toBe('attestation.json');
    // genesis entry shows the (gênese) prev
    fireEvent.click(options[0]);
    expect(screen.getByText('prev: (gênese)')).toBeInTheDocument();
    expect(screen.queryByText('ATTESTATION')).not.toBeInTheDocument();
    expect(screen.getByTestId('entry-trust')).toHaveTextContent('não verificada');
  });

  it('actions route to the host; artifact context chip is removable', async () => {
    const onAction = vi.fn();
    render(<LedgerExplorer ledger={await seededLedger()} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver diff desta mudança' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'diff' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir versão no Designer (leitura)' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'open-designer' }));
    fireEvent.click(screen.getByRole('button', { name: 'filtrar por este artefato' }));
    const chip = await screen.findByRole('button', { name: /artefato: onboarding ✕/ });
    fireEvent.click(chip);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /artefato: onboarding/ })).not.toBeInTheDocument(),
    );
  });

  it('trail is keyboard-navigable with arrows (§10.8)', async () => {
    render(<LedgerExplorer ledger={await seededLedger()} />);
    const trail = screen.getByRole('listbox');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(trail, { key: 'ArrowDown' });
    await waitFor(() =>
      expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true'),
    );
    fireEvent.keyDown(trail, { key: 'ArrowUp' });
    await waitFor(() =>
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true'),
    );
  });

  it('empty filters show the empty message', async () => {
    const ledger = new AuditLedger();
    render(<LedgerExplorer ledger={ledger} />);
    expect(screen.getByText('Nenhum evento nos filtros atuais.')).toBeInTheDocument();
  });
});

describe('LedgerExplorer — C6 consulta com citações (Handoff 9 CP-4)', () => {
  it('answer renders with citation chips; clicking a citation OPENS the entry', async () => {
    const ledger = await seededLedger();
    const approval = ledger.getEntries().find((e) => e.type === 'APPROVAL_RECORDED')!;
    const query = vi.fn(async () =>
      JSON.stringify({ answer: 'bruna aprovou a onb-v2.', citations: [approval.hash] }),
    );
    render(<LedgerExplorer ledger={ledger} query={query} />);

    fireEvent.change(screen.getByTestId('ledger-query-input'), {
      target: { value: 'quem aprovou a onb-v2?' },
    });
    fireEvent.click(screen.getByTestId('ledger-query-ask'));

    const answer = await screen.findByTestId('ledger-query-answer');
    expect(answer.textContent).toContain('bruna aprovou a onb-v2.');
    const citation = screen.getByTestId('ledger-query-citation');
    expect(citation.textContent).toContain(`#${approval.hash.slice(0, 12)}`);
    expect(citation.textContent).toContain('APPROVAL_RECORDED');

    fireEvent.click(citation);
    await waitFor(() => {
      const selected = screen
        .getAllByRole('option')
        .find((option) => option.getAttribute('aria-selected') === 'true');
      expect(selected?.textContent).toContain('APPROVAL_RECORDED');
    });
    // Read-only como a C3: a consulta não gera NENHUMA trilha.
    expect(ledger.getEntries()).toHaveLength(4);
  });

  it('no citable entry → "não encontrei registro", the invented answer is NEVER shown', async () => {
    const ledger = await seededLedger();
    const query = vi.fn(async () =>
      JSON.stringify({ answer: 'A v9.9.9 foi aprovada por fulano.', citations: ['f'.repeat(64)] }),
    );
    render(<LedgerExplorer ledger={ledger} query={query} />);

    fireEvent.change(screen.getByTestId('ledger-query-input'), {
      target: { value: 'quem aprovou a v9.9.9?' },
    });
    fireEvent.click(screen.getByTestId('ledger-query-ask'));

    const norecord = await screen.findByTestId('ledger-query-norecord');
    expect(norecord.textContent).toContain('não encontrei registro');
    expect(norecord.textContent).toContain('não corresponde a nenhuma entrada');
    expect(screen.queryByTestId('ledger-query-answer')).not.toBeInTheDocument();
    expect(screen.queryByText(/fulano/)).not.toBeInTheDocument();
    expect(ledger.getEntries()).toHaveLength(4);
  });

  it('a provider failure degrades to "não encontrei registro" (never a crash)', async () => {
    const ledger = await seededLedger();
    const query = vi.fn(async () => {
      throw new Error('provider indisponível');
    });
    render(<LedgerExplorer ledger={ledger} query={query} />);
    fireEvent.change(screen.getByTestId('ledger-query-input'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('ledger-query-ask'));
    const norecord = await screen.findByTestId('ledger-query-norecord');
    expect(norecord.textContent).toContain('provider indisponível');
  });

  it('without the query prop the box is absent — zero regression', async () => {
    render(<LedgerExplorer ledger={await seededLedger()} />);
    expect(screen.queryByTestId('ledger-query')).not.toBeInTheDocument();
  });
});

describe('LedgerExplorer — selo de autoria de IA (Handoff 9 §8.2)', () => {
  it('entries authored (or co-authored) by the copilot carry the ✦ seal; human ones do not', async () => {
    const ledger = await seededLedger(); // 4 human entries
    await ledger.append({
      type: 'COPILOT_PROPOSAL_APPLIED',
      userId: 'ana',
      versionId: 'onb-v2',
      details: {
        author: 'ia.copilot@claude-4',
        promptTemplateRef: { id: 'copilot-draft', version: '1.0.0' },
      },
    });
    await ledger.append({
      type: 'VERSION_ACTIVATED',
      userId: 'ana',
      versionId: 'onb-v3',
      details: {
        semanticVersion: '3.0.0',
        changeSummaryOrigin: {
          author: 'ia.copilot@claude-4',
          promptTemplateRef: { id: 'copilot-summary', version: '1.0.0' },
          edited: true,
        },
      },
    });
    render(<LedgerExplorer ledger={ledger} />);
    // Exactly the two AI-touched entries carry the seal — direct authorship
    // (C1/C2/C5) and text co-authorship (C4); the 4 human entries do not.
    const seals = screen.getAllByTestId('ledger-ai-seal');
    expect(seals).toHaveLength(2);
    for (const seal of seals) expect(seal.textContent).toContain('✦ ia.copilot@claude-4');
  });
});

describe('LedgerExplorer — banner CADEIA ≠ ÂNCORA (Handoff 11 N-4)', () => {
  const receiptFor = (hash: string, seq: number) => ({
    adapterId: 'git',
    head: { hash, seq },
    proof: 'commit-abc',
    anchoredAt: '2026-07-01T00:00:00.000Z',
  });
  const fakeAdapter = (verdict: 'anchored' | 'mismatch' | 'unavailable') => ({
    id: 'git',
    anchor: vi.fn(async (head: { hash: string; seq: number }) => receiptFor(head.hash, head.seq)),
    verify: vi.fn(async () => verdict),
  });

  it('estado 1 — íntegra E ancorada: dois banners independentes, ambos verdes', async () => {
    const ledger = await seededLedger();
    const head = ledger.getEntries()[3];
    render(
      <LedgerExplorer
        ledger={ledger}
        anchor={{ adapter: fakeAdapter('anchored'), receipt: receiptFor(head.hash, head.seq) }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Verificar cadeia' }));

    // Chain statement (verifyLedger) and anchor statement stay SEPARATE.
    expect(await screen.findByText('Cadeia íntegra (4/4)')).toBeInTheDocument();
    const banner = await screen.findByTestId('anchor-banner');
    expect(banner).toHaveAttribute('data-anchor-state', 'anchored');
    expect(banner.textContent).toContain('Ancorada');
    expect(banner.textContent).toContain('git');
    expect(banner.textContent).toContain('2026-07-01');
  });

  it('estado 2 — íntegra, ancoragem PENDENTE: âmbar com "Retentar âncora" que ancora e vira verde', async () => {
    const ledger = await seededLedger();
    const adapter = fakeAdapter('anchored');
    const onAnchored = vi.fn();
    render(<LedgerExplorer ledger={ledger} anchor={{ adapter, onAnchored }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar cadeia' }));

    const banner = await screen.findByTestId('anchor-banner');
    expect(banner).toHaveAttribute('data-anchor-state', 'pending');
    expect(banner.textContent).toContain('garantia vigente');

    fireEvent.click(screen.getByRole('button', { name: 'Retentar âncora' }));
    await waitFor(() =>
      expect(screen.getByTestId('anchor-banner')).toHaveAttribute('data-anchor-state', 'anchored'),
    );
    // The fresh receipt went back to the HOST for persistence.
    expect(onAnchored).toHaveBeenCalledTimes(1);
    const head = ledger.getEntries()[3];
    expect(adapter.anchor).toHaveBeenCalledWith({ hash: head.hash, seq: head.seq });
  });

  it('retentar com transporte fora do ar: permanece pendente (nunca regride)', async () => {
    const ledger = await seededLedger();
    const adapter = {
      id: 'git',
      anchor: vi.fn(async () => {
        throw new Error('transport down');
      }),
      verify: vi.fn(async () => 'anchored' as const),
    };
    render(<LedgerExplorer ledger={ledger} anchor={{ adapter }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar cadeia' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retentar âncora' }));
    await waitFor(() => expect(adapter.anchor).toHaveBeenCalled());
    expect(screen.getByTestId('anchor-banner')).toHaveAttribute('data-anchor-state', 'pending');
  });

  it('estado 3 — CADEIA ≠ ÂNCORA: heads exibidos, índice da divergência e trilha não-confiável', async () => {
    const ledger = await seededLedger();
    const anchoredHash = 'f'.repeat(64); // the anchored head no longer matches
    render(
      <LedgerExplorer
        ledger={ledger}
        anchor={{ adapter: fakeAdapter('mismatch'), receipt: receiptFor(anchoredHash, 2) }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Verificar cadeia' }));

    const banner = await screen.findByTestId('anchor-banner');
    expect(banner).toHaveAttribute('data-anchor-state', 'mismatch');
    expect(banner.textContent).toContain('CADEIA ≠ ÂNCORA');
    expect(banner.textContent).toContain(`ancorado ${anchoredHash.slice(0, 12)}…`);
    expect(banner.textContent).toContain('divergência a partir da entrada #2');
    // INDEPENDENCE: the chain report still says íntegra — never fused.
    expect(screen.getByText('Cadeia íntegra (4/4)')).toBeInTheDocument();

    // The divergent entry (#2) and every later one are marked não-confiável.
    const rows = screen.getAllByRole('option');
    const marked = rows.filter((row) => row.hasAttribute('data-anchor-untrusted'));
    expect(marked.map((row) => row.getAttribute('data-seq'))).toEqual(['2', '3']);
    expect(marked[0].textContent).toContain('não-confiável');
  });

  it('ANCHOR_RECORDED é entrada própria na trilha, categorizada como Verificação', async () => {
    const ledger = await seededLedger();
    const head = ledger.getEntries()[3];
    await ledger.append(
      anchorRecordedEntry(
        { adapterId: 'git', head: { hash: head.hash, seq: head.seq }, proof: 'commit-abc', anchoredAt: '2026-07-01T00:00:00.000Z' },
        { id: 'ana' },
      ),
    );
    render(<LedgerExplorer ledger={ledger} />);
    expect(screen.getByText('ANCHOR_RECORDED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verificações 1' })).toBeInTheDocument();
    expect(categorizeEntry({ type: 'ANCHOR_RECORDED' })).toBe('verification');
  });

  it('sem a prop anchor o explorer não muda (degradação)', async () => {
    render(<LedgerExplorer ledger={await seededLedger()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar cadeia' }));
    expect(await screen.findByText('Cadeia íntegra (4/4)')).toBeInTheDocument();
    expect(screen.queryByTestId('anchor-banner')).not.toBeInTheDocument();
  });
});
