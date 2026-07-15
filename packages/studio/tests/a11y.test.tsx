import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { AuditLedger, LifecycleEngine, type UserContext } from '@buildtovalue/core';
import { createRecipeAdapter } from '@buildtovalue/adapters-bpmn';
import { PT_BR } from '@buildtovalue/react';
import { StudioShell } from '../src/index.js';
import { candidateDiagram } from './fixtures.js';

/**
 * Handoff 11 N-8 — accessibility gate for the Studio surface. Zero CRITICAL axe
 * violations is a hard gate across the three screens (Biblioteca, Revisão,
 * Auditoria); serious/moderate counts are surfaced for the pendencias ledger.
 * `color-contrast` is disabled (jsdom computes no layout).
 */
afterEach(cleanup);

const user: UserContext = { id: 'bruna', role: 'process-owner', name: 'Bruna' };

function renderShell() {
  return render(
    <StudioShell
      messages={PT_BR}
      user={user}
      library={{ adapters: [createRecipeAdapter()], onAction: () => {} }}
      review={{
        candidates: [candidateDiagram()],
        engine: new LifecycleEngine(),
        ledger: new AuditLedger(),
        now: () => '2026-07-08T00:00:00.000Z',
      }}
      audit={{ ledger: new AuditLedger() }}
    />,
  );
}

async function expectNoCritical(container: Element, label: string) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  });
  const count = (impact: string) =>
    results.violations.filter((v) => v.impact === impact).length;
  const critical = results.violations.filter((v) => v.impact === 'critical');
  if (critical.length > 0) {
     
    console.error(`${label} CRITICAL:\n${critical.map((v) => `${v.id}: ${v.help}`).join('\n')}`);
  }
   
  console.log(
    `[a11y] ${label}: critical=${count('critical')} serious=${count('serious')} moderate=${count('moderate')} minor=${count('minor')}`,
  );
  expect(critical, label).toEqual([]);
}

describe('a11y — Studio surface, zero critical (N-8)', () => {
  it('Biblioteca screen', async () => {
    const { container } = renderShell();
    await screen.findByText('Bolo de fubá cremoso');
    await expectNoCritical(container, 'Studio/Biblioteca');
  });

  it('Revisão screen', async () => {
    const { container } = renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Revisão' }));
    await expectNoCritical(container, 'Studio/Revisão');
  });

  it('Auditoria screen (Ledger Explorer)', async () => {
    const { container } = renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Auditoria' }));
    await expectNoCritical(container, 'Studio/Auditoria');
  });
});
