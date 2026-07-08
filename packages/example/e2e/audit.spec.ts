import { expect, test } from '@playwright/test';

/**
 * Handoff 4 §B1: activation records a VERSION_ATTESTED entry in the shared
 * hash-chained ledger, and the "ledger" chip runs a real verification with
 * a popover report.
 */
test('activation records an attestation and the ledger chip verifies the chain', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // Walk the lifecycle to active through the formal promotion flow.
  await page.getByRole('button', { name: '→ test' }).click();
  await page.getByRole('button', { name: '→ candidate' }).click();
  await page.getByRole('button', { name: 'Promover…' }).click();
  const dialog = page.getByRole('dialog', { name: /Ativar v/ });
  await dialog.getByRole('button', { name: 'Aprovar como Owner' }).click();
  await dialog.getByRole('button', { name: 'Aprovar como Compliance' }).click();
  await dialog.getByRole('button', { name: /^Ativar v/ }).click();
  await expect(page.getByRole('status', { name: /Version/ })).toContainText('ATIVA');

  // The attestation is anchored in the same chain the AuditPanel shows.
  await expect(page.locator('.demo-audit')).toContainText('VERSION_ATTESTED');

  // The chip is not decorative: clicking re-verifies the whole chain.
  await page.getByRole('button', { name: 'Verificar ledger' }).click();
  await expect(page.locator('.bpmnr-ledger-popover')).toContainText('Cadeia íntegra ✓');
  await expect(page.getByRole('button', { name: 'Verificar ledger' })).toContainText(
    'ledger íntegro ✓',
  );
});
