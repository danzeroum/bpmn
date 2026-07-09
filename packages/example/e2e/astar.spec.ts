import { expect, test } from '@playwright/test';

/**
 * Handoff 10 R-2b — cached A* routing. The `?astar=1` demo makes `astar` the
 * diagram default router and installs a spy plugin that bumps
 * `window.__routerCalls` on every PER-RENDER router call. The central
 * guarantee: cached edges paint from stored waypoints and never re-route, so
 * moving one node touches only its own edges — never the rest of the graph.
 */
const pathOf = (page: import('@playwright/test').Page, edgeId: string) =>
  page.locator(`[data-edge-id="${edgeId}"] path`).first().getAttribute('d');

async function dragBy(
  page: import('@playwright/test').Page,
  nodeId: string,
  dx: number,
  dy: number,
) {
  const node = page.locator(`[data-node-id="${nodeId}"]`);
  const box = (await node.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
  await page.mouse.up();
}

test.describe('A* cached routing (Handoff 10 R-2b)', () => {
  test('a pan never re-routes any cached edge (zero per-render recalc)', async ({ page }) => {
    await page.goto('/?astar=1');
    await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
    await expect(page.locator('[data-edge-id="e01"]')).toBeVisible();
    await expect(page.locator('[data-edge-id="e23"]')).toHaveCount(1);

    // Reset the probe AFTER first paint — cached edges must not route again.
    await page.evaluate(() => {
      window.__routerCalls = 0;
    });

    const canvas = page.locator('svg.bpmnr-canvas');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, i % 2 === 0 ? 160 : -160);
      await page.waitForTimeout(40);
    }

    const calls = await page.evaluate(() => window.__routerCalls ?? 0);
    expect(calls).toBe(0);
  });

  test('dragging one node settles only its edge — the unrelated route is byte-identical', async ({
    page,
  }) => {
    await page.goto('/?astar=1');
    await expect(page.locator('[data-edge-id="e01"]')).toBeVisible();
    await expect(page.locator('[data-edge-id="e23"]')).toHaveCount(1);

    const e01Before = await pathOf(page, 'e01');
    const e23Before = await pathOf(page, 'e23');

    // n1 is an endpoint of e01; e23 (n2→n3) sits far below and must not move.
    await dragBy(page, 'n1', 90, 130);

    await expect
      .poll(async () => pathOf(page, 'e01'))
      .not.toBe(e01Before); // its route settled to the new position
    expect(await pathOf(page, 'e23')).toBe(e23Before); // untouched — zero recalc
  });
});

test.describe('A* settle crossfade — reduced motion (Handoff 10 R-2b)', () => {
  test('snaps instantly with no crossfade overlay, but still caches the route', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?astar=1');
    await expect(page.locator('[data-edge-id="e01"]')).toBeVisible();
    const before = await pathOf(page, 'e01');

    await dragBy(page, 'n1', 90, 130);

    // Route still settles (waypoints are cached regardless of motion)…
    await expect.poll(async () => pathOf(page, 'e01')).not.toBe(before);
    // …but the crossfade overlay is never mounted under reduced motion.
    await expect(page.locator('[data-layer="settling"]')).toHaveCount(0);
  });
});
