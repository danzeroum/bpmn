import { expect, test } from '@playwright/test';

/**
 * Handoff 9 CP-2 — the governed copilot with a DETERMINISTIC FAKE provider
 * (§8.6: CI never calls the network). C1 drafts the reimbursement process as
 * ONE undoable composite with AI authorship; C2 adjusts incrementally;
 * "Desfazer tudo" reverts the whole plan in one click.
 */
test('C1: draft → applied diagram + mixed authorship + local soundness footer', async ({ page }) => {
  await page.goto('/?copilot=1');
  const panel = page.getByTestId('copilot-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('copilot-pill')).toHaveText('SÓ RASCUNHA');
  await expect(page.getByTestId('copilot-meta')).toContainText('claude-4 · prompt: copilot-draft v1.0.0');

  await panel.locator('textarea').fill('processo de reembolso com aprovação');
  await page.getByTestId('copilot-generate').click();

  // The draft landed on the canvas (7 nodes) and the footer carries the
  // authorship, the ledger hash and the LOCALLY computed soundness.
  await expect(page.locator('[data-node-id]')).toHaveCount(7);
  const footer = page.getByTestId('copilot-footer');
  await expect(footer).toContainText('autoria: ia.copilot@claude-4 + ana.ruiz');
  await expect(footer).toContainText('ledger: #');
  await expect(footer).toContainText('soundness: 0 erros');
  await expect(page.getByTestId('copilot-seal')).toContainText('ia.copilot@claude-4');
});

test('C2 adjust applies incrementally; "Desfazer tudo" reverts the whole plan', async ({ page }) => {
  await page.goto('/?copilot=1');
  const panel = page.getByTestId('copilot-panel');
  await panel.locator('textarea').fill('processo de reembolso');
  await page.getByTestId('copilot-generate').click();
  await expect(page.locator('[data-node-id]')).toHaveCount(7);

  // C2: incremental adjust renames the analysis task.
  await panel.locator('textarea').fill('explicite o SLA de 48h na análise');
  await page.getByTestId('copilot-adjust').click();
  await expect(page.locator('[data-node-id="analisar"]')).toContainText('SLA 48h');

  // "Desfazer tudo" of the LAST plan (the adjust) is one click/undo.
  await page.getByTestId('copilot-undo-all').click();
  await expect(page.locator('[data-node-id="analisar"]')).not.toContainText('SLA 48h');
  await expect(page.locator('[data-node-id]')).toHaveCount(7); // draft intact
});
