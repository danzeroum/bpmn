import { expect, test } from '@playwright/test';

/**
 * Handoff 11 N-4 — o banner "CADEIA ≠ ÂNCORA" no Ledger Explorer
 * (`?studio=1&anchorbroken=1`): verifyLedger (cadeia local íntegra) e a
 * verificação de âncora (head confere com o registro externo) são resultados
 * INDEPENDENTES — o estado divergente mostra os dois, nunca fundidos.
 */
test('CADEIA ≠ ÂNCORA: banner vermelho com índice, trilha não-confiável e ANCHOR_RECORDED', async ({
  page,
}) => {
  await page.goto('/?studio=1&anchorbroken=1#/auditoria');

  // The anchoring act is a first-class trail entry (own category chip).
  await expect(page.getByText('ANCHOR_RECORDED')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verificações 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Verificar cadeia' }).click();

  // INDEPENDENT dimension 1 — the LOCAL chain is intact (5 entries now).
  await expect(page.getByText('Cadeia íntegra (5/5)', { exact: true })).toBeVisible();

  // INDEPENDENT dimension 2 — the anchor diverges: red banner, both heads,
  // the divergence index.
  const banner = page.getByTestId('anchor-banner');
  await expect(banner).toHaveAttribute('data-anchor-state', 'mismatch');
  await expect(banner).toContainText('CADEIA ≠ ÂNCORA');
  await expect(banner).toContainText('divergência a partir da entrada #2');
  await expect(banner).toContainText(`ancorado ${'f'.repeat(12)}`);

  // The divergent entry (#2) and every later one are marked não-confiável
  // (#F7E6E0 via [data-anchor-untrusted]): seqs 2, 3 e 4 (ANCHOR_RECORDED).
  const marked = page.locator('.btv-studio-ledger-entry[data-anchor-untrusted]');
  await expect(marked).toHaveCount(3);
  await expect(marked.first()).toContainText('não-confiável');
});
