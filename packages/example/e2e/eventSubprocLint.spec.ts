import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * Handoff 17 ES-4 (§4d) — critério 6: importar XML SUJO real → 3 findings no
 * dock (EVT_SUBPROC_FLOW + EVT_SUBPROC_START ×2 com mensagens distintas) →
 * quick-fix do 0-starts (builder compartilhado) limpa o item → 1 undo volta.
 */
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'dirty-esub.bpmn');

test('import sujo → 3 findings → quick-fix do 0-starts → dock limpa → 1 undo', async ({ page }) => {
  await page.goto('/?timer=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  // O import de fixture sem DI dispara o alert de warnings do demo.
  page.on('dialog', (dialog) => void dialog.accept());
  await page.locator('.demo-import input[type="file"]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-node-id="esub1"]')).toBeVisible();

  // Dock: política 1.2.0 e os 3 findings do import.
  await page.getByTestId('lint-toggle').click();
  const panel = page.getByTestId('lint-panel');
  await expect(page.getByTestId('lint-policy')).toContainText('lint-etiquette@1.3.0');
  const flow = panel.locator('[data-lint-group="evt-subproc-flow"]');
  await expect(flow).toContainText('EVT_SUBPROC_FLOW');
  await expect(flow).toContainText('"Sem start"');
  const startGroup = panel.locator('[data-lint-group="evt-subproc-start"]');
  await expect(startGroup.locator('li')).toHaveCount(2);
  await expect(startGroup).toContainText('found: 0'); // esub1 — com fix
  await expect(startGroup).toContainText('untyped start'); // esub2 — ✦, sem fix
  await expect(startGroup.locator('[data-lint-fix]')).toHaveCount(1);

  // Quick-fix do 0-starts: start tipado + definição nomeada (builder da
  // paleta ES-2 — uma forma, uma fonte); o item some, o untyped fica.
  await startGroup.locator('[data-lint-fix]').click();
  await expect(startGroup.locator('li')).toHaveCount(1);
  await expect(startGroup).not.toContainText('found: 0');
  await expect(startGroup).toContainText('untyped start');

  // 1 undo: o composto reverte inteiro e a finding volta.
  await page.keyboard.press('Control+z');
  await expect(startGroup.locator('li')).toHaveCount(2);
  await expect(startGroup).toContainText('found: 0');
});
