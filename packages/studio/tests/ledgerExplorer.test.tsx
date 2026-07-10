import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditLedger } from '@buildtovalue/core';
import { LedgerExplorer } from '../src/index.js';

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
