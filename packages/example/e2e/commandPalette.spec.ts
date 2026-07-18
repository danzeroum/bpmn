import { expect, test } from '@playwright/test';

/**
 * Handoff 15 §2f — command palette Ctrl/Cmd+K, "?" cheatsheet e estado vazio
 * no app real: agregação dos registros, fuzzy + Enter executa via comando,
 * Esc pela pilha única, cheatsheet gerada da mesma fonte, estado vazio some
 * ao primeiro elemento e o exemplo de 1 clique é um diagrama GOVERNADO.
 */

test('⌘K: fuzzy → Enter executa comando de seleção; Esc fecha pela pilha', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('svg.bpmnr-canvas');
  await expect(canvas).toBeVisible();
  // Seleciona um nó do sample (dispatch para atravessar overlays do demo).
  await page
    .locator('[data-node-id="writer"]')
    .first()
    .dispatchEvent('pointerdown', { button: 0 });
  await canvas.dispatchEvent('pointerup', { button: 0 });

  await page.keyboard.press('Control+k');
  const palette = page.getByTestId('command-palette');
  await expect(palette).toBeVisible();
  await expect(palette.getByRole('listbox')).toBeVisible();

  const before = await page.locator('[data-node-id]').count();
  await page.getByLabel('Buscar comandos').fill('duplicar');
  await expect(palette.locator('[data-cmdk-item="node.duplicate"]')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(palette).toHaveCount(0);
  await expect(page.locator('[data-node-id]')).toHaveCount(before + 1);

  // Undo prova que a execução passou pelo command stack.
  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-node-id]')).toHaveCount(before);

  // Esc pela pilha única: palette aberta fecha primeiro, seleção sobrevive.
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('command-palette')).toHaveCount(0);
  await expect(canvas).toBeVisible();
});

test('cheatsheet "?": atalhos do catálogo + comandos da MESMA fonte da palette', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  await page.keyboard.press('?');
  const sheet = page.getByTestId('cheatsheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('cheatsheet-shortcuts').locator('li')).toHaveCount(18);
  const commandIds = await sheet
    .getByTestId('cheatsheet-commands')
    .locator('[data-command]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-command')));
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await page.keyboard.press('Control+k');
  const paletteIds = await page
    .getByTestId('command-palette')
    .locator('[data-cmdk-item]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-cmdk-item')));
  expect(paletteIds).toEqual(commandIds);
});

test('estado vazio: ensina, some no exemplo GOVERNADO de 1 clique e volta ao esvaziar', async ({
  page,
}) => {
  await page.goto('/?empty=1');
  const empty = page.getByTestId('empty-state');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText('Ctrl/⌘+K');

  await page.getByTestId('empty-state-example').click();
  await expect(page.getByTestId('empty-state')).toHaveCount(0);
  await expect(page.locator('[data-node-id]')).toHaveCount(3);
  // GOVERNADO: selo de versão/status real no chrome do editor.
  const badge = page.locator('.bpmnr-status-badge');
  await expect(badge).toHaveAttribute('data-status', 'draft');
  await expect(badge).toContainText('v1.0.0');

  // Esvaziar (⌘A + Delete) → o estado vazio VOLTA.
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('empty-state')).toBeVisible();
});
