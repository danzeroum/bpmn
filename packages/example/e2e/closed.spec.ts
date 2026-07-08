import { expect, test } from '@playwright/test';

/**
 * Handoff 5 F-C1 (variante 5b mitigada, aceite 10.5.6): closed elements at
 * scale — always-on hatch from ONE shared pattern def, seal only on
 * hover/selection, and the fixed version banner whenever the surface is not
 * the editable active line.
 */
test('superseded snapshot shows hatch, hover-gated seal and the version banner', async ({
  page,
}) => {
  await page.goto('/?closed=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // Version banner: fixed, top-left, with count.
  const banner = page.locator('[data-version-banner]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('VISUALIZANDO v0.2.0');
  await expect(banner).toContainText('somente leitura');
  await expect(banner).toContainText('10 elementos fechados nesta versão');

  // ONE pattern def per SVG, N hatched nodes using it (4 visible: the two
  // closed children live inside the collapsed 'returns' sub-process).
  expect(await page.locator('pattern#bpmnr-closed-hatch').count()).toBe(1);
  expect(await page.locator('[data-node-closed-hatch]').count()).toBe(4);

  // No seal without interaction — 30+ closed must never become confetti.
  await expect(page.locator('[data-closed-seal]')).toHaveCount(0);

  // Hover shows the seal for that node only; leaving hides it.
  const writer = page.locator('[data-node-id="writer"]');
  await writer.scrollIntoViewIfNeeded();
  await writer.hover();
  await expect(page.locator('[data-closed-seal]')).toHaveCount(1);
  await expect(page.locator('[data-closed-seal]')).toContainText('FECHADO v0.2.0');
  await page.mouse.move(4, 4);
  await expect(page.locator('[data-closed-seal]')).toHaveCount(0);

  // Selection shows it too (touch parity — no hover required).
  await writer.click();
  await expect(page.locator('[data-node-id="writer"] [data-closed-seal]')).toBeVisible();
});

/** Perf canary with 30+ closed elements in frame (aceite 10.5.6). */
test('holds the fps floor with 40 hatched elements at 350 nodes', async ({ page }) => {
  test.slow();
  await page.goto('/?stress=350&closed=40');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  expect(await page.locator('[data-node-closed-hatch]').count()).toBeGreaterThanOrEqual(30);
  expect(await page.locator('pattern#bpmnr-closed-hatch').count()).toBe(1);

  const canvas = page.locator('svg.bpmnr-canvas');
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  const fpsPromise = page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames += 1;
          const elapsed = performance.now() - start;
          if (elapsed < 3200) requestAnimationFrame(tick);
          else resolve((frames * 1000) / elapsed);
        };
        requestAnimationFrame(tick);
      }),
  );

  await page.keyboard.down(' ');
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 0; i < 8; i++) {
    const dx = (i % 2 === 0 ? 1 : -1) * 220;
    await page.mouse.move(cx + dx, cy + (i % 2 === 0 ? 90 : -90), { steps: 10 });
  }
  await page.mouse.up();
  await page.keyboard.up(' ');
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 140);
    await page.waitForTimeout(60);
  }
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, -140);
    await page.waitForTimeout(60);
  }

  const fps = await fpsPromise;
  console.log(`[perf] 350 nodes + 40 closed: ${fps.toFixed(1)} fps (CI floor 15, target 60)`);
  expect(fps).toBeGreaterThanOrEqual(15);
});
