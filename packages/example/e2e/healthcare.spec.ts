import { expect, test } from '@playwright/test';

/**
 * Handoff 5 F-D: the 305° healthcare pack — clinical shapes with the plugin
 * signature, interoperable palette group, and the VISIBLE validation for a
 * clinical decision without a linked DMN table (amber ▲ chip in the badge
 * slot + HC_DECISION_UNLINKED on Validate).
 */
test('clinical pathway renders the 305° family with visible validation', async ({ page }) => {
  await page.goto('/?hc=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  for (const id of ['triage', 'antibiotic', 'dose', 'protocol', 'route']) {
    await expect(page.locator(`[data-node-id="${id}"]`)).toBeVisible();
  }
  // Plugin signature: small-caps type tag on the cards.
  await expect(
    page.locator('[data-node-id="triage"] [data-shape-tag]'),
  ).toHaveText('CLINICAL TASK');

  // Visible validation: unlinked decision carries the amber ▲ chip…
  const warning = page.locator('[data-node-id="antibiotic"] [data-hc-warning]');
  await expect(warning).toBeVisible();
  // …while the linked one shows the gold DMN badge in the same slot.
  await expect(page.locator('[data-node-id="dose"] [data-decision-link]')).toBeVisible();
  await expect(page.locator('[data-node-id="dose"] [data-hc-warning]')).toHaveCount(0);

  // The same fact reaches Validate as HC_DECISION_UNLINKED (warning).
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(
    page.locator('li[data-severity="warning"]', { hasText: 'sem tabela DMN vinculada' }),
  ).toHaveCount(1);

  // Palette: HEALTHCARE group with its 305° badge.
  await expect(page.locator('[data-palette-group="healthcare"] h3')).toContainText('HEALTHCARE');
  await expect(page.locator('[data-palette-group="healthcare"] h3')).toContainText('305°');
});
