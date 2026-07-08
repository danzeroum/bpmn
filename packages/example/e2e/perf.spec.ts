import { expect, test } from '@playwright/test';

/**
 * Craft-pack NFR: 60fps with ~350 nodes (Handoff 3 §8.5). The floor below is
 * a REGRESSION CANARY, not the NFR: shared GitHub runners rasterize in
 * software (~26fps observed on ubuntu-latest; ~41fps in a beefier headless
 * container), so CI asserts a level that only trips on real regressions
 * (e.g. per-frame re-render of all nodes lands under 10fps) and prints the
 * measured value. The 60fps target is verified on real hardware
 * (pendencias.md §8).
 */
const NODES = 350;
const MIN_FPS = 15;

test('pans and zooms a 350-node diagram above the fps floor', async ({ page }) => {
  test.slow();
  await page.goto(`/?stress=${NODES}`);
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  await expect(page.locator('[data-node-id]')).toHaveCount(NODES);
  // Shadows are on at 100% zoom (activities/cards cast them).
  expect(await page.locator('svg.bpmnr-canvas g[filter]').count()).toBeGreaterThan(0);

  const canvas = page.locator('svg.bpmnr-canvas');
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Count rAF frames while the interactions below are running.
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

  // ~1.6s of panning (space + left drag), back and forth.
  await page.keyboard.down(' ');
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 0; i < 8; i++) {
    const dx = (i % 2 === 0 ? 1 : -1) * 220;
    await page.mouse.move(cx + dx, cy + (i % 2 === 0 ? 90 : -90), { steps: 10 });
  }
  await page.mouse.up();
  await page.keyboard.up(' ');

  // ~1.6s of wheel zoom out/in at the center.
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 140);
    await page.waitForTimeout(60);
  }
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, -140);
    await page.waitForTimeout(60);
  }

  const fps = await fpsPromise;
  console.log(`[perf] ${NODES} nodes: ${fps.toFixed(1)} fps (CI floor ${MIN_FPS}, target 60)`);
  expect(fps).toBeGreaterThanOrEqual(MIN_FPS);
});

test('drops node shadows below the semantic-zoom threshold', async ({ page }) => {
  await page.goto('/?stress=48');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  await expect(page.locator('[data-node-id]')).toHaveCount(48);
  expect(await page.locator('svg.bpmnr-canvas g[filter]').count()).toBeGreaterThan(0);

  // Zoom out well past 50% (viewport width > 2400 ⇒ zoom < 0.5).
  const canvas = page.locator('svg.bpmnr-canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 16; i++) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(30);
  }

  await expect(page.locator('svg.bpmnr-canvas g[filter]')).toHaveCount(0);
});
