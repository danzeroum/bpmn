import { expect, test } from '@playwright/test';

/**
 * Handoff 19 §6d (e2e do checklist) — a simulação reversa: avançar até completar
 * hotel + passagem → o card «Compensar» mostra o broadcast com a CONTAGEM e as
 * específicas → disparar o broadcast reverte na ORDEM inversa nomeando
 * atividade → handler, cada handler ganhando token. A superfície roda em pt-BR
 * (o demo injeta PT_BR); a trilha do motor é inglesa.
 */
test('avançar → card com contagem → broadcast reverte na ordem inversa', async ({ page }) => {
  await page.goto('/?simulate=1&comp=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  const advance = page.locator('[data-sim-advance]');

  // Avançar: start → hotel → flight → card (hotel e flight completaram).
  await advance.click(); // s → hotel
  await advance.click(); // hotel → flight
  await advance.click(); // flight → card

  const card = page.locator('[data-sim-compensate-card]');
  await expect(card).toBeVisible();
  // Broadcast mostra a CONTAGEM (2 handlers completados: hotel + passagem).
  const broadcast = card.locator('[data-sim-compensate=""]');
  await expect(broadcast).toHaveAttribute('data-sim-compensate-dest', 'broadcast');
  await expect(broadcast).toContainText('2 handlers');

  // Disparar o broadcast: reversão nomeada na ordem inversa.
  await broadcast.click();
  const trail = page.locator('[data-sim-trail]');
  await expect(trail).toContainText('1. Compensate "Comprar passagem" → handler "Estornar passagem" (reverse order)');
  await expect(trail).toContainText('2. Compensate "Reservar hotel" → handler "Cancelar reserva" (reverse order)');
  // Os handlers ganham token (reversão visível no overlay).
  await expect(page.locator('[data-sim-active-node="hFlight"]')).toBeVisible();
  await expect(page.locator('[data-sim-active-node="hHotel"]')).toBeVisible();
});
