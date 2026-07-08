import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditLedger, LifecycleEngine, type UserContext } from '@bpmn-react/core';
import { ReviewScreen } from '../src/index.js';
import { candidateDiagram } from './fixtures.js';

afterEach(cleanup);

const actor: UserContext = { id: 'bruna', role: 'process-owner', name: 'Bruna' };

function setup(overrides: Partial<Parameters<typeof ReviewScreen>[0]> = {}) {
  const engine = new LifecycleEngine();
  const ledger = new AuditLedger();
  const candidates = overrides.candidates ?? [
    candidateDiagram({
      approvedBy: [{ userId: 'carla', role: 'compliance', approvedAt: '2026-07-01T00:00:00.000Z', reason: 'ok' }],
      effectiveFrom: '2026-07-10T00:00:00.000Z',
    }),
  ];
  const props = {
    candidates,
    engine,
    ledger,
    actor,
    now: () => '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
  return { engine, ledger, ...render(<ReviewScreen {...props} />) };
}

describe('ReviewScreen — TELA 2 (§5)', () => {
  it('shows the queue with role header, progress seal and amber SLA', async () => {
    setup();
    expect(await screen.findByText(/FILA DE APROVAÇÃO · SEU PAPEL: PROCESS-OWNER/)).toBeInTheDocument();
    expect((await screen.findAllByText('1/2 aprovações')).length).toBeGreaterThanOrEqual(1);
    const sla = screen.getByText('ativação alvo em 2d');
    expect(sla).toHaveAttribute('data-urgent');
  });

  it('renders the review blocks in order with the mandated warning', async () => {
    setup();
    expect(await screen.findByText('PEDIDO DE PROMOÇÃO · CANDIDATE → ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('CHANGE SUMMARY (DA SOLICITANTE)')).toBeInTheDocument();
    expect(screen.getByText(/Automatiza a checagem de documentos/)).toBeInTheDocument();
    expect(screen.getByText('VERIFICAÇÕES AUTOMÁTICAS')).toBeInTheDocument();
    expect(screen.getByText('SUA DECISÃO')).toBeInTheDocument();
    expect(screen.getByText(/Já aprovaram: compliance\./)).toBeInTheDocument();
    expect(screen.getByText(/A sua é a última aprovação necessária\./)).toBeInTheDocument();
    expect(
      screen.getByText(/A ativação NÃO é automática — a solicitante executa a promoção final\./),
    ).toBeInTheDocument();
    // 4 verification cards from REAL calls (§10.4)
    await waitFor(() => {
      expect(document.querySelectorAll('.btv-studio-check[data-ok="true"]')).toHaveLength(4);
    });
  });

  it('approve records the decision: green card with ledger hash, immutable', async () => {
    const onDecided = vi.fn();
    const { ledger } = setup({ onDecided });
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar como process-owner' }));
    expect(await screen.findByText('Aprovação registrada no ledger')).toBeInTheDocument();
    const entries = ledger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('APPROVAL_RECORDED');
    expect(screen.getByText(entries[0].hash)).toBeInTheDocument();
    expect(screen.getByText(/Decisão imutável/)).toBeInTheDocument();
    expect(onDecided).toHaveBeenCalledWith(expect.objectContaining({ kind: 'approved' }));
    // no undo — decision buttons are gone
    expect(screen.queryByRole('button', { name: /Aprovar como/ })).not.toBeInTheDocument();
  });

  it('reject demands a 10+ char justification before enabling confirmation', async () => {
    const { ledger } = setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Rejeitar com justificativa…' }));
    const confirm = screen.getByRole('button', { name: 'Confirmar rejeição' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'curta' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Remove a validação de CPF sem justificativa.' },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(await screen.findByText('Rejeição registrada no ledger')).toBeInTheDocument();
    expect(ledger.getEntries()[0].type).toBe('PROMOTION_REJECTED');
  });

  it('queue is keyboard-navigable: arrows move the selection (§10.8)', async () => {
    const first = candidateDiagram({ id: 'a', name: 'Fluxo A', versionId: 'va' });
    const second = candidateDiagram({ id: 'b', name: 'Fluxo B', versionId: 'vb' });
    setup({ candidates: [first, second] });
    const list = await screen.findByRole('listbox');
    await screen.findByText('PEDIDO DE PROMOÇÃO · CANDIDATE → ACTIVE');
    expect(screen.getByRole('option', { name: /Fluxo A/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Fluxo B/ })).toHaveAttribute('aria-selected', 'true');
    });
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Fluxo A/ })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('offers no mutation path: no canvas, no editing controls (§10.3)', async () => {
    setup();
    await screen.findByText('SUA DECISÃO');
    expect(document.querySelector('svg.bpmnr-canvas')).toBeNull();
    expect(document.querySelector('.bpmnr-palette')).toBeNull();
    expect(screen.queryByText(/Undo|Desfazer/)).not.toBeInTheDocument();
  });

  it('shows the empty state when nothing awaits the user', async () => {
    setup({ candidates: [] });
    expect(await screen.findByText('Nenhum pedido aguardando a sua aprovação.')).toBeInTheDocument();
  });

  it('renders the diff against a baseline and the open-in-canvas link', async () => {
    const baseline = candidateDiagram({ versionId: 'v1', semver: '1.0.0', status: 'active' });
    const onOpen = vi.fn();
    setup({ baselineOf: () => baseline, onOpenInDesigner: onOpen });
    expect(await screen.findByText('DIFF VS V1.0.0')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'abrir no canvas →' }));
    expect(onOpen).toHaveBeenCalled();
  });
});
