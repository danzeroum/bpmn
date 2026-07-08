import { expect, test } from '@playwright/test';

/**
 * Handoff 6 S-3 — Biblioteca (e2e de filtro/seleção/ação, §9-3): the generic
 * gallery over concrete BPMN adapters AND the recipe acid-test adapter
 * (§10.1) living side by side; query state round-trips to the URL (§10.7).
 */

test('gallery renders artifacts from every adapter with canonical seals', async ({ page }) => {
  await page.goto('/?library=1');
  await expect(page.getByTestId('library-view')).toBeVisible();
  // concrete adapters (registry-backed)
  await expect(page.getByText('Onboarding de clientes')).toBeVisible();
  await expect(page.getByText('Analista de crédito')).toBeVisible();
  // fake adapter (acid test §10.1) in the same gallery
  await expect(page.getByText('Bolo de fubá cremoso')).toBeVisible();
  // same canonical StatusBadge everywhere (§10.6)
  const activeSeal = page.locator('.btv-lib-card .bpmnr-status-badge[data-status="active"]').first();
  await expect(activeSeal).toBeVisible();
});

test('status and type filters narrow the grid and update the URL', async ({ page }) => {
  await page.goto('/?library=1');
  await page.getByRole('button', { name: /^CANDIDATA/ }).click();
  await expect(page.getByText('Analista de crédito')).toBeVisible();
  await expect(page.getByText('Onboarding de clientes')).not.toBeVisible();
  expect(page.url()).toContain('status=candidate');

  await page.getByRole('button', { name: /^CANDIDATA/ }).click(); // clear
  await page.locator('.btv-lib-chip-type[data-adapter="recipe"]').click();
  await expect(page.getByText('Pão de queijo mineiro')).toBeVisible();
  await expect(page.getByText('Onboarding de clientes')).not.toBeVisible();
  expect(page.url()).toContain('type=recipe');
});

test('deep link restores filters from the URL (§10.7)', async ({ page }) => {
  await page.goto('/?library=1&q=moqueca');
  await expect(page.getByText('Moqueca capixaba')).toBeVisible();
  await expect(page.getByText('Onboarding de clientes')).not.toBeVisible();
  await expect(page.getByRole('searchbox')).toHaveValue('moqueca');
});

test('selecting a card opens the drawer; actions route through the host', async ({ page }) => {
  await page.goto('/?library=1');
  await page.getByRole('button', { name: /Onboarding de clientes/ }).click();
  await expect(page.getByText('DETALHE · FLUXO')).toBeVisible();
  await expect(page.getByText('PROVENIÊNCIA')).toBeVisible();
  await expect(page.getByText('VERSÕES')).toBeVisible();
  await page.locator('[data-action="open-designer"]').click();
  await expect(page.getByTestId('last-action')).toHaveText('open-designer → bpmn-diagram:onboarding');
});

test('the recipe drawer omits registry-only sections — optional fields, optional UI', async ({ page }) => {
  await page.goto('/?library=1');
  await page.getByRole('button', { name: /Bolo de fubá cremoso/ }).click();
  await expect(page.getByText('DETALHE · RECEITA')).toBeVisible();
  await expect(page.getByText('VERSÕES')).toBeVisible();
  await expect(page.getByText('PROVENIÊNCIA')).not.toBeVisible();
  await expect(page.getByText('N/A')).not.toBeVisible();
});
