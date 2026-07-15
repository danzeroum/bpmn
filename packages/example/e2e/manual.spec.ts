import { expect, test } from '@playwright/test';

/**
 * Handoff 10 R-3 — manual routes, edge case 6. The `?manual=1` demo has a
 * pre-authored manual route `m` with a bend and an obstacle parked below n0's
 * exit. Dragging n0 down must translate the route RIGIDLY (keeping its bend)
 * and, once it lands on the obstacle, flag ⚠ — never silently re-route.
 */
const pathOf = (page: import('@playwright/test').Page, edgeId: string) =>
  page.locator(`[data-edge-id="${edgeId}"] path`).first().getAttribute('d');

const warnCount = (page: import('@playwright/test').Page, edgeId: string) =>
  page.locator(`[data-edge-id="${edgeId}"] title`, { hasText: /sem rota livre de obstáculos/i });

async function dragBy(
  page: import('@playwright/test').Page,
  nodeId: string,
  dx: number,
  dy: number,
) {
  const box = (await page.locator(`[data-node-id="${nodeId}"]`).boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
  await page.mouse.up();
}

test.describe('manual routes — edge case 6 (Handoff 10 R-3)', () => {
  test('translates rigidly onto the obstacle and flags ⚠, never re-routing', async ({ page }) => {
    await page.goto('/?manual=1');
    await expect(page.locator('[data-edge-id="m"]')).toHaveCount(1);
    const before = await pathOf(page, 'm');
    await expect(warnCount(page, 'm')).toHaveCount(0); // no collision yet

    await dragBy(page, 'n0', 0, 260); // drag the source straight down onto `obs`

    await expect.poll(async () => pathOf(page, 'm')).not.toBe(before); // it translated
    await expect(warnCount(page, 'm')).toHaveCount(1); // kept manual through the shape → ⚠
  });

  test('an unrelated node move never touches the manual route (§8.3)', async ({ page }) => {
    await page.goto('/?manual=1');
    await expect(page.locator('[data-edge-id="m"]')).toHaveCount(1);
    const before = await pathOf(page, 'm');
    await dragBy(page, 'far', 120, 0);
    expect(await pathOf(page, 'm')).toBe(before);
  });
});
