import { expect, test } from '@playwright/test';

/**
 * Handoff 17 ES-5 (§4e) — critério 8 (e2e do checklist): lançar erro → o
 * event subprocess do MESMO escopo VENCE o boundary externo do MESMO ref
 * (precedência vinculante) → a trilha nomeia a interrupção com CONTAGEM +
 * escopo → variante não-interrupting mantém o escopo (token paralelo).
 */

test('esub vence boundary externo; trilha nomeia interrupção; variante não-interrupting', async ({
  page,
}) => {
  await page.goto('/?simulate=1&esub=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  const advance = page.locator('[data-sim-advance]');
  const trail = page.locator('[data-sim-trail]');

  // 1. Avançar até o host: o card oferece os DOIS refs (boundary + esubs).
  await advance.click();
  const card = page.locator('[data-sim-throw-card="host"]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-sim-throw-error="err-pay"]')).toBeVisible();
  await expect(card.locator('[data-sim-throw-error="err-late"]')).toBeVisible();

  // 2. err-pay: esub exato (mesmo escopo) VENCE o boundary exato do MESMO ref
  // — a trilha nomeia captura (start + modo) e a interrupção contada.
  await card.locator('[data-sim-throw-error="err-pay"]').click();
  await expect(trail).toContainText(
    'caught by event subprocess "Tratar exceções" (start stI, errorRef "err-pay", interrupting)',
  );
  await expect(trail).toContainText('interrupting: 1 token(s) cancelled in scope "Plantões"');
  await expect(trail).not.toContainText('caught by boundary');

  // 3. Reiniciar; err-late: variante NÃO-interrupting — escopo segue.
  await page.locator('[data-sim-reset]').click();
  await advance.click();
  await page.locator('[data-sim-throw-card="host"] [data-sim-throw-error="err-late"]').click();
  await expect(trail).toContainText(
    'caught by event subprocess "Plantão de atrasos" (start stN, errorRef "err-late", non-interrupting: scope continues)',
  );
  // O token do host segue vivo: dá para avançar o fluxo normal até o fim.
  await expect(advance).toBeEnabled();
});
