import { expect, test } from '@playwright/test';

/**
 * Handoff 18 §5c — a ponte agente→humano no canvas: um agentTask com um
 * boundary de escalação NÃO-interrupting GOVERNADO (chip esc@ VIGENTE) +
 * autoridade declarada (↟ Gate G2) roteando para uma revisão/assinatura
 * humana. O e2e assere os TRÊS elementos do desenho (reforço 8). NÃO observa
 * entrada de escalação no ledger — não há gatilho honesto ainda; a simulação
 * do disparo e a cola do ledger são da EC-5.
 */
test('agentTask + boundary esc@ governado + autoridade + revisão humana', async ({ page }) => {
  await page.goto('/?agentbridge=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  // 1. agentTask com o ref do workflow governado (🤖 + rodapé mono).
  await expect(page.locator('[data-node-id="agent"]')).toBeVisible();
  await expect(page.locator('[data-node-id="agent"]')).toContainText('analisar-contrato@1.0.0');

  // 2. boundary NI com o chip esc@ governado, selo VIGENTE.
  await expect(page.locator('[data-event-binding="bnd"]')).toContainText('esc-alcada@1.2.0');
  await expect(page.locator('[data-event-binding="bnd"]')).toContainText('VIGENTE');

  // 3. chip de autoridade no catch (↟ nomeando quem decide).
  await expect(page.locator('[data-event-authority="bnd"]')).toContainText('↟');
  await expect(page.locator('[data-event-authority="bnd"]')).toContainText('Gate G2');

  // Destino da escalação: a revisão/assinatura humana.
  await expect(page.locator('[data-node-id="review"]')).toContainText('Revisar e assinar');
});
