import { expect, test } from '@playwright/test';

/**
 * Handoff 16 E-3 — critério 8: vincular da Biblioteca → selo ✓ VIGENTE →
 * trocar para candidata (⚠ + entrada no ledger via cola command.executed) →
 * pin órfão pré-semeado (m3) → SIG_REF_MISSING com badge no Validate.
 */

const selectNode = async (page: import('@playwright/test').Page, id: string) => {
  await page.locator(`[data-node-id="${id}"]`).first().dispatchEvent('pointerdown', { button: 0 });
  await page.locator('svg.bpmnr-canvas').dispatchEvent('pointerup', { button: 0 });
};

const datasetOf = (page: import('@playwright/test').Page, key: string) =>
  page.evaluate((k) => document.body.dataset[k], key);

test('vincular → VIGENTE → candidata ⚠ → SIG_REF_MISSING, com auditoria a cada troca', async ({
  page,
}) => {
  await page.goto('/?events=1&lib=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // 1. Vincular m1 pela seção "Da Biblioteca" do picker.
  await selectNode(page, 'm1');
  const picker = page.getByTestId('eventdefs-picker');
  await expect(picker.locator('optgroup[label="Da Biblioteca"] option')).toContainText([
    'pedido.aprovado@1.0.0',
  ]);
  await picker.selectOption('bind:pedido.aprovado@1.0.0');

  // Selo ✓ VIGENTE + chip no canvas com o pin.
  const seal = page.getByTestId('eventdefs-seal');
  await expect(seal).toHaveText('✓ VIGENTE');
  const chip = page.locator('[data-event-binding="m1"]');
  await expect(chip).toHaveAttribute('data-binding-state', 'active');
  await expect(chip).toContainText('pedido.aprovado@1.0.0');

  // Reforço 10: o espelho gov-* é read-only, com o aviso da Biblioteca.
  await expect(page.getByTestId('eventdefs-name')).toBeDisabled();
  await expect(page.getByTestId('eventdefs-mirror-notice')).toContainText(
    'Gerenciada pela Biblioteca',
  );

  // Cola do ledger (critério 4): a troca gerou a entrada auditável.
  await expect.poll(() => datasetOf(page, 'eventBindingChanges')).toBe('1');
  expect(await datasetOf(page, 'lastEventBinding')).toBe('m1:→pedido.aprovado@1.0.0');

  // 2. Trocar para a versão candidata: ⚠ CANDIDATA + auditoria com from→to.
  await picker.selectOption('bind:pedido.aprovado@2.0.0');
  await expect(seal).toHaveText('⚠ CANDIDATA');
  await expect(chip).toHaveAttribute('data-binding-state', 'stale');
  await expect.poll(() => datasetOf(page, 'eventBindingChanges')).toBe('2');
  expect(await datasetOf(page, 'lastEventBinding')).toBe(
    'm1:pedido.aprovado@1.0.0→pedido.aprovado@2.0.0',
  );

  // 3. m3 chega pré-vinculado a um pin que o catálogo não conhece.
  const orphanChip = page.locator('[data-event-binding="m3"]');
  await expect(orphanChip).toHaveAttribute('data-binding-state', 'missing');
  await selectNode(page, 'm3');
  await expect(page.getByTestId('eventdefs-seal')).toHaveText('✕ NÃO RESOLVIDA');

  // 4. Validate: erro SIG_REF_MISSING no m3, warning SIG_REF_STALE no m1 —
  // badge com código estável, glifo+texto (nunca só cor).
  await page.getByRole('button', { name: 'Validar diagrama' }).click();
  const m3 = page.locator('[data-node-id="m3"]');
  await expect(m3).toHaveAttribute('data-node-issue-state', 'error');
  await expect(m3.locator('[data-node-issue-code]')).toHaveText('SIG_REF_MISSING');
  const m1 = page.locator('[data-node-id="m1"]');
  await expect(m1).toHaveAttribute('data-node-issue-state', 'warning');
});
