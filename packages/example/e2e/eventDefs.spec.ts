import { expect, test } from '@playwright/test';

/**
 * Handoff 16 E-2 — fluxo completo da régua 5: criar pelo «+» → usar em 2
 * eventos → renomear (cascata) → ver lista de usos → tentar excluir (veto
 * com lista) → trocar ref → excluir.
 */

const selectNode = async (page: import('@playwright/test').Page, id: string) => {
  await page.locator(`[data-node-id="${id}"]`).first().dispatchEvent('pointerdown', { button: 0 });
  await page.locator('svg.bpmnr-canvas').dispatchEvent('pointerup', { button: 0 });
};

test('criar → usar em 2 → renomear → ver lista → veto → trocar ref → excluir', async ({ page }) => {
  await page.goto('/?events=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // 1. Criar pelo «+» no m1 — UM composto: definição criada E referenciada.
  await selectNode(page, 'm1');
  const picker = page.getByTestId('eventdefs-picker');
  await expect(picker).toHaveValue('');
  await page.getByTestId('eventdefs-add').click();
  await expect(picker).toHaveValue('msg-1');
  await expect(page.getByTestId('eventdefs-name')).toHaveValue('Nova mensagem');

  // 2. Usar no m2 pelo picker.
  await selectNode(page, 'm2');
  await picker.selectOption('msg-1');
  await expect(picker).toHaveValue('msg-1');

  // 3. Renomear em m2 → cascata visível em m1.
  await page.getByTestId('eventdefs-name').fill('Aprovação do pedido');
  await page.getByTestId('eventdefs-name').press('Enter');
  await selectNode(page, 'm1');
  await expect(page.getByTestId('eventdefs-name')).toHaveValue('Aprovação do pedido');

  // 4. Lista de usos honesta.
  const usages = page.getByTestId('eventdefs-usages');
  await expect(usages).toContainText('Usada por 2 eventos');
  await expect(usages).toContainText('Aguardar confirmação');

  // 5. Tentar excluir → veto do core no canal lastVeto (🔒 na toolbar).
  await page.getByTestId('eventdefs-delete').click();
  await expect(page.locator('.bpmnr-toolbar-veto')).toContainText(
    'Definição em uso por 2 evento(s)',
  );
  await expect(picker).toHaveValue('msg-1'); // nada excluído em silêncio

  // 6. Trocar as refs — a definição GERENCIADA sobrevive ao desvincular, o
  // veto segue honesto a cada tentativa, e com zero usos a exclusão libera.
  await picker.selectOption('');
  await expect(usages).toContainText('Usada por 1 evento'); // só m2 agora
  await page.getByTestId('eventdefs-delete').click();
  await expect(page.locator('.bpmnr-toolbar-veto')).toContainText('1 evento(s)');
  await selectNode(page, 'm2');
  await picker.selectOption('');
  await expect(usages).toContainText('Nenhum outro evento usa esta definição.');
  await page.getByTestId('eventdefs-delete').click();
  // Definição excluída: bloco some e o picker fica sem a opção.
  await expect(page.getByTestId('eventdefs-delete')).toHaveCount(0);
  const options = await picker.locator('option').allTextContents();
  expect(options.join(' ')).not.toContain('Aprovação do pedido');
});
