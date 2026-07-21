import { expect, test } from '@playwright/test';

/**
 * Handoff 19 §6c — COMP_BOUNDARY_NO_HANDLER no dock: um boundary de compensação
 * (⟲) sem handler é um ERRO com quick-fix mecânico. O demo `?compno=1` nasce
 * SEM handler → o dock acusa; "corrigir" cria o handler + associação (a FORMA
 * compartilhada com a paleta) → o marcador ◀◀ aparece e o finding some; a
 * política é a 1.4.0.
 */
test('boundary ⟲ sem handler → COMP_BOUNDARY_NO_HANDLER → corrigir cria o par → some', async ({ page }) => {
  await page.goto('/?compno=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  await page.getByTestId('lint-toggle').click();
  const panel = page.getByTestId('lint-panel');
  await expect(page.getByTestId('lint-policy')).toContainText('lint-etiquette@1.5.0');
  const group = panel.locator('[data-lint-group="comp-boundary-no-handler"]');

  // Nasce sem handler → o dock acusa o erro.
  await expect(group).toContainText('COMP_BOUNDARY_NO_HANDLER');
  // Ainda não há handler de compensação no canvas.
  await expect(page.locator('[data-comp-marker]')).toHaveCount(0);

  // "Corrigir": cria handler (◀◀) + associação; o finding some.
  await group.locator('[data-lint-fix]').first().click();
  await expect(page.locator('[data-comp-marker]')).toHaveCount(1);
  await expect(group).toHaveCount(0);

  // Undo desfaz o par num passo → o erro volta.
  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-comp-marker]')).toHaveCount(0);
  await expect(group).toContainText('COMP_BOUNDARY_NO_HANDLER');
});
