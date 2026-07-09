import { expect, test, type Page } from '@playwright/test';

/**
 * Handoff 7A-2 acceptance: the token simulation mode drives the three
 * structural paths of the prototype (happy / rejection / timeout) to 3/3
 * coverage, the gateway choice is touch-operable with ≥44px targets, and the
 * whole flow works step-by-step under prefers-reduced-motion.
 */

/** Click "▶ Avançar" until it disables (a choice is due, or the run ends). */
async function advanceToStop(page: Page) {
  const advance = page.locator('[data-sim-advance]');
  for (let i = 0; i < 12; i++) {
    if (await advance.isDisabled()) break;
    await advance.click();
  }
}

const coverage = (page: Page) => page.locator('[data-sim-panel] .bpmnr-sim-card-title').first();

test('closes 3/3 across happy, rejection and timeout sessions', async ({ page }) => {
  await page.goto('/?simulate=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  await expect(page.locator('[data-sim-pill]')).toHaveText(/MODO SIMULAÇÃO/);
  await expect(coverage(page)).toContainText('0/3');

  // Happy path — approve.
  await advanceToStop(page);
  await expect(page.locator('[data-sim-choice]')).toBeVisible();
  await page.locator('[data-sim-choice-option="s3"]').click();
  await advanceToStop(page);
  await expect(coverage(page)).toContainText('1/3');

  // Rejection path.
  await page.locator('[data-sim-reset]').click();
  await advanceToStop(page);
  await page.locator('[data-sim-choice-option="s4"]').click();
  await advanceToStop(page);
  await expect(coverage(page)).toContainText('2/3');

  // Timeout path — fire the boundary while the token rests on its host.
  await page.locator('[data-sim-reset]').click();
  await page.locator('[data-sim-advance]').click(); // start → brief
  await page.locator('[data-sim-boundary="timeout"]').click();
  await advanceToStop(page);
  await expect(coverage(page)).toContainText('3/3');

  // Every path row is checked.
  await expect(page.locator('[data-sim-coverage] li[data-covered]')).toHaveCount(3);
  // Exercised edges are painted in the overlay (geometry, not CSS).
  await expect(page.locator('[data-sim-exercised-edge]').first()).toBeVisible();
});

test('registers the session in the ledger and shows the SACM evidence line (7A-3)', async ({ page }) => {
  await page.goto('/?simulate=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // Close one path so coverage > 0 and the record button appears.
  await advanceToStop(page);
  await page.locator('[data-sim-choice-option="s3"]').click();
  await advanceToStop(page);

  const record = page.locator('[data-sim-record]');
  await expect(record).toBeVisible();
  await record.click();

  const recorded = page.locator('[data-sim-recorded]');
  await expect(recorded).toContainText('Sessão registrada');
  await expect(recorded).toContainText('roteiro #');
  await expect(recorded).toContainText('comportamento validado');
  // The button hides after a successful registration.
  await expect(page.locator('[data-sim-record]')).toHaveCount(0);
});

test.describe('touch-first gateway choice', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('the choice buttons are ≥44px and tappable', async ({ page }) => {
    await page.goto('/?simulate=1');
    await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
    await advanceToStop(page);

    const approve = page.locator('[data-sim-choice-option="s3"]');
    await expect(approve).toBeVisible();
    const box = await approve.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await approve.tap();
    await expect(page.locator('[data-sim-choice]')).toHaveCount(0);
    await advanceToStop(page);
    await expect(coverage(page)).toContainText('1/3');
  });
});

test.describe('reduced motion', () => {
  test('defaults to step mode and the full flow is operable without animation', async ({ page }) => {
    // Emulate before load so the initial render reads the preference.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?simulate=1');
    await expect(page.locator('[data-sim-stepmode]')).toBeChecked();
    // No token-travel elements are emitted in step mode.
    await advanceToStop(page);
    await expect(page.locator('[data-sim-token-travel]')).toHaveCount(0);
    await page.locator('[data-sim-choice-option="s3"]').click();
    await advanceToStop(page);
    await expect(coverage(page)).toContainText('1/3');
  });
});
