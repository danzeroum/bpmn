import { expect, test } from '@playwright/test';

/**
 * F7-2: sub-process expand/collapse and drill-down with breadcrumb on the
 * demo's 'Handle returns' sub-process (collapsed by default, two children).
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
});

test('expands and collapses a sub-process in place (undoable)', async ({ page }) => {
  const sub = page.locator('[data-node-id="returns"]');
  await expect(sub).toBeVisible();
  await expect(page.locator('[data-node-id="returnsInspect"]')).toHaveCount(0);
  await expect(page.locator('[data-edge-id="r1"]')).toHaveCount(0);

  await sub.locator('[data-subprocess-toggle]').click();
  await expect(page.locator('[data-node-id="returnsInspect"]')).toBeVisible();
  await expect(page.locator('[data-edge-id="r1"]')).toBeVisible();

  // The toggle went through the command stack: undo folds it back up.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('[data-node-id="returnsInspect"]')).toHaveCount(0);
});

test('drills into a sub-process and navigates back with the breadcrumb', async ({ page }) => {
  await page.locator('[data-node-id="returns"] [data-subprocess-drill]').click();

  // Only the sub-process contents are on the canvas.
  await expect(page.locator('[data-node-id="returnsInspect"]')).toBeVisible();
  await expect(page.locator('[data-node-id="returnsRefund"]')).toBeVisible();
  await expect(page.locator('[data-node-id="returns"]')).toHaveCount(0);
  await expect(page.locator('[data-node-id="publish"]')).toHaveCount(0);

  const breadcrumb = page.getByRole('navigation', { name: 'Sub-process navigation' });
  await expect(breadcrumb).toContainText('Handle returns');

  await breadcrumb.getByRole('button', { name: 'Back to process' }).click();
  await expect(page.locator('[data-node-id="returns"]')).toBeVisible();
  await expect(page.locator('[data-node-id="publish"]')).toBeVisible();
  await expect(page.locator('[data-node-id="returnsInspect"]')).toHaveCount(0);
  await expect(breadcrumb).toHaveCount(0);
});

test('dragging an expanded sub-process carries its children', async ({ page }) => {
  const sub = page.locator('[data-node-id="returns"]');
  await sub.locator('[data-subprocess-toggle]').click();
  const child = page.locator('[data-node-id="returnsInspect"]');
  await expect(child).toBeVisible();
  const before = await child.getAttribute('transform');

  const box = (await sub.boundingBox())!;
  // Grab the container near its title strip (children cover the middle).
  await page.mouse.move(box.x + box.width / 2, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + 72, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => child.getAttribute('transform')).not.toBe(before);
});

test('shows the dotted data association once the sub-process is expanded', async ({ page }) => {
  // Hidden while the refund step (its source) is behind the [+] marker.
  await expect(page.locator('[data-edge-id="d1"]')).toHaveCount(0);
  await page.locator('[data-node-id="returns"] [data-subprocess-toggle]').click();
  const line = page.locator('[data-edge-id="d1"] path[marker-end]');
  await expect(line).toHaveAttribute('stroke-dasharray', '2,4');
  await expect(line).toHaveAttribute('marker-end', 'url(#bpmnr-edge-open)');
});
