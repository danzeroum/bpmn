import { expect, test } from '@playwright/test';

/**
 * Handoff 6 S-6 — integração fim-a-fim (§9-6): Biblioteca → abrir → Revisão
 * → aprovar → o Ledger mostra tudo. Papel do usuário alimenta fila e botões;
 * filtros e seleção da Biblioteca vivem na URL (§10.7).
 */

test('the gallery shows every adapter type — DMN and recipe as ordinary adapters (§10.1)', async ({ page }) => {
  await page.goto('/?studio=1');
  await expect(page.locator('.btv-lib-chip-type[data-adapter="bpmn-diagram"]')).toHaveText(/FLUXO 1/);
  await expect(page.locator('.btv-lib-chip-type[data-adapter="btv-persona"]')).toHaveText(/PERSONA 1/);
  await expect(page.locator('.btv-lib-chip-type[data-adapter="btv-prompt"]')).toHaveText(/PROMPT 1/);
  await expect(page.locator('.btv-lib-chip-type[data-adapter="btv-connector"]')).toHaveText(/CONNECTOR 1/);
  await expect(page.locator('.btv-lib-chip-type[data-adapter="btv-policy"]')).toHaveText(/POLÍTICA 1/);
  await expect(page.locator('.btv-lib-chip-type[data-adapter="dmn-decision"]')).toHaveText(/DECISÃO 1/);
  await expect(page.locator('.btv-lib-chip-type[data-adapter="recipe"]')).toHaveText(/RECEITA 6/);
});

test('end-to-end: aprovar na Revisão aparece na Auditoria e a cadeia segue íntegra', async ({ page }) => {
  await page.goto('/?studio=1#/revisao');
  await expect(page.getByText('1/2 aprovações').first()).toBeVisible();
  await page.getByRole('button', { name: 'Aprovar como process-owner' }).click();
  await expect(page.getByText('Aprovação registrada no ledger')).toBeVisible();

  await page.getByRole('button', { name: 'Auditoria' }).click();
  // the new APPROVAL_RECORDED joined the trail: 2 approvals now, 5 entries
  await expect(page.getByRole('button', { name: 'Todos 5' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprovações 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Verificar cadeia' }).click();
  await expect(page.getByText('Cadeia íntegra (5/5)', { exact: true })).toBeVisible();
  // the fresh entry carries Bruna's role
  await page.getByRole('button', { name: 'Aprovações 2' }).click();
  await expect(page.locator('.btv-studio-ledger-entry[data-seq="4"]')).toBeVisible();
  await page.locator('.btv-studio-ledger-entry[data-seq="4"]').click();
  await expect(page.getByText('role: process-owner')).toBeVisible();
});

test('§10.7: Abrir no Designer → voltar preserva filtros e seleção via URL', async ({ page }) => {
  await page.goto('/?studio=1');
  await page.getByRole('button', { name: /^ATIVA/ }).click();
  await page.getByRole('button', { name: /Onboarding de clientes/ }).click();
  await expect(page.getByText('DETALHE · FLUXO')).toBeVisible();
  expect(page.url()).toContain('status=active');
  expect(page.url()).toContain('sel=bpmn-diagram%3Aonboarding');

  await page.locator('[data-action="open-designer"]').click();
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible(); // o Designer de verdade

  await page.goBack();
  await expect(page.getByText('DETALHE · FLUXO')).toBeVisible(); // seleção restaurada
  await expect(page.getByRole('button', { name: /^ATIVA/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('searchbox')).toBeVisible();
});

test('papel do usuário: Carla (compliance) já aprovou — a fila dela está vazia', async ({ page }) => {
  await page.goto('/?studio=1#/revisao');
  await expect(page.getByText('SEU PAPEL: PROCESS-OWNER')).toBeVisible();
  await page.getByLabel('Trocar usuário').selectOption('carla');
  await expect(page.getByText('SEU PAPEL: COMPLIANCE')).toBeVisible();
  await expect(page.getByText('Nenhum pedido aguardando a sua aprovação.')).toBeVisible();
  await page.getByLabel('Trocar usuário').selectOption('bruna');
  await expect(page.getByText('1/2 aprovações').first()).toBeVisible();
});
