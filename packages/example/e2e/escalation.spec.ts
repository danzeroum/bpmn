import { expect, test } from '@playwright/test';

/**
 * Handoff 18 §5b — escalação governada no editor: escalationCode por tipo, o
 * chip de autoridade transiente lendo o valor ASSENTADO (reforço 8), o toggle
 * interrupting no boundary (decisão 3) e o veto declarado do drop sem host
 * (reforço 7).
 */
const selectNode = async (page: import('@playwright/test').Page, id: string) => {
  await page.locator(`[data-node-id="${id}"]`).first().dispatchEvent('pointerdown', { button: 0 });
  await page.locator('svg.bpmnr-canvas').dispatchEvent('pointerup', { button: 0 });
};

test('escalationCode + chip de autoridade assentado + toggle interrupting', async ({ page }) => {
  await page.goto('/?escalation=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // O boundary de escalação: campo de código por tipo (escalationCode).
  await selectNode(page, 'bnd');
  await expect(page.getByTestId('eventdefs-errorcode')).toHaveValue('OVER_BUDGET');
  await expect(page.getByText('Código de escalação')).toBeVisible();

  // Autoridade vazia = sem chip; digitar + Enter (assenta) → o chip aparece.
  await expect(page.locator('[data-event-authority="bnd"]')).toHaveCount(0);
  await page.getByTestId('eventdefs-authority').fill('ana.ruiz (Gate G2)');
  await page.getByTestId('eventdefs-authority').press('Enter');
  await expect(page.locator('[data-event-authority="bnd"]')).toContainText('↟');
  await expect(page.locator('[data-event-authority="bnd"]')).toContainText('ana.ruiz (Gate G2)');

  // O toggle existente flipa o boundary de não-interrupting para interrupting.
  const toggle = page.getByTestId('interrupting-checkbox');
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(toggle).toBeChecked();
});

test('reforço 7: boundary de escalação solto em canvas vazio = veto declarado', async ({ page }) => {
  await page.goto('/?empty=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  // Sem host sob o drop (centro do viewport vazio) → 🔒 com a razão nomeada.
  await page.locator('[data-palette-item="escalationBoundary"]').click();
  await expect(page.locator('.bpmnr-toolbar-veto')).toContainText('atividade hospedeira');
  // Nada criado em silêncio: nenhum boundary no canvas.
  await expect(page.locator('[data-node-id] .bpmnr-boundary, [data-node-type="boundaryEvent"]')).toHaveCount(0);
});
