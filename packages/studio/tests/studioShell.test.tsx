import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuditLedger, LifecycleEngine, type UserContext } from '@bpmn-react/core';
import { createRecipeAdapter } from '@bpmn-react/adapters-bpmn';
import { StudioShell } from '../src/index.js';
import { candidateDiagram } from './fixtures.js';

afterEach(cleanup);
beforeEach(() => {
  window.location.hash = '';
});

const user: UserContext = { id: 'bruna', role: 'process-owner', name: 'Bruna' };

function renderShell() {
  return render(
    <StudioShell
      user={user}
      library={{ adapters: [createRecipeAdapter()], onAction: () => {} }}
      review={{
        candidates: [candidateDiagram()],
        engine: new LifecycleEngine(),
        ledger: new AuditLedger(),
        now: () => '2026-07-08T00:00:00.000Z',
      }}
    />,
  );
}

describe('StudioShell — navegação por hash, sem router externo (§11)', () => {
  it('opens on the Biblioteca with brand, nav and user identity', async () => {
    renderShell();
    expect(screen.getByText('BuildToValue Studio')).toBeInTheDocument();
    expect(screen.getByText('Bruna · process-owner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Biblioteca' })).toHaveAttribute('aria-current', 'page');
    // the generic gallery renders (acid-test adapter §10.1)
    expect(await screen.findByText('Bolo de fubá cremoso')).toBeInTheDocument();
  });

  it('navigates to Revisão via the nav pill, updating the hash', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Revisão' }));
    expect(window.location.hash).toBe('#/revisao');
    expect(await screen.findByText(/FILA DE APROVAÇÃO/)).toBeInTheDocument();
    // the user shell identity feeds the actor — same papel in the queue header
    expect(screen.getByText(/SEU PAPEL: PROCESS-OWNER/)).toBeInTheDocument();
  });

  it('Auditoria is the S-5 placeholder; hashchange drives navigation', async () => {
    renderShell();
    window.location.hash = '#/auditoria';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(await screen.findByText(/Ledger Explorer — chega na S-5/)).toBeInTheDocument();
    window.location.hash = '#/biblioteca';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(await screen.findByText('Bolo de fubá cremoso')).toBeInTheDocument();
  });

  it('an unknown hash falls back to the Biblioteca', async () => {
    window.location.hash = '#/nada';
    renderShell();
    expect(screen.getByRole('button', { name: 'Biblioteca' })).toHaveAttribute('aria-current', 'page');
  });
});
