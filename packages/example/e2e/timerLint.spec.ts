import { expect, test } from '@playwright/test';

/**
 * Handoff 16 E-5 (§3d) — critério 8: o dock da U-5 lista TIMER_MALFORMED e
 * EVT_REF_MISSING (política 1.1.0); o quick-fix POR KIND cria e referencia a
 * definição (1 undo); corrigir a expressão no editor de timer limpa o dock.
 */

const selectNode = async (page: import('@playwright/test').Page, id: string) => {
  await page.locator(`[data-node-id="${id}"]`).first().dispatchEvent('pointerdown', { button: 0 });
  await page.locator('svg.bpmnr-canvas').dispatchEvent('pointerup', { button: 0 });
};

test('TIMER_MALFORMED + EVT_REF_MISSING no dock → fix por kind → editor limpa o timer', async ({
  page,
}) => {
  await page.goto('/?timer=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // 1. Dock aberto: as duas findings novas, política 1.1.0 no header.
  await page.getByTestId('lint-toggle').click();
  const panel = page.getByTestId('lint-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('lint-policy')).toContainText('lint-engine@1.4.0');
  await expect(panel.locator('[data-lint-group="timer-malformed"]')).toContainText(
    'TIMER_MALFORMED',
  );
  await expect(panel.locator('[data-lint-group="evt-ref-missing"]')).toContainText(
    'EVT_REF_MISSING',
  );

  // 2. Quick-fix do EVT_REF_MISSING: cria definição de MENSAGEM e referencia.
  await panel.locator('[data-lint-group="evt-ref-missing"] [data-lint-fix]').click();
  await expect(panel.locator('[data-lint-group="evt-ref-missing"]')).toHaveCount(0);
  await selectNode(page, 'm1');
  const picker = page.getByTestId('eventdefs-picker');
  await expect(picker).toHaveValue('msg-1');
  await expect(page.getByTestId('eventdefs-name')).toHaveValue('New message');

  // 3. TIMER_MALFORMED não tem fix mecânico — corrige-se no EDITOR: o aviso
  // glifo+texto está lá (sem preview de palpite), P1H → PT1H limpa tudo.
  await selectNode(page, 't1');
  await expect(page.getByTestId('timer-invalid')).toContainText('Expressão inválida');
  await expect(page.getByTestId('timer-preview')).toHaveCount(0);
  await page.getByTestId('timer-expression').fill('PT1H');
  await page.getByTestId('timer-expression').press('Enter');
  await expect(page.getByTestId('timer-preview')).toHaveText('em 1 hora');
  await expect(panel.locator('[data-lint-group="timer-malformed"]')).toHaveCount(0);

  // 4. 1 undo desfaz o conserto do timer — a finding volta (dock honesto).
  await page.keyboard.press('Control+z');
  await expect(panel.locator('[data-lint-group="timer-malformed"]')).toHaveCount(1);
});
