import { expect, test } from '@playwright/test';

/**
 * Aceite C3 (Handoff 4): a diagram with the classic XOR-split → AND-join
 * deadlock cannot be promoted to active — the SND_DEADLOCK_JOIN code is
 * visible in the promotion modal and "ver no canvas" badges the join node.
 */
test('deadlock blocks promotion with SND_DEADLOCK_JOIN visible in the modal', async ({ page }) => {
  await page.goto('/?deadlock=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  await expect(page.locator('[data-node-id="join"]')).toBeVisible();

  // draft → test → candidate, then open the formal promotion flow.
  await page.getByRole('button', { name: '→ test' }).click();
  await page.getByRole('button', { name: '→ candidate' }).click();
  await page.getByRole('button', { name: 'Promover…' }).click();
  const dialog = page.getByRole('dialog', { name: /Ativar v/ });
  await expect(dialog).toBeVisible();

  // Satisfy every OTHER gate: quorum of two distinct roles.
  await dialog.getByRole('button', { name: 'Aprovar como Owner' }).click();
  await dialog.getByRole('button', { name: 'Aprovar como Compliance' }).click();
  await expect(dialog).toContainText('(2/2)');

  // The soundness section is red with the stable code, and the core gate
  // (promotion rule) keeps activation disabled.
  await expect(dialog).toContainText('Soundness · 1 erro(s)');
  await expect(dialog).toContainText('SND_DEADLOCK_JOIN');
  await expect(dialog.getByRole('button', { name: /^Ativar v/ })).toBeDisabled();

  // "ver no canvas" closes the modal and badges the offending AND-join.
  await dialog.getByRole('button', { name: 'ver no canvas' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('[data-node-id="join"] [data-node-issue="error"]')).toBeVisible();
});

test('a sound diagram shows a green soundness section and node badges from Validate', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // The demo sample is warnings-only: Validate lists issues, but no SND
  // error badges appear (badges track error/warning-level node issues).
  await page.getByRole('button', { name: 'Validate diagram' }).click();
  await expect(page.locator('.bpmnr-issues')).toContainText('warning');
  // Closing the panel clears any badges.
  await page.getByRole('button', { name: 'Close validation' }).click();
  await expect(page.locator('[data-node-issue]')).toHaveCount(0);

  // The promotion modal's soundness section is green for the sound sample.
  await page.getByRole('button', { name: '→ test' }).click();
  await page.getByRole('button', { name: '→ candidate' }).click();
  await page.getByRole('button', { name: 'Promover…' }).click();
  const dialog = page.getByRole('dialog', { name: /Ativar v/ });
  await expect(dialog).toContainText('Soundness · 0 erros');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
});
