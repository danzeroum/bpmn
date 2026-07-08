import { expect, test } from '@playwright/test';

/**
 * Handoff 6 S-5 — Ledger Explorer (e2e de cadeia íntegra e quebrada, §9-5).
 * The demo world seeds 4 entries (2 commands, 1 approval, 1 attestation);
 * `?tamper=1` forges entry 1 so the chain breaks there (§10.5).
 */

test('trail renders with category chips and counts; detail shows the chaining', async ({ page }) => {
  await page.goto('/?studio=1#/auditoria');
  await expect(page.getByRole('button', { name: 'Todos 4' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Comandos 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprovações 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Promoções 1' })).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(4);
  // detail block: index/hash/prev of the first (genesis) entry
  await expect(page.getByText('index: 0')).toBeVisible();
  await expect(page.getByText('prev: (gênese)')).toBeVisible();
});

test('Verificar cadeia goes green with n/n and downloads the report', async ({ page }) => {
  await page.goto('/?studio=1#/auditoria');
  await page.getByRole('button', { name: 'Verificar cadeia' }).click();
  await expect(page.getByText('Cadeia íntegra (4/4)', { exact: true })).toBeVisible();
  await expect(page.getByText(/head [0-9a-f]{12}/)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'baixar VerificationReport.json' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('VerificationReport.json');
});

test('tampered fixture: red banner with the exact index, later entries untrusted (§10.5)', async ({ page }) => {
  await page.goto('/?studio=1&tamper=1#/auditoria');
  await page.getByRole('button', { name: 'Verificar cadeia' }).click();
  await expect(page.getByText('Cadeia quebrada na entrada 1')).toBeVisible();
  await expect(page.locator('.btv-studio-ledger-entry[data-untrusted]')).toHaveCount(3);
  await expect(page.locator('.btv-studio-ledger-entry[data-seq="0"]')).not.toHaveAttribute('data-untrusted', '');
});

test('attestation block on the activation entry with its own download', async ({ page }) => {
  await page.goto('/?studio=1#/auditoria');
  await page.locator('.btv-studio-ledger-entry[data-seq="3"]').click();
  await expect(page.getByText('ATTESTATION', { exact: true })).toBeVisible();
  await expect(page.getByText(/xmlHash:/).first()).toBeVisible();
  await expect(page.getByText('aprovadores: bruna, carla')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'baixar attestation.json' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('attestation.json');
});

test('XES export respects the current filters (§10.5)', async ({ page }) => {
  await page.goto('/?studio=1#/auditoria');
  await page.getByRole('button', { name: 'Aprovações 1' }).click();
  await expect(page.getByRole('option')).toHaveCount(1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar XES' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('ledger-export.xes');
  const path = await download.path();
  const fs = await import('node:fs');
  const content = fs.readFileSync(path!, 'utf8');
  expect(content).toContain('APPROVAL_RECORDED');
  expect(content).not.toContain('NODE_ADDED');
});

test('ledger actions route through the host (diff / abrir no Designer)', async ({ page }) => {
  await page.goto('/?studio=1#/auditoria');
  await page.getByRole('button', { name: 'Ver diff desta mudança' }).click();
  await expect(page.getByTestId('last-action')).toHaveText('diff → seq 0');
  await page.getByRole('button', { name: 'Abrir versão no Designer (leitura)' }).click();
  await expect(page.getByTestId('last-action')).toHaveText('open-designer → seq 0');
});
