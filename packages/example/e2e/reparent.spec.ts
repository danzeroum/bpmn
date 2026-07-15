import { expect, test } from '@playwright/test';

/**
 * F7 reparent-on-drop, end to end on the demo. The 'returns' sub-process
 * starts collapsed with two children; 'billing' is a top-level call activity.
 * Dragging 'billing' into the expanded sub-process must make containment REAL
 * — not just visual overlap — so collapse hides it, drill shows it, the
 * container carries it, and the export nests it (the PR 1 round-trip contract).
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
});

/** Drag 'billing' into the body of the (already expanded) 'returns'. */
async function dropBillingIntoReturns(page: import('@playwright/test').Page) {
  const returns = page.locator('[data-node-id="returns"]');
  const billing = page.locator('[data-node-id="billing"]');
  const rb = (await returns.boundingBox())!;
  const bb = (await billing.boundingBox())!;
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  // Below the title strip, in the container body.
  await page.mouse.move(rb.x + rb.width * 0.5, rb.y + rb.height * 0.6, { steps: 12 });
  await page.mouse.up();
}

test('drop into an expanded sub-process makes containment real (collapse hides it)', async ({
  page,
}) => {
  await page.locator('[data-node-id="returns"] [data-subprocess-toggle]').click();
  await expect(page.locator('[data-node-id="returnsInspect"]')).toBeVisible();

  await dropBillingIntoReturns(page);
  await expect(page.locator('[data-node-id="billing"]')).toBeVisible();

  // Collapse: a plain overlap would stay visible; a real child disappears.
  await page.locator('[data-node-id="returns"] [data-subprocess-toggle]').click();
  await expect(page.locator('[data-node-id="billing"]')).toHaveCount(0);

  // Drill in: the reparented node is now among the sub-process contents.
  await page.locator('[data-node-id="returns"] [data-subprocess-drill]').click();
  await expect(page.locator('[data-node-id="billing"]')).toBeVisible();
  await expect(page.locator('[data-node-id="returns"]')).toHaveCount(0);
});

test('the container carries a freshly reparented child (ride-along)', async ({ page }) => {
  await page.locator('[data-node-id="returns"] [data-subprocess-toggle]').click();
  await dropBillingIntoReturns(page);

  const billing = page.locator('[data-node-id="billing"]');
  const before = await billing.getAttribute('transform');
  const returns = page.locator('[data-node-id="returns"]');
  const rb = (await returns.boundingBox())!;
  // Grab the container by its title strip (far-left, clear of its children)
  // and drag it; the freshly reparented child must move with it.
  await page.mouse.move(rb.x + 40, rb.y + 8);
  await page.mouse.down();
  await page.mouse.move(rb.x + 40 - 130, rb.y + 8 + 90, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => billing.getAttribute('transform')).not.toBe(before);
});

test('dragging the child back out un-nests it (undoable)', async ({ page }) => {
  await page.locator('[data-node-id="returns"] [data-subprocess-toggle]').click();
  await dropBillingIntoReturns(page);

  // Drag billing out to empty canvas (upper-left, clear of every node).
  const billing = page.locator('[data-node-id="billing"]');
  const bb = (await billing.boundingBox())!;
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(140, 120, { steps: 12 });
  await page.mouse.up();

  // No longer a child: undoing the drag-out (its own gesture) re-nests it, so
  // collapsing the sub-process hides it again.
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await page.locator('[data-node-id="returns"] [data-subprocess-toggle]').click();
  await expect(billing).toHaveCount(0);
});

test('context menu removes a child from the sub-process by keyboard (a11y path)', async ({
  page,
}) => {
  // Expand 'returns' so its child 'returnsInspect' is on the canvas.
  await page.locator('[data-node-id="returns"] [data-subprocess-toggle]').click();
  const child = page.locator('[data-node-id="returnsInspect"]');
  await expect(child).toBeVisible();

  // Select the child, open the menu with the keyboard, run "Remover do subprocesso".
  const box = (await child.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press('Shift+F10');
  const menu = page.locator('[data-testid="context-menu"]');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Remover do subprocesso' }).click();

  // Clear the selection first — the child's context pad floats beside it and
  // would otherwise sit over the sub-process toggle.
  await page.keyboard.press('Escape');

  // No longer a child: collapsing 'returns' leaves it on the canvas.
  await page.locator('[data-node-id="returns"] [data-subprocess-toggle]').click();
  await expect(child).toBeVisible();
});

test('the reparented result exports nested inside the sub-process (PR 1 contract)', async ({
  page,
}) => {
  await page.locator('[data-node-id="returns"] [data-subprocess-toggle]').click();
  await dropBillingIntoReturns(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar BPMN XML' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const xml = Buffer.concat(chunks).toString('utf8');

  // billing nests INSIDE <bpmn:subProcess id="returns"> … </bpmn:subProcess>.
  const start = xml.indexOf('<bpmn:subProcess id="returns"');
  const end = xml.indexOf('</bpmn:subProcess>', start);
  expect(start).toBeGreaterThan(-1);
  expect(xml.slice(start, end)).toContain('id="billing"');
  // parentId stays structural, never a leaked property.
  expect(xml).not.toContain('name="parentId"');
});
