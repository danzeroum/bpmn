import { expect, test } from '@playwright/test';

/**
 * Handoff 8 I-2 — assinatura na Revisão do Aprovador + badges de identidade.
 * Drives the real Studio surface: the host wires an Ed25519 Signer (the key is
 * generated in the app, never in the library — cerca §1.1). Covers the sign →
 * verify path and the degradation case (no identity → current behavior + legacy
 * badge). The invalid-signature state is covered at the component level
 * (packages/react promotionPanel.test.tsx) — see pendencias.md §10.
 */

test('sign flow: canonical payload shown before signing, then the verified badge', async ({
  page,
}) => {
  await page.goto('/?studio=1&sign=1#/revisao');
  await expect(page.getByText('PEDIDO DE PROMOÇÃO · CANDIDATE → ACTIVE')).toBeVisible();

  // Payload canônico visível ANTES de assinar (§4).
  const payload = page.getByTestId('review-payload');
  await expect(payload).toContainText('O QUE VOCÊ ESTÁ ASSINANDO');
  await expect(payload).toContainText('decisão: APPROVE (papel process-owner)');

  await page.getByRole('button', { name: '🔏 Assinar aprovação com minha chave' }).click();

  await expect(page.getByText('Aprovação registrada no ledger')).toBeVisible();
  // Verified identity badge (icon + label, not color-only) with the fingerprint.
  const badge = page.locator('.bpmnr-signature-badge[data-verification="valid"]');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('ASSINADA · VERIFICADA');
  await expect(badge).toContainText('ed25519:#');
});

test('degradation without identity: plain approve button and a legacy badge', async ({ page }) => {
  // No `sign=1` → the host wires no Signer (degradation, §4.4).
  await page.goto('/?studio=1#/revisao');
  await expect(page.getByText('PEDIDO DE PROMOÇÃO · CANDIDATE → ACTIVE')).toBeVisible();

  // No signer wired → no payload card, the plain approve button remains.
  await expect(page.getByTestId('review-payload')).toHaveCount(0);
  await page.getByRole('button', { name: 'Aprovar como process-owner' }).click();

  await expect(page.getByText('Aprovação registrada no ledger')).toBeVisible();
  await expect(page.locator('.bpmnr-signature-badge[data-verification="legacy"]')).toBeVisible();
  await expect(page.getByText('NÃO ASSINADA (LEGADO)')).toBeVisible();
});
