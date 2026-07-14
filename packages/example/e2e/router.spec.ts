import { expect, test } from '@playwright/test';

/**
 * Handoff 10 R-4 — clear routing, parallel corridors, fallback recovery.
 */
const warnCount = (page: import('@playwright/test').Page, edgeId: string) =>
  page.locator(`[data-edge-id="${edgeId}"] title`, { hasText: /sem rota livre de obstáculos/i });

const firstPoint = async (page: import('@playwright/test').Page, edgeId: string) => {
  const d = (await page.locator(`[data-edge-id="${edgeId}"] path`).first().getAttribute('d')) ?? '';
  const m = d.match(/M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
};

async function dragBy(page: import('@playwright/test').Page, nodeId: string, dx: number, dy: number) {
  const box = (await page.locator(`[data-node-id="${nodeId}"]`).boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
  await page.mouse.up();
}

test.describe('fallback recovery — edge case 4 (Handoff 10 R-4)', () => {
  test('a no-corridor route self-heals when the obstacle is dragged away', async ({ page }) => {
    await page.goto('/?fallback=1');
    await expect(page.locator('[data-edge-id="fb"]')).toHaveCount(1);
    await expect(warnCount(page, 'fb')).toHaveCount(1); // ⚠ on load

    await dragBy(page, 'cage', 0, 320); // move the cage far below

    await expect(warnCount(page, 'fb')).toHaveCount(0); // recovered, no action needed
  });

  test('"Limpar roteamento" runs and surfaces a toast', async ({ page }) => {
    await page.goto('/?fallback=1');
    await expect(page.locator('[data-action="clear-routing"]')).toBeVisible();
    await page.locator('[data-action="clear-routing"]').click();
    await expect(page.locator('[data-testid="routing-toast"]')).toBeVisible();
  });
});

test.describe('parallel corridors — edge case 5 (Handoff 10 R-4)', () => {
  test('fan-out siblings leave the gateway in distinct lanes ordered by target', async ({ page }) => {
    await page.goto('/?fanout=1');
    await expect(page.locator('[data-edge-id="e1"]')).toHaveCount(1);

    const p1 = await firstPoint(page, 'e1');
    const p2 = await firstPoint(page, 'e2');
    const p3 = await firstPoint(page, 'e3');
    // All exit the same (right) border of the gateway…
    expect(p1!.x).toBeCloseTo(p2!.x, 1);
    expect(p2!.x).toBeCloseTo(p3!.x, 1);
    // …at distinct exit points ordered by target Y (no crossing between siblings).
    expect(p1!.y).toBeLessThan(p2!.y);
    expect(p2!.y).toBeLessThan(p3!.y);
  });
});
