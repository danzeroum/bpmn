import { expect, test } from '@playwright/test';

/** Editor resilience (Handoff 4 §D2/§D3): autosave recovery and exit guard. */

test('recovers an unsaved draft after a reload, and discard keeps the base diagram', async ({
  page,
}) => {
  test.slow();
  await page.goto('/');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  const before = await page.locator('[data-node-id]').count();

  await page.getByRole('button', { name: 'Adicionar Task' }).click();
  await expect(page.locator('[data-node-id]')).toHaveCount(before + 1);
  await page.waitForTimeout(2400); // autosave debounce (2s)

  await page.reload();
  const banner = page.getByRole('alert').filter({ hasText: 'Rascunho não salvo' });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.locator('[data-node-id]')).toHaveCount(before + 1);
  await expect(banner).not.toBeVisible();

  // Discard path: another change, another reload — Descartar keeps the base
  // diagram and clears the stored draft for good.
  await page.getByRole('button', { name: 'Adicionar Task' }).click();
  await page.waitForTimeout(2400);
  await page.reload();
  const banner2 = page.getByRole('alert').filter({ hasText: 'Rascunho não salvo' });
  await expect(banner2).toBeVisible();
  await banner2.getByRole('button', { name: 'Descartar' }).click();
  await expect(page.locator('[data-node-id]')).toHaveCount(before);

  await page.reload();
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Rascunho não salvo' }),
  ).toHaveCount(0);
});

test('warns before leaving with unsaved changes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar Task' }).click();

  const dialogPromise = page.waitForEvent('dialog');
  const closed = page.close({ runBeforeUnload: true });
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.accept();
  await closed;
});
