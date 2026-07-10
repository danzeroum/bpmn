import { expect, test } from '@playwright/test';

/**
 * Handoff 11 N-5 — pluggable context menu. Two flows:
 *
 * 1. KEYBOARD, on the manual-route demo (`?manual=1`): select the manual
 *    edge, open the menu with Shift+F10, Esc pops the MENU first (selection
 *    survives — single dismissal stack), reopen and Enter runs the first
 *    conditional built-in ("Voltar ao automático") — the `📍 rota manual`
 *    badge disappears because the edge really went back to auto via command.
 *
 * 2. PLUGIN SECTION, on the sample diagram (`/`): right-click a node → the
 *    `demo/menu` section (kicker = plugin id) offers "Duplicar nó", whose
 *    `run` dispatches addNodeCommand — one extra node on the canvas.
 */
const MENU = '[data-testid="context-menu"]';

test.describe('context menu (Handoff 11 N-5)', () => {
  test('keyboard: Shift+F10 opens, Esc pops the menu first, Enter runs "Voltar ao automático"', async ({
    page,
  }) => {
    await page.goto('/?manual=1');
    const edge = page.locator('[data-edge-id="m"]');
    await expect(edge).toHaveCount(1);

    // The route is a straight horizontal line, so the group's bbox center
    // sits ON the 12px hit path. Playwright's visibility gate balks at SVG
    // <g> elements, so click through the mouse at the box center instead.
    const box = (await edge.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(edge).toHaveAttribute('data-selected', 'true');
    await expect(page.getByText('📍 rota manual')).toBeVisible(); // manual badge while selected

    await page.keyboard.press('Shift+F10');
    const menu = page.locator(MENU);
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem').first()).toHaveText('Voltar ao automático');

    // Esc pops the MENU first — the selection is untouched (dismissal stack).
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(edge).toHaveAttribute('data-selected', 'true');

    // Reopen and run the first item with Enter: the edge goes back to auto,
    // so the manual badge disappears (still selected — only the route mode
    // changed, via ONE command).
    await page.keyboard.press('Shift+F10');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveCount(0);
    await expect(page.getByText('📍 rota manual')).toHaveCount(0);
    await expect(edge).toHaveAttribute('data-selected', 'true');
  });

  test('plugin section: right-click a node → "Duplicar nó" under the demo/menu kicker adds a node', async ({
    page,
  }) => {
    await page.goto('/');
    const writer = page.locator('[data-node-id="writer"]');
    await expect(writer).toHaveCount(1);
    const before = await page.locator('[data-node-id]').count();

    // Right-click the pill shape itself (the group bbox includes the label,
    // whose center can miss every child element — N-1 lesson).
    await writer.locator('rect').first().click({ button: 'right' });
    const menu = page.locator(MENU);
    await expect(menu).toBeVisible();
    await expect(menu.locator('.bpmnr-context-menu-kicker')).toHaveText('demo/menu');

    await menu.getByRole('menuitem', { name: 'Duplicar nó' }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.locator('[data-node-id]')).toHaveCount(before + 1);
    await expect(page.getByRole('button', { name: 'btv:persona: Writer (cópia)' })).toBeVisible();
  });
});
