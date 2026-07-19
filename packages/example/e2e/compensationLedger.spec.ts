import { expect, test } from '@playwright/test';

/**
 * Handoff 19 §6e (e2e do fluxo completo) — a «pacote de viagem»: avançar até
 * hotel + passagem + cartão completarem → o card «Compensar» prevê o broadcast
 * com a CONTAGEM (2 handlers: hotel + passagem; o cartão não tem ⟲) → disparar
 * reverte na ORDEM inversa nomeando atividade → handler, e o cartão é uma linha
 * uncompensated DECLARADA. O host appenda `compensationTriggeredEntry` amarrando
 * o plano EXECUTADO (compensated reverso + uncompensated) com o selo ✦ (autor
 * IA). A superfície roda em pt-BR; a trilha do motor é inglesa.
 */
test('avançar → broadcast reverso → uncompensated declarado → entrada no ledger com ✦', async ({ page }) => {
  await page.goto('/?compensation=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  const advance = page.locator('[data-sim-advance]');
  const trail = page.locator('[data-sim-trail]');

  // Avançar até completar hotel → passagem → cartão (start→hotel→flight→card→end).
  await advance.click(); // start → hotel
  await advance.click(); // hotel → flight  (hotel completou)
  await advance.click(); // flight → card   (passagem completou)
  await advance.click(); // card → end      (cartão completou, sem ⟲)

  const card = page.locator('[data-sim-compensate-card]');
  await expect(card).toBeVisible();
  // Broadcast prevê a CONTAGEM: só hotel + passagem têm handler (o cartão não tem ⟲).
  const broadcast = card.locator('[data-sim-compensate=""]');
  await expect(broadcast).toHaveAttribute('data-sim-compensate-dest', 'broadcast');
  await expect(broadcast).toContainText('2 handlers');

  // Disparar: reversão nomeada na ordem inversa + o cartão como linha declarada.
  await broadcast.click();
  await expect(trail).toContainText('1. Compensate "Comprar passagem" → handler "Estornar passagem" (reverse order)');
  await expect(trail).toContainText('2. Compensate "Reservar hotel" → handler "Cancelar reserva" (reverse order)');
  await expect(trail).toContainText('"Pagar cartão" completed, no handler ⟲ — not compensated (declared)');
  // Os handlers ganham token (reversão visível no overlay).
  await expect(page.locator('[data-sim-active-node="hFlight"]')).toBeVisible();
  await expect(page.locator('[data-sim-active-node="hHotel"]')).toBeVisible();

  // §6e: o host appendou UMA entrada amarrando o plano EXECUTADO. compensated em
  // ordem reversa (passagem, hotel); o cartão declarado uncompensated; ✦ para a IA.
  await expect.poll(() => page.evaluate(() => document.body.dataset.compensationEntries)).toBe('1');
  const compensated = await page.evaluate(() => document.body.dataset.compensationCompensated);
  expect(compensated).toBe('Comprar passagem→Estornar passagem | Reservar hotel→Cancelar reserva');
  const uncompensated = await page.evaluate(() => document.body.dataset.compensationUncompensated);
  expect(uncompensated).toBe('Pagar cartão (no handler ⟲)');
  await expect.poll(() => page.evaluate(() => document.body.dataset.compensationSeal)).toBe('✦');
});
