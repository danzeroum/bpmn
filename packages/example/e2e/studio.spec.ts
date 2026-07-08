import { expect, test } from '@playwright/test';

/**
 * Handoff 6 S-4 — Studio shell + Revisão do Aprovador (e2e do fluxo aprovar
 * e rejeitar, §9-4). Approving records the decision in the ledger and NEVER
 * activates (§11); rejection demands a 10+ char justification (§5).
 */

test('shell opens on the Biblioteca; nav reaches the Revisão via hash', async ({ page }) => {
  await page.goto('/?studio=1');
  await expect(page.getByText('BuildToValue Studio', { exact: true })).toBeVisible();
  await expect(page.getByText('Bolo de fubá cremoso')).toBeVisible(); // recipe in the shell too
  await page.getByRole('button', { name: 'Revisão' }).click();
  expect(page.url()).toContain('#/revisao');
  await expect(page.getByText('FILA DE APROVAÇÃO · SEU PAPEL: PROCESS-OWNER')).toBeVisible();
});

test('the review shows the request with 1/2 progress, real checks and the warning', async ({ page }) => {
  await page.goto('/?studio=1#/revisao');
  await expect(page.getByText('PEDIDO DE PROMOÇÃO · CANDIDATE → ACTIVE')).toBeVisible();
  await expect(page.getByText('1/2 aprovações').first()).toBeVisible();
  await expect(page.getByText('CHANGE SUMMARY (DA SOLICITANTE)')).toBeVisible();
  await expect(page.getByText('DIFF VS V1.0.0')).toBeVisible();
  await expect(page.locator('.btv-studio-check[data-ok="true"]')).toHaveCount(4);
  await expect(page.getByText(/A ativação NÃO é automática/)).toBeVisible();
  // read-only absoluto: no canvas, no palette (§10.3)
  await expect(page.locator('svg.bpmnr-canvas')).toHaveCount(0);
});

test('approve flow: confirmation card with ledger hash, no undo', async ({ page }) => {
  await page.goto('/?studio=1#/revisao');
  await page.getByRole('button', { name: 'Aprovar como process-owner' }).click();
  await expect(page.getByText('Aprovação registrada no ledger')).toBeVisible();
  await expect(page.locator('.btv-studio-decision-done code')).toHaveText(/^[0-9a-f]{64}$/);
  await expect(page.getByText(/Decisão imutável/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Aprovar como/ })).toHaveCount(0);
});

test('reject flow: justification gate (min 10 chars) then ledger confirmation', async ({ page }) => {
  await page.goto('/?studio=1#/revisao');
  await page.getByRole('button', { name: 'Rejeitar com justificativa…' }).click();
  const confirm = page.getByRole('button', { name: 'Confirmar rejeição' });
  await expect(confirm).toBeDisabled();
  await page.getByRole('textbox').fill('curta');
  await expect(confirm).toBeDisabled();
  await page.getByRole('textbox').fill('O diff remove a validação manual sem plano de contingência.');
  await confirm.click();
  await expect(page.getByText('Rejeição registrada no ledger')).toBeVisible();
});

test('keyboard: queue reachable and decidable without a mouse (§10.8)', async ({ page }) => {
  await page.goto('/?studio=1#/revisao');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  // Tab to the approve button and hit Enter — decision without a mouse
  await page.getByRole('button', { name: 'Aprovar como process-owner' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Aprovação registrada no ledger')).toBeVisible();
});
