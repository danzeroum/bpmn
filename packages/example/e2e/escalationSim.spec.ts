import { expect, test } from '@playwright/test';

/**
 * Handoff 18 §5e (e2e do checklist 5e) — o card «Escalar» prevê o DESTINO por
 * opção (glifo + texto, reforço 7) → disparar a escalação NÃO-interrupting faz
 * o host SEGUIR e um token PARALELO re-emergir no catch (a trilha nomeia o
 * modo) → a variante SEM destino (não catalogada) DISSOLVE (no-op declarado, o
 * token do host segue) — o CONTRASTE vinculante com a parada do erro. A
 * superfície roda em pt-BR (o demo injeta PT_BR); a trilha do motor é inglesa.
 */

test('card prevê destino; NI segue + paralelo; não catalogada dissolve', async ({ page }) => {
  await page.goto('/?simulate=1&escalation=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
  const advance = page.locator('[data-sim-advance]');
  const trail = page.locator('[data-sim-trail]');

  // 1. Avançar até o host `aprovar`: o card «Escalar» aparece.
  await advance.click();
  const card = page.locator('[data-sim-escalate-card="aprovar"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Escalar em “Aprovar despesa”');

  // 2. Reforço 7: a opção catalogada prevê o boundary NÃO-interrupting como
  // glifo + texto, ANTES do disparo.
  const catalogued = card.locator('[data-sim-throw-escalation="esc-alcada"]');
  await expect(catalogued).toHaveAttribute('data-sim-escalation-dest', 'boundary');
  const dest = catalogued.locator('[data-sim-escalation-dest-text]');
  await expect(dest).toContainText('→ boundary “Acima da alçada”');
  await expect(dest).toContainText('↟ não-interruptivo');
  // A não catalogada prevê a dissolução (declarada ANTES do disparo).
  const uncat = card.locator('[data-sim-throw-escalation=""]');
  await expect(uncat).toHaveAttribute('data-sim-escalation-dest', 'dissolve');

  // 3. Disparar a catalogada: catch NÃO-interrupting — o host SEGUE e um token
  // PARALELO re-emerge no boundary. A trilha nomeia o modo.
  await catalogued.click();
  await expect(trail).toContainText(
    'caught by boundary "Acima da alçada" (non-interrupting — host continues + parallel token)',
  );
  await expect(page.locator('[data-sim-active-node="aprovar"]')).toBeVisible(); // host segue
  await expect(page.locator('[data-sim-active-node="bnd"]')).toBeVisible(); // token paralelo

  // 4. CONTRASTE: reiniciar e disparar a NÃO CATALOGADA — sem destino DISSOLVE
  // (no-op declarado), o token do host SEGUE (nunca para, diferente do erro).
  await page.locator('[data-sim-reset]').click();
  await advance.click();
  await page.locator('[data-sim-escalate-card="aprovar"] [data-sim-throw-escalation=""]').click();
  await expect(trail).toContainText('escalation dissolves (OMG); the host token continues');
  await expect(page.locator('[data-sim-active-node="aprovar"]')).toBeVisible(); // host segue
  await expect(advance).toBeEnabled(); // o fluxo continua — não é parada
});
