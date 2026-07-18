import { expect, test } from '@playwright/test';

/**
 * Handoff 17 ES-2 (§4b) — e2e: item «Subprocesso de evento» da paleta cria o
 * contêiner PONTILHADO com o start tipado DENTRO (1 composto); 1 undo remove
 * tudo.
 */

test('paleta cria contêiner pontilhado com start dentro; 1 undo reverte', async ({ page }) => {
  await page.goto('/?empty=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // 1. Drop do item composto (rótulo i18n PT).
  const item = page.locator('[data-palette-item="eventSubprocess"]');
  await expect(item).toContainText('Subprocesso de evento');
  await item.click();

  // 2. Contêiner pontilhado (geometria SVG) com a tag normativa e o start
  // tipado DENTRO — mesmo composto.
  const sub = page.locator('[data-node-id] rect[stroke-dasharray="2,3"]').first();
  await expect(sub).toBeVisible();
  await expect(page.locator('svg.bpmnr-canvas')).toContainText('event subProcess');
  const start = page.locator('[data-node-type="startEvent"]').first();
  await expect(start).toBeVisible();

  // 3. A seção da E-2 confirma a definição nomeada referenciada (lint-clean).
  await start.dispatchEvent('pointerdown', { button: 0 });
  await page.locator('svg.bpmnr-canvas').dispatchEvent('pointerup', { button: 0 });
  await expect(page.getByTestId('eventdefs-picker')).toHaveValue('msg-1');
  await expect(page.getByTestId('eventdefs-name')).toHaveValue('Nova mensagem');

  // 4. UM undo remove contêiner + start + definição.
  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-node-id]')).toHaveCount(0);
});
