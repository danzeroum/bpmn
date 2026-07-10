import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * Pendência #27 / §8.7 — the export is self-contained and rasterizes without a
 * taint. These guard the async asset-embedding pipeline end-to-end in a real
 * browser: a real PNG comes out, and the SVG is well-formed and self-contained.
 */
test('PNG export produces a valid, non-empty raster (#27, §8.7)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export PNG' }).click(),
  ]);
  const path = await download.path();
  const buf = readFileSync(path);
  expect(buf.length).toBeGreaterThan(1000);
  // PNG magic number — proves `toBlob` returned a real raster (no taint).
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});

test('SVG export is well-formed and keeps the diagram content', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export SVG' }).click(),
  ]);
  const svg = readFileSync(await download.path(), 'utf8');
  expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(svg).toContain('data-node-id=');
  // Transient interaction layers never leak into the export.
  expect(svg).not.toContain('data-selection-halo');
});
