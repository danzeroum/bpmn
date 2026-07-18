import { expect, test } from '@playwright/test';

/**
 * Handoff 18 §5d — ESC_NO_CATCH no dock: um throw de escalação sem catch
 * elegível é um WARNING (dissolve é legal na OMG, diferente de erro). O demo
 * `?escno=1` nasce COM o catch (sem aviso); deletar o catch faz o aviso
 * aparecer; o undo restaura o catch e o aviso some — a dependência throw⇄catch
 * nos dois sentidos, pela política 1.3.0.
 */
const selectNode = async (page: import('@playwright/test').Page, id: string) => {
  await page.locator(`[data-node-id="${id}"]`).first().dispatchEvent('pointerdown', { button: 0 });
  await page.locator('svg.bpmnr-canvas').dispatchEvent('pointerup', { button: 0 });
};

test('throw sem catch → ESC_NO_CATCH (warning) no dock → restaurar o catch → some', async ({ page }) => {
  await page.goto('/?escno=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  await page.getByTestId('lint-toggle').click();
  const panel = page.getByTestId('lint-panel');
  await expect(page.getByTestId('lint-policy')).toContainText('lint-etiquette@1.3.0');
  const group = panel.locator('[data-lint-group="esc-no-catch"]');

  // Em repouso: o boundary de escalação captura o throw → sem ESC_NO_CATCH.
  await expect(group).toHaveCount(0);

  // Deletar o catch → o throw fica sem destino → ESC_NO_CATCH (warning).
  await selectNode(page, 'bnd');
  await page.keyboard.press('Delete');
  await expect(group).toContainText('ESC_NO_CATCH');
  await expect(group).toContainText('dissolve');

  // Undo restaura o catch → o aviso some (adicionar catch = silenciar o dissolve).
  await page.keyboard.press('Control+z');
  await expect(group).toHaveCount(0);
});
