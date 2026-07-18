import { expect, test } from '@playwright/test';

/**
 * Handoff 15 V-5 (§2d) — e2e do ciclo completo do painel de review no Studio:
 * abrir review → navegar → responder → resolver → gate libera → aprovar
 * ASSINADO. `?threads=1` seeds one OPEN thread on the candidate ("work"), so
 * the reviewThreadsRule gate blocks approval until it is resolved.
 */

test('full review flow: open thread blocks, resolve releases, signed approval lands', async ({
  page,
}) => {
  await page.goto('/?studio=1&sign=1&threads=1#/revisao');
  await expect(page.getByText('PEDIDO DE PROMOÇÃO · CANDIDATE → ACTIVE')).toBeVisible();

  // Split canvas: the diff viewer (V-2) embedded in the ReviewScreen, with
  // the change-by-change bar (V-3) and the thread pin (V-4) on ONE surface.
  const split = page.getByTestId('review-split-canvas');
  await expect(split).toBeVisible();
  await expect(split.locator('svg.bpmnr-canvas')).toBeVisible();
  await expect(split.getByTestId('diff-nav')).toBeVisible();
  await expect(split.locator('[data-review-pin="work"]')).toBeVisible();
  // Read-only absoluto herdado: nenhuma superfície de edição no embed.
  await expect(page.locator('.bpmnr-palette')).toHaveCount(0);

  // Gate: banner ⚑ + the (signed) approve button disabled while a thread is
  // open. The signed variant IS the same gated button (data-signing).
  const banner = page.getByTestId('review-gate-banner');
  await expect(banner).toContainText('Aprovação bloqueada');
  await expect(banner).toContainText('1 thread aberta');
  const approve = page.getByRole('button', { name: '🔏 Assinar aprovação com minha chave' });
  await expect(approve).toBeDisabled();

  // Navegar: step through a change (V-3 order), then "ver no canvas" jumps to
  // the first OPEN thread and opens its popover.
  // First step lands on the current item; the second advances (U-4 discipline).
  await split.getByRole('button', { name: 'Próxima mudança (F7)' }).click();
  await split.getByRole('button', { name: 'Próxima mudança (F7)' }).click();
  await expect(split.getByTestId('diff-nav-counter')).toContainText('mudança 2 de');
  await page.getByTestId('review-gate-goto').click();
  const thread = page.getByTestId('review-thread');
  await expect(thread).toBeVisible();
  await expect(thread).toContainText('Quem cobre o passo manual durante a transição?');

  // Responder e resolver na própria thread.
  await thread.getByRole('textbox').fill('Ninguém — o passo automático assume no dia 1.');
  await page.getByTestId('review-send').click();
  await expect(thread).toContainText('Ninguém — o passo automático assume no dia 1.');
  await thread.locator('[data-review-resolve]').click();
  await expect(thread.getByTestId('review-resolved')).toBeVisible();

  // Gate libera: banner some, botão habilita.
  await expect(page.getByTestId('review-gate-banner')).toHaveCount(0);
  await expect(approve).toBeEnabled();

  // Aprovar assinado: ledger + selo de identidade verificada (Handoff 8).
  await approve.click();
  await expect(page.getByText('Aprovação registrada no ledger')).toBeVisible();
  await expect(page.locator('.bpmnr-signature-badge[data-verification="valid"]')).toContainText(
    'ASSINADA · VERIFICADA',
  );
});

test('V-6 full cycle: pedir mudanças assinado → ⟲ na Biblioteca → re-submeter → resolver → aprovar assinado → cadeia íntegra', async ({
  page,
}) => {
  await page.goto('/?studio=1&sign=1&threads=1#/revisao');

  // Aprovar bloqueado pela thread aberta (V-5 gate).
  const approve = page.getByRole('button', { name: '🔏 Assinar aprovação com minha chave' });
  await expect(approve).toBeDisabled();

  // Pedir mudanças ASSINADO: comentário obrigatório + thread anexada.
  await page.getByTestId('review-request-changes').click();
  const form = page.getByTestId('review-request-form');
  await expect(form).toContainText('1 thread aberta anexada ao pedido');
  const confirm = page.getByTestId('review-request-confirm');
  await expect(confirm).toContainText('Assinar pedido de mudanças');
  await form.locator('textarea').fill('curta');
  await expect(confirm).toBeDisabled();
  await form.locator('textarea').fill('Cubram o passo manual durante a transição da automação.');
  await confirm.click();
  await expect(page.getByText('Pedido de mudanças registrado no ledger')).toBeVisible();
  await expect(page.locator('.bpmnr-signature-badge[data-verification="valid"]')).toContainText(
    'ASSINADA · VERIFICADA',
  );
  // Evento N-3 emitido via ponte do host.
  await expect(page.getByTestId('last-action')).toContainText('review.changes.requested');

  // Galeria da Biblioteca mostra o selo ⟲ (decisão 2 da V-0).
  await page.getByRole('button', { name: 'Biblioteca' }).click();
  await expect(page.getByText('⟲ EM REVISÃO').first()).toBeVisible();

  // Designer re-submete (demo): in-review → candidate pela state machine.
  await page.getByTestId('demo-resubmit').click();
  await page.getByRole('button', { name: 'Revisão', exact: true }).click();

  // Diff da re-submissão: v-pedido → v-nova, nunca a base original.
  await expect(page.getByTestId('review-diff-kicker')).toContainText(
    'DIFF DA RE-SUBMISSÃO VS V2.0.0 (PEDIDO DE MUDANÇAS)',
  );
  const split = page.getByTestId('review-split-canvas');
  await expect(split).toBeVisible();
  // A thread da rodada anterior segue visível e ABERTA — ainda bloqueia.
  await expect(page.getByTestId('review-gate-banner')).toContainText('1 thread aberta');
  await expect(approve).toBeDisabled();

  // Resolver a thread pela superfície de review ("ver no canvas" navega até ela).
  await page.getByTestId('review-gate-goto').click();
  const thread = page.getByTestId('review-thread');
  await thread.locator('[data-review-resolve]').click();
  await expect(thread.getByTestId('review-resolved')).toBeVisible();
  await page.keyboard.press('Escape');

  // Gate libera → aprovar ASSINADO.
  await expect(page.getByTestId('review-gate-banner')).toHaveCount(0);
  await approve.click();
  await expect(page.getByText('Aprovação registrada no ledger')).toBeVisible();
  await expect(page.locator('.bpmnr-signature-badge[data-verification="valid"]')).toContainText(
    'ASSINADA · VERIFICADA',
  );

  // verifyLedger íntegro de ponta a ponta: 4 do mundo + pedido + aprovação.
  await page.getByRole('button', { name: 'Auditoria' }).click();
  await page.getByRole('button', { name: 'Verificar cadeia' }).click();
  await expect(page.getByText('Cadeia íntegra (6/6)', { exact: true })).toBeVisible();
});

test('threads tab mirrors the V-3 list; dismissal demands a justification', async ({ page }) => {
  await page.goto('/?studio=1&threads=1#/revisao');
  const split = page.getByTestId('review-split-canvas');
  await expect(split).toBeVisible();

  // Abas sincronizadas: Threads (1) e Mudanças (M) — o mesmo M do contador.
  const counter = await split.getByTestId('diff-nav-counter').textContent();
  const total = /de (\d+)/.exec(counter ?? '')?.[1];
  await expect(split.locator('[data-review-tab="threads"]')).toContainText('Threads (1)');
  await expect(split.locator('[data-review-tab="changes"]')).toContainText(`Mudanças (${total})`);

  // Dispensa SEM resolver: justificativa mínima obrigatória, gate libera.
  await split.locator('[data-review-tab="threads"]').click();
  const list = split.getByTestId('review-threads-list');
  await list.locator('[data-review-dismiss-toggle]').click();
  const confirm = list.locator('[data-review-dismiss-confirm]');
  await list.locator('[data-review-dismiss] textarea').fill('curta');
  await expect(confirm).toBeDisabled();
  await list.locator('[data-review-dismiss] textarea').fill('Risco aceito: transição coberta pelo plano.');
  await confirm.click();
  await expect(list.locator('[data-review-thread-item]')).toHaveAttribute(
    'data-review-thread-state',
    'dismissed',
  );
  await expect(page.getByTestId('review-gate-banner')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Aprovar como process-owner' })).toBeEnabled();
});
