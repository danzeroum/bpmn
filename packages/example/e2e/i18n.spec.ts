import { expect, test } from '@playwright/test';

/**
 * Handoff 11 N-6 — i18n via injected dictionary. The example header carries a
 * runtime language toggle (`data-testid="lang-toggle"`) that swaps the
 * `messages` prop between the second official dictionary (PT_BR) and the
 * embedded English fallback (`undefined`). The switch is in-place — no remount,
 * no locale detection: the host decides.
 *
 * The toolbar is the probe: its undo control carries a translated `aria-label`
 * and the validate button translated text. Both must flip when the dictionary
 * is swapped, proving the prop drives every migrated surface at once.
 */
test('swapping the injected dictionary at runtime re-translates the UI', async ({ page }) => {
  await page.goto('/');

  const undo = page.locator('.bpmnr-toolbar button').first();
  const validate = page.locator('.bpmnr-toolbar button[aria-label="Validar diagrama"]');
  const toggle = page.getByTestId('lang-toggle');

  // The demo boots in Portuguese (host default): the SECOND dictionary applies.
  await expect(toggle).toHaveAttribute('data-lang', 'pt');
  await expect(undo).toHaveAttribute('aria-label', 'Desfazer');
  await expect(validate).toBeVisible();
  await expect(validate).toContainText('Validar');

  // Swap to English at runtime — same components, no reload.
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-lang', 'en');
  await expect(undo).toHaveAttribute('aria-label', 'Undo');
  await expect(page.locator('.bpmnr-toolbar button[aria-label="Validate diagram"]')).toContainText(
    'Validate',
  );
  // The Portuguese strings are gone from the toolbar.
  await expect(page.locator('.bpmnr-toolbar button[aria-label="Validar diagrama"]')).toHaveCount(0);

  // And back to Portuguese — the toggle is idempotent.
  await toggle.click();
  await expect(undo).toHaveAttribute('aria-label', 'Desfazer');
});
