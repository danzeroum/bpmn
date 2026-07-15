import { expect, test } from '@playwright/test';

/**
 * Handoff 14 §1f — engine bridge: the "Execução" tab only exists with the
 * engine plugin (`?engine=…`), and deploy is GATED by state — CANDIDATA gets
 * the "⚑ Deploy bloqueado → Ir para promoção" card; only ACTIVE **and**
 * signed (`?signed=1`, host-owned truth) can deploy.
 */

async function openExecutionTab(page: import('@playwright/test').Page) {
  // `score` is a top-level businessRuleTask in the sample diagram. The demo's
  // side panels can overlap its screen position, so dispatch the selection
  // events directly instead of a hit-tested click.
  await page.locator('[data-node-id="score"]').dispatchEvent('pointerdown', { button: 0 });
  await page.locator('svg.bpmnr-canvas').dispatchEvent('pointerup', { button: 0 });
  await page.locator('[data-inspector-tab="execution"]').click();
}

test('CANDIDATA: deploy blocked with the promotion hand-off card', async ({ page }) => {
  await page.goto('/?engine=candidate');
  await openExecutionTab(page);
  await expect(page.getByTestId('engine-blocked')).toContainText('Deploy bloqueado');
  await expect(page.getByTestId('engine-blocked')).toContainText('CANDIDATA');
  await expect(page.getByTestId('engine-deploy')).toHaveCount(0);
  await page.getByTestId('engine-go-promote').click();
  await expect(page.locator('body[data-promotion-requested="1"]')).toHaveCount(1);
});

test('ACTIVE but unsigned stays blocked — the gate needs both', async ({ page }) => {
  await page.goto('/?engine=active');
  await openExecutionTab(page);
  await expect(page.getByTestId('engine-blocked')).toBeVisible();
  await expect(page.getByTestId('engine-deploy')).toHaveCount(0);
});

test('ACTIVE + signed deploys', async ({ page }) => {
  await page.goto('/?engine=active&signed=1');
  await openExecutionTab(page);
  await expect(page.getByTestId('engine-blocked')).toHaveCount(0);
  await page.getByTestId('engine-deploy').click();
  await expect(page.locator('body[data-deployed="1"]')).toHaveCount(1);
});

test('without the engine plugin there is no Execução tab', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-node-id="score"]').dispatchEvent('pointerdown', { button: 0 });
  await page.locator('svg.bpmnr-canvas').dispatchEvent('pointerup', { button: 0 });
  await expect(page.locator('[data-inspector-node="score"]')).toBeVisible();
  await expect(page.locator('[data-inspector-tab="execution"]')).toHaveCount(0);
});
