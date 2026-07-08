import { expect, test } from '@playwright/test';

/**
 * Handoff 5 F-C2 (aceite 10.5.7): selecting an edge of a supersession chain
 * docks the pedigree strip — full getEdgeChain in temporal order, real-shape
 * card snapshots, gold current card, and the adjacent-versions DiffView on
 * click. Esc order: diff → strip → selection (§11.1).
 */
test('edge pedigree strip renders the chain and opens the adjacent DiffView', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // Select the current gate→publish handoff (e6, tip of e6a → e6b → e6).
  // The L-shaped path's bbox center is off the stroke, so dispatch the
  // pointerdown straight to the edge group instead of clicking coordinates.
  await page
    .locator('[data-edge-id="e6"]')
    .dispatchEvent('pointerdown', { button: 0, bubbles: true });
  const strip = page.locator('[data-edge-pedigree]');
  await expect(strip).toBeVisible();

  // Full chain, temporal order, supersede ▸ between cards.
  const cards = strip.locator('[data-pedigree-card]');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute('data-pedigree-card', 'e6a');
  await expect(cards.nth(2)).toHaveAttribute('data-pedigree-card', 'e6');
  await expect(strip.locator('.bpmnr-pedigree-supersede')).toHaveCount(2);

  // Closed versions hatched; the current card is gold with the vigência badge.
  await expect(strip.locator('[data-pedigree-card="e6a"] [data-pedigree-hatch]')).toHaveCount(1);
  await expect(cards.nth(2)).toHaveAttribute('data-pedigree-current', 'true');
  await expect(strip.locator('.bpmnr-pedigree-badge')).toHaveText('RASCUNHO');

  // Click the middle card → DiffView of e6a ⇄ e6b.
  await strip.locator('[data-pedigree-card="e6b"]').click();
  const diff = page.locator('[data-pedigree-diff]');
  await expect(diff).toBeVisible();
  await expect(diff).toContainText('e6a superseded by e6b');

  // Esc: diff first, strip second, selection third.
  await page.keyboard.press('Escape');
  await expect(diff).toHaveCount(0);
  await expect(strip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(strip).toHaveCount(0);
});
