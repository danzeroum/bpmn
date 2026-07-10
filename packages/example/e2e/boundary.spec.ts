import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Handoff 11 N-1 — boundary drag-to-attach + reflow por t (pendências §6).
 * `?boundary=1`: a host task and a LOOSE intermediate timer. Attach by drag
 * (border highlight → drop = ONE undoable command), host resize preserves the
 * parametric t, drag-out detaches, and undo reverts each gesture atomically.
 *
 * Geometry notes: node GROUP boxes include labels/ports, so assertions use
 * the inner SHAPE boxes (host body rect, timer ring circle); grab points stay
 * off the side midpoints, where the connection ports live.
 */
const center = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

function hostRect(page: Page): Locator {
  return page.locator('[data-node-id="host"] rect').first();
}

function timerRing(page: Page): Locator {
  return page.locator('[data-node-id="timer"] circle').first();
}

/** A grab point inside the host body, away from the port midpoints. */
async function hostGrabPoint(page: Page) {
  const hb = (await hostRect(page).boundingBox())!;
  return { x: hb.x + hb.width * 0.3, y: hb.y + hb.height * 0.35 };
}

async function attachToBottomCenter(page: Page) {
  const tb = (await timerRing(page).boundingBox())!;
  const hb = (await hostRect(page).boundingBox())!;
  const from = center(tb);
  const to = { x: hb.x + hb.width / 2, y: hb.y + hb.height };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  // Inside the 12px snap zone the host border highlights.
  await expect(page.getByTestId('boundary-snap-highlight')).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId('boundary-snap-highlight')).toHaveCount(0);
}

/** Asserts the timer ring is centered on the host's bottom border midpoint. */
async function expectOnBottomCenter(page: Page, tolerance = 6) {
  const hb = (await hostRect(page).boundingBox())!;
  const tb = (await timerRing(page).boundingBox())!;
  expect(Math.abs(center(tb).x - (hb.x + hb.width / 2))).toBeLessThan(tolerance);
  expect(Math.abs(center(tb).y - (hb.y + hb.height))).toBeLessThan(tolerance);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?boundary=1');
  await expect(page.locator('[data-node-id="timer"]')).toBeVisible();
});

test('attach by drag: highlight in the snap zone, drop lands on the border, undo reverts', async ({ page }) => {
  const before = (await timerRing(page).boundingBox())!;

  await attachToBottomCenter(page);
  await expectOnBottomCenter(page);

  // ONE undo reverts the whole gesture (type + anchor + position).
  await page.keyboard.press('Control+z');
  const reverted = (await timerRing(page).boundingBox())!;
  expect(Math.abs(reverted.x - before.x)).toBeLessThan(6);
  expect(Math.abs(reverted.y - before.y)).toBeLessThan(6);
});

test('host resize preserves t: the boundary reflows proportionally in the SAME command', async ({ page }) => {
  await attachToBottomCenter(page); // t = 0.5, bottom
  const hb = (await hostRect(page).boundingBox())!;

  // Select the host (grab point off the ports) and drag its SE handle right.
  const grab = await hostGrabPoint(page);
  await page.mouse.click(grab.x, grab.y);
  const handle = page.locator('[data-node-id="host"] [data-resize-corner="se"]');
  await expect(handle).toBeVisible();
  const hbox = (await handle.boundingBox())!;
  await page.mouse.move(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2);
  await page.mouse.down();
  await page.mouse.move(hbox.x + hbox.width / 2 + 80, hbox.y + hbox.height / 2, { steps: 5 });
  await page.mouse.up();

  // t = 0.5 over the NEW width — the boundary sits at the new bottom middle.
  const hb2 = (await hostRect(page).boundingBox())!;
  expect(hb2.width).toBeGreaterThan(hb.width + 40);
  await expectOnBottomCenter(page);

  // ONE undo reverts resize + reflow together (atomic composite).
  await page.keyboard.press('Control+z');
  const hb3 = (await hostRect(page).boundingBox())!;
  expect(Math.abs(hb3.width - hb.width)).toBeLessThan(3);
  await expectOnBottomCenter(page);
});

test('drag out detaches (stops riding the host); undo restores the attachment', async ({ page }) => {
  await attachToBottomCenter(page);

  // Drag the boundary far from any border → detach.
  const tb = (await timerRing(page).boundingBox())!;
  const from = center(tb);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 220, from.y + 160, { steps: 8 });
  await expect(page.getByTestId('boundary-snap-highlight')).toHaveCount(0);
  await page.mouse.up();

  // Detached: moving the host no longer carries the event.
  const detached = (await timerRing(page).boundingBox())!;
  const grab = await hostGrabPoint(page);
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x - 60, grab.y, { steps: 5 });
  await page.mouse.up();
  const hbMoved = (await hostRect(page).boundingBox())!;
  expect(Math.abs(hbMoved.x - (grab.x - 60 - 0.3 * hbMoved.width))).toBeLessThan(20); // host really moved
  const after = (await timerRing(page).boundingBox())!;
  expect(Math.abs(after.x - detached.x)).toBeLessThan(3);
  expect(Math.abs(after.y - detached.y)).toBeLessThan(3);

  // Undo the host move, then undo the detach → attached again, on the border.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expectOnBottomCenter(page);
});
