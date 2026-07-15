import { expect, test } from '@playwright/test';

/**
 * Handoff 14 §1e — auto-layout as a PROPOSAL: "Arrumar" opens the card with
 * counts and target ghosts; Recusar changes nothing; Aplicar is ONE undoable
 * command and the manual 📍 route is rigidly translated, never re-routed.
 * The `?manual=1` demo has one manual edge (bend at x=360) among 4 tasks.
 */

const nodeX = async (page: import('@playwright/test').Page, id: string) => {
  const transform = await page.locator(`[data-node-id="${id}"]`).getAttribute('transform');
  return Number(transform!.match(/translate\(([-\d.]+),/)![1]);
};

test('Arrumar proposes; Recusar leaves the diagram untouched', async ({ page }) => {
  await page.goto('/?manual=1');
  const before = await nodeX(page, 'n0');
  await page.getByRole('button', { name: 'Arrumar o diagrama automaticamente' }).click();
  await expect(page.getByTestId('layout-proposal')).toBeVisible();
  await expect(page.getByTestId('layout-counts')).toContainText('rota manual 📍 preservada');
  // Target ghosts on canvas, real positions untouched.
  await expect(page.locator('[data-layout-preview] rect').first()).toBeVisible();
  expect(await nodeX(page, 'n0')).toBe(before);
  await page.getByTestId('layout-refuse').click();
  await expect(page.getByTestId('layout-proposal')).toHaveCount(0);
  expect(await nodeX(page, 'n0')).toBe(before);
});

test('Aplicar moves the nodes, preserves the 📍 bend, and ONE undo restores all', async ({
  page,
}) => {
  await page.goto('/?manual=1');
  // `far` (an isolated task at x=560) definitely relocates to the first rank
  // column; n0's layout slot can coincide with its current position.
  const before = await nodeX(page, 'far');
  await page.getByRole('button', { name: 'Arrumar o diagrama automaticamente' }).click();
  await page.getByTestId('layout-apply').click();
  await expect(page.getByTestId('layout-proposal')).toHaveCount(0);
  expect(await nodeX(page, 'far')).not.toBe(before);
  // The manual edge still has its 3 authored waypoints (translated, not
  // re-routed): its path keeps exactly 2 segments (M + 2 Ls).
  const d = await page
    .locator('[data-edge-id="m"] path')
    .first()
    .getAttribute('d');
  expect((d!.match(/L/g) ?? []).length).toBe(2);
  // One Ctrl+Z restores the original position AND route.
  await page.keyboard.press('Control+z');
  expect(await nodeX(page, 'far')).toBe(before);
});
