import { expect, test } from '@playwright/test';

/**
 * Handoff 16 E-4 (§3c) — aba Execução para eventos executáveis: payload no
 * THROW, captura no catch de ERRO, assimetria imposta pela UI e o negativo
 * declarado (catch de message sem aba — correlação é host-owned).
 */

const selectNode = async (page: import('@playwright/test').Page, id: string) => {
  await page.locator(`[data-node-id="${id}"]`).first().dispatchEvent('pointerdown', { button: 0 });
  await page.locator('svg.bpmnr-canvas').dispatchEvent('pointerup', { button: 0 });
};

const openExecution = async (page: import('@playwright/test').Page, id: string) => {
  await selectNode(page, id);
  await page.locator('[data-inspector-tab="execution"]').click();
};

test('throw = payload; catch de erro = captura; catch de message = sem aba', async ({ page }) => {
  await page.goto('/?eventio=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // 1. THROW: payload var → destino, undoável; captura AUSENTE.
  await openExecution(page, 't1');
  await expect(page.getByTestId('eventio-payload')).toBeVisible();
  await expect(page.getByTestId('eventio-capture')).toHaveCount(0);
  await page.getByTestId('eventio-add').click();
  await page.getByTestId('eventio-source-0').fill('=total');
  await page.getByTestId('eventio-target-0').fill('amount');
  await page.getByTestId('eventio-target-0').blur();
  // Reforço 6: a chave essencial NÃO re-renderiza no <details> avançado.
  await expect(page.getByTestId('execution-advanced')).not.toContainText('zeebe:payload');

  // 2. Boundary de ERRO: captura visível, payload AUSENTE (assimetria).
  await openExecution(page, 'b1');
  await expect(page.getByTestId('eventio-capture')).toBeVisible();
  await expect(page.getByTestId('eventio-payload')).toHaveCount(0);
  await page.getByLabel('Variável do código de erro').fill('motivo');
  await page.getByLabel('Variável do código de erro').blur();

  // 3. Error start DENTRO do subProcess também captura.
  await openExecution(page, 'es1');
  await expect(page.getByTestId('eventio-capture')).toBeVisible();

  // 4. Negativo declarado: catch de message não ganha aba nenhuma.
  await selectNode(page, 'mc');
  await expect(page.locator('.bpmnr-inspector-tabs')).toHaveCount(0);

  // 5. O payload do throw persistiu (troca de seleção não perde o commit).
  await openExecution(page, 't1');
  await expect(page.getByTestId('eventio-source-0')).toHaveValue('=total');
});
