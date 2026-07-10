import { expect, test } from '@playwright/test';

/**
 * Handoff 11 N-7 — the standalone lightweight viewer (`?viewer=1`, imported from
 * `@buildtovalue/react/viewer`). It renders a governed diagram read-only with
 * pan + wheel-zoom and the governance seal, and carries none of the editor
 * chrome (no toolbar, palette, inspector, ports).
 */
test('standalone viewer: renders a governed diagram with pan/zoom and the seal', async ({
  page,
}) => {
  await page.goto('/?viewer=1');

  const canvas = page.locator('svg.bpmnr-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('[data-node-id]').first()).toBeVisible();

  // Governance seal (selo): the read-only version banner paints only in a
  // read-only / superseded context, so its presence proves the viewer is
  // read-only and shows the seal.
  await expect(page.locator('.bpmnr-version-banner')).toBeVisible();

  // No editor chrome — this is a viewer, not a disabled editor.
  await expect(page.locator('.bpmnr-toolbar')).toHaveCount(0);
  await expect(page.locator('.bpmnr-palette')).toHaveCount(0);
  await expect(page.locator('.bpmnr-inspector')).toHaveCount(0);
  await expect(page.locator('[data-ports]')).toHaveCount(0);

  const box = (await canvas.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // Wheel-zoom changes the viewBox.
  const initial = await canvas.getAttribute('viewBox');
  await page.mouse.move(center.x, center.y);
  await page.mouse.wheel(0, -400);
  await expect.poll(() => canvas.getAttribute('viewBox')).not.toBe(initial);

  // Drag-pan moves the viewBox origin (the svg owns the gesture — nodes have no
  // edit handlers to intercept it).
  const zoomed = await canvas.getAttribute('viewBox');
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x - 160, center.y - 120, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => canvas.getAttribute('viewBox')).not.toBe(zoomed);
});
