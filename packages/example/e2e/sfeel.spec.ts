import { expect, test } from '@playwright/test';

/**
 * Handoff 9 SF-2 — businessRuleTask routes through the S-FEEL evaluator.
 * `?sfeel=1`: the token pauses at the decision, the card collects `amount`,
 * the table fires and the output label routes the token. `&bad=1`: the first
 * cell is `date(...)` — outside the subset — so the run STOPS with the honest
 * ⚠ warning naming the cell (acceptance §8.4: "simulador para com o aviso").
 */
test('routes the token by the decision output (amount 50 → auto)', async ({ page }) => {
  await page.goto('/?sfeel=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // Advance start → businessRuleTask, where the input card appears.
  await page.getByRole('button', { name: /Avançar|Próximo passo/ }).click();
  const card = page.getByTestId('decision-input-card');
  await expect(card).toBeVisible();

  await card.locator('input').fill('50');
  await card.getByRole('button', { name: 'Avaliar tabela' }).click();

  // The trail records the fired rule and the token took the "auto" flow.
  await expect(page.locator('.bpmnr-sim-panel-slot')).toContainText(/fired rule 1/);
  await expect(page.getByTestId('decision-input-card')).toHaveCount(0);
});

test('stops honestly on a date() cell outside the subset (&bad=1)', async ({ page }) => {
  await page.goto('/?sfeel=1&bad=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  await page.getByRole('button', { name: /Avançar|Próximo passo/ }).click();
  const card = page.getByTestId('decision-input-card');
  await expect(card).toBeVisible();
  await card.locator('input').fill('50');
  await card.getByRole('button', { name: 'Avaliar tabela' }).click();

  // The declared stop: ⚠ warning naming the offending cell + the reason,
  // linking to the documented subset. No route was guessed.
  const notice = page.getByTestId('decision-blocked');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('não-simulável');
  await expect(notice).toContainText('date(');
  await expect(notice).toContainText(/function invocation/);
  await expect(notice.getByRole('link', { name: 'limitations.md' })).toBeVisible();
});
