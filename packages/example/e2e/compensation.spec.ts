import { expect, test } from '@playwright/test';

/**
 * Handoff 19 §6b (e2e do checklist) — o par «fazer ⟲ desfazer» no editor: o
 * boundary ⟲ sólido sem toggle, a associação tracejada sem seta, o marcador ◀◀
 * no handler, o chip transiente do throw e o picker de ATIVIDADES compensáveis;
 * mais o composto da paleta que exige host (veto declarado no canvas vazio).
 */
const selectNode = async (page: import('@playwright/test').Page, id: string) => {
  await page.locator(`[data-node-id="${id}"]`).first().dispatchEvent('pointerdown', { button: 0 });
  await page.locator('svg.bpmnr-canvas').dispatchEvent('pointerup', { button: 0 });
};

test('boundary sólido sem toggle + associação sem seta + marcador + chip + picker', async ({ page }) => {
  await page.goto('/?comp=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // O boundary de compensação: sem toggle interrupting (dispara pós-conclusão).
  await selectNode(page, 'bnd');
  await expect(page.getByTestId('interrupting-checkbox')).toHaveCount(0);

  // A associação boundary→handler é tracejada e SEM seta de fluxo.
  await expect(page.locator('[data-edge-id="a1"] path[stroke-dasharray]')).toHaveCount(1);
  await expect(page.locator('[data-edge-id="a1"] path[marker-end]')).toHaveCount(0);

  // O handler carrega o marcador ◀◀.
  await expect(page.locator('[data-node-id="cancel"] [data-comp-marker]')).toHaveCount(1);

  // O chip transiente do throw nomeia a atividade-alvo.
  await expect(page.locator('[data-event-compensation="thr"]')).toContainText('⟲');
  await expect(page.locator('[data-event-compensation="thr"]')).toContainText('Reservar hotel');

  // O picker do throw lista a atividade compensável do escopo + broadcast.
  await selectNode(page, 'thr');
  const picker = page.getByTestId('compensation-target');
  await expect(picker).toBeVisible();
  await expect(picker.locator('option[value="hotel"]')).toHaveCount(1);
  await expect(picker.locator('option[value=""]')).toHaveCount(1); // broadcast default
  await expect(picker).toHaveValue('hotel');
});

test('paleta «Compensação (par)» em canvas vazio = veto declarado (precisa de host)', async ({ page }) => {
  await page.goto('/?empty=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  await page.locator('[data-palette-item="compensationPair"]').click();
  await expect(page.locator('.bpmnr-toolbar-veto')).toContainText('atividade hospedeira');
  // Nada criado em silêncio: nenhum handler de compensação no canvas.
  await expect(page.locator('[data-comp-marker]')).toHaveCount(0);
});
