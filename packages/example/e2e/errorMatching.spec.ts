import { expect, test } from '@playwright/test';

/**
 * Handoff 16 E-6 (§3e) — critério 8: o card invertido "Lançar erro" (usuário
 * escolhe o ERRO, motor resolve o boundary), catch-all DECLARADO via a opção
 * "erro não catalogado" (reforço 10) e a ambiguidade genuína como parada
 * honesta nomeando os candidatos.
 */

test('erro específico → boundary certo; não catalogado → catch-all; duplicata → parada honesta', async ({
  page,
}) => {
  await page.goto('/?simulate=1&errors=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  const advance = page.locator('[data-sim-advance]');
  const trail = page.locator('[data-sim-trail]');

  // 1. Avançar até o host: o card "Lançar erro" aparece com as opções POR
  // DEFINIÇÃO + a opção não catalogada (reforço 10).
  await advance.click();
  const card = page.locator('[data-sim-throw-card="host"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Lançar erro em “Cobrar pagamento”');
  await expect(card.locator('[data-sim-throw-error="err-pay"]')).toContainText(
    'Erro “Falha de pagamento”',
  );
  await expect(card.locator('[data-sim-throw-error=""]')).toContainText('Erro não catalogado');

  // 2. Erro específico: SÓ o boundary de err-pay dispara; a trilha nomeia o match.
  await card.locator('[data-sim-throw-error="err-pay"]').click();
  await expect(trail).toContainText('caught by boundary "Pagamento falhou"');
  await expect(trail).toContainText('errorRef match "err-pay"');

  // 3. Reiniciar; erro NÃO catalogado cai no catch-all — DECLARADO na trilha.
  await page.locator('[data-sim-reset]').click();
  await advance.click();
  await page.locator('[data-sim-throw-card="host"] [data-sim-throw-error=""]').click();
  await expect(trail).toContainText('uncatalogued error');
  await expect(trail).toContainText('caught by boundary "Qualquer erro"');
  await expect(trail).toContainText('DECLARED catch-all');

  // 4. Reiniciar; avançar até "Conciliar" (dois boundaries do MESMO erro):
  // lançar err-dup = ambiguidade genuína → parada honesta com candidatos.
  await page.locator('[data-sim-reset]').click();
  await advance.click(); // start → host
  await advance.click(); // host → dup
  const dupCard = page.locator('[data-sim-throw-card="dup"]');
  await expect(dupCard).toBeVisible();
  await dupCard.locator('[data-sim-throw-error="err-dup"]').click();
  await expect(trail).toContainText('AMBIGUOUS');
  await expect(trail).toContainText('d1 ("Duplicata A")');
  await expect(trail).toContainText('d2 ("Duplicata B")');
  await expect(page.locator('[data-sim-status]')).toContainText(
    'Decisão não-simulável — token parado',
  );
  // Nada disparou em silêncio: o botão de avançar está travado (parada honesta).
  await expect(advance).toBeDisabled();
});
