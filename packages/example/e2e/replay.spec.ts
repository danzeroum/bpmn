import { expect, test, type Page } from '@playwright/test';

/**
 * Handoff 7B-2 acceptance: replay mode paints a frequency heatmap (thickness +
 * counts, geometry not CSS), token-replay fitness, clickable deviations, ⌀ time
 * chips with a bottleneck, and a sampled-variant token — all in violet "MODO
 * REPLAY", never mixing with the blue simulation. The demo log has two known
 * deviations (gate skip + repeated "Gerar plano").
 */
const canvas = (page: Page) => page.locator('svg.bpmnr-canvas');

test('renders the heatmap, fitness and deviations over the model', async ({ page }) => {
  await page.goto('/?replay=1');
  await expect(canvas(page)).toBeVisible();
  await expect(page.locator('[data-replay-pill]')).toHaveText(/MODO REPLAY/);

  // Import summary + fitness.
  await expect(page.locator('[data-replay-file]')).toHaveText(/onboarding_prod_jun\.xes/);
  await expect(page.locator('[data-replay-fitness]')).toHaveText(/%/);

  // Heatmap: edge thickness + count labels are real geometry (survive export §9).
  await expect(page.locator('[data-replay-edge]').first()).toBeVisible();
  await expect(page.locator('[data-replay-edge-count]').first()).toBeVisible();

  // ⌀ time chips + the bottleneck ("Gerar plano", ⌀ 31 h · GARGALO).
  await expect(page.locator('[data-replay-chip]').first()).toBeVisible();
  await expect(page.locator('[data-replay-chip="plan"]')).toContainText('GARGALO');

  // Two deviations, listed and drawn on the canvas.
  await expect(page.locator('[data-replay-devlist] [data-replay-dev]')).toHaveCount(2);
  await expect(page.locator('[data-replay-deviation]').first()).toBeVisible();
});

test('selecting a deviation highlights it on the canvas', async ({ page }) => {
  await page.goto('/?replay=1');
  await expect(canvas(page)).toBeVisible();
  const first = page.locator('[data-replay-dev="0"]');
  await first.click();
  await expect(first).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('[data-replay-deviation="0"][data-selected]')).toHaveCount(1);
});

test('reproduces a sampled variant with the violet token', async ({ page }) => {
  await page.goto('/?replay=1');
  await expect(canvas(page)).toBeVisible();
  await expect(page.locator('[data-replay-token]')).toHaveCount(0);
  await page.locator('[data-replay-play="0"]').click();
  // The violet token appears while the sampled variant plays.
  await expect(page.locator('[data-replay-token]')).toBeVisible();
});

test('filters by version (bindRun) and attaches the analysis to the promotion (7B-3)', async ({ page }) => {
  await page.goto('/?replay=1');
  await expect(canvas(page)).toBeVisible();

  // Version selector: v2.0.0 has runs and is selected; v2.1.0 is the candidate.
  await expect(page.locator('[data-replay-version="v20"]')).toContainText('100 execuções');
  await expect(page.locator('[data-replay-version="v21"]')).toContainText('candidata');
  await expect(page.locator('[data-replay-version="v20"][data-active]')).toHaveCount(1);

  // Comparison card names the bottleneck and the candidate fix, then attaches.
  await expect(page.locator('[data-replay-compare-text]')).toContainText('O gargalo real da v2.0.0');
  await page.locator('[data-replay-attach]').click();
  await expect(page.locator('[data-replay-attached]')).toBeVisible();

  // Switching to the candidate (no runs) shows the empty state, no comparison.
  await page.locator('[data-replay-version="v21"]').click();
  await expect(page.locator('[data-replay-fitness]')).toHaveText('—');
  await expect(page.locator('[data-replay-compare]')).toHaveCount(0);
});

test.describe('reduced motion', () => {
  test('the heatmap and variant playback stay operable without animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?replay=1');
    await expect(page.locator('[data-replay-edge]').first()).toBeVisible();
    await page.locator('[data-replay-play="0"]').click();
    await expect(page.locator('[data-replay-token]')).toBeVisible(); // still steps, 0ms transition
  });
});
