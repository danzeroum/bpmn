import { expect, test } from '@playwright/test';

/**
 * Handoff 9 CP-2/CP-3/CP-4 — the governed copilot with a DETERMINISTIC FAKE
 * provider (§8.6: CI never calls the network). C1 drafts the reimbursement
 * process as ONE undoable composite with AI authorship; C2 adjusts
 * incrementally; "Desfazer tudo" reverts the whole plan in one click; C3
 * explains in the Studio review WITHOUT touching the ledger; C4 pre-fills the
 * change_summary but only a HUMAN interaction commits it; C5 fixes a SND_*
 * error through the same pipeline (and the fix must REALLY fix); C6 answers
 * ledger questions only with REAL citations — otherwise "não encontrei
 * registro".
 */
test('C1: draft → applied diagram + mixed authorship + local soundness footer', async ({ page }) => {
  await page.goto('/?copilot=1');
  const panel = page.getByTestId('copilot-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('copilot-pill')).toHaveText('SÓ RASCUNHA');
  // CP-5 (§1.5): the header reflects the ACTIVE version from the Biblioteca
  // adapter — "prompt: copilot-draft v1.0.0 ativa".
  await expect(page.getByTestId('copilot-meta')).toContainText(
    'claude-4 · prompt: copilot-draft v1.0.0 ativa',
  );

  await panel.locator('textarea').fill('processo de reembolso com aprovação');
  await page.getByTestId('copilot-generate').click();

  // The draft landed on the canvas (7 nodes) and the footer carries the
  // authorship, the ledger hash and the LOCALLY computed soundness.
  await expect(page.locator('[data-node-id]')).toHaveCount(7);
  const footer = page.getByTestId('copilot-footer');
  await expect(footer).toContainText('autoria: ia.copilot@claude-4 + ana.ruiz');
  await expect(footer).toContainText('ledger: #');
  await expect(footer).toContainText('soundness: 0 erros');
  await expect(page.getByTestId('copilot-seal')).toContainText('ia.copilot@claude-4');
});

test('C2 adjust applies incrementally; "Desfazer tudo" reverts the whole plan', async ({ page }) => {
  await page.goto('/?copilot=1');
  const panel = page.getByTestId('copilot-panel');
  await panel.locator('textarea').fill('processo de reembolso');
  await page.getByTestId('copilot-generate').click();
  await expect(page.locator('[data-node-id]')).toHaveCount(7);

  // C2: incremental adjust renames the analysis task.
  await panel.locator('textarea').fill('explicite o SLA de 48h na análise');
  await page.getByTestId('copilot-adjust').click();
  await expect(page.locator('[data-node-id="analisar"]')).toContainText('SLA 48h');

  // "Desfazer tudo" of the LAST plan (the adjust) is one click/undo.
  await page.getByTestId('copilot-undo-all').click();
  await expect(page.locator('[data-node-id="analisar"]')).not.toContainText('SLA 48h');
  await expect(page.locator('[data-node-id]')).toHaveCount(7); // draft intact
});

test('C3: Explicar is read-only ABSOLUTO — explanation renders, ledger untouched', async ({
  page,
}) => {
  // Baseline: count the ledger entries in the Auditoria BEFORE explaining.
  await page.goto('/?studio=1#/auditoria');
  const total = page.locator('.btv-studio-chip-count').first();
  await expect(total).not.toHaveText('');
  const before = await total.textContent();

  await page.getByRole('button', { name: 'Revisão' }).click();
  await page.getByTestId('review-explain').click();
  await expect(page.getByTestId('review-explanation')).toContainText('Onboarding de clientes');
  // No decision was made and no command was generated — review stays intact.
  await expect(page.getByRole('button', { name: /Aprovar como/ })).toBeVisible();

  // The ONLY capability without a trail (by design): the entry count is
  // exactly what it was — no "recorded query", nothing.
  await page.getByRole('button', { name: 'Auditoria' }).click();
  await expect(page.locator('.btv-studio-chip-count').first()).toHaveText(before!);
});

test('C5: erro SND_* listado → "sugerir correção" aplicada REMOVE o erro de fato', async ({
  page,
}) => {
  await page.goto('/?copilot=1&fix=1');
  // The trap surfaced by the LOCAL analyzer: named code + versioned template.
  const snd = page.getByTestId('copilot-snd-errors');
  await expect(snd).toContainText('SND_DEADLOCK_JOIN');
  await expect(snd).toContainText('prompt: copilot-fix v1.0.0');

  await page.getByTestId('copilot-fix').click();
  // The fix rides the C2 pipeline: applied, authored, locally re-analyzed.
  const footer = page.getByTestId('copilot-footer');
  await expect(footer).toContainText('soundness: 0 erros');
  await expect(footer).toContainText('autoria: ia.copilot@claude-4 + ana.ruiz');
  // The motivating error is REALLY gone — the recomputed list disappears
  // (a fix that does not fix would keep it visible).
  await expect(snd).toHaveCount(0);
  await expect(page.locator('[data-node-id="junta"]')).toHaveCount(1);

  // "Desfazer tudo" reverts the whole fix — the trap (and the list) return.
  await page.getByTestId('copilot-undo-all').click();
  await expect(snd).toContainText('SND_DEADLOCK_JOIN');
});

test('C6: consulta ao ledger com citações reais; sem registro citável → não inventa', async ({
  page,
}) => {
  await page.goto('/?studio=1#/auditoria');

  // Positive: the answer is anchored in a REAL entry (clickable citation).
  const input = page.getByTestId('ledger-query-input');
  await input.fill('quem aprovou a v2.0.0?');
  await page.getByTestId('ledger-query-ask').click();
  const answer = page.getByTestId('ledger-query-answer');
  await expect(answer).toContainText('carla (compliance)');
  const citation = page.getByTestId('ledger-query-citation');
  await expect(citation).toHaveCount(1);
  await expect(citation).toContainText('APPROVAL_RECORDED');

  // Clicking the citation OPENS the cited entry in the Explorer detail.
  await citation.click();
  await expect(
    page.locator('.btv-studio-ledger-entry[data-selected]'),
  ).toContainText('APPROVAL_RECORDED');

  // Negative (as important as the positive): nothing citable → the literal
  // "não encontrei registro" — the invented answer text never renders.
  await input.fill('quem aprovou a v9.9.9?');
  await page.getByTestId('ledger-query-ask').click();
  await expect(page.getByTestId('ledger-query-norecord')).toContainText('não encontrei registro');
  await expect(page.getByTestId('ledger-query-answer')).toHaveCount(0);
  await expect(page.getByText('aprovada por alguém')).toHaveCount(0);

  // Read-only como a C3: a consulta não gerou NENHUMA entrada nova.
  await expect(page.locator('.btv-studio-chip-count').first()).toHaveText('4');
});

test('CP-5: os templates do copiloto aparecem na Biblioteca como PROMPT DO COPILOTO', async ({
  page,
}) => {
  await page.goto('/?studio=1');
  // The type chip proves the adapter registered like any other (§1.5).
  const chip = page.locator('.btv-lib-chip-type[data-adapter="copilot-prompt"]');
  await expect(chip).toBeVisible();
  await chip.click();
  // One card per capability, active shipped version, pt-BR names.
  await expect(page.getByText('Rascunho do processo (C1)')).toBeVisible();
  await expect(page.getByText('Consulta ao ledger (C6)')).toBeVisible();
  await page.getByRole('button', { name: /Rascunho do processo \(C1\)/ }).click();
  await expect(page.getByText('DETALHE · PROMPT DO COPILOTO')).toBeVisible();
  await expect(page.getByText(/nova versão promovível/)).toBeVisible();
});

test('C4: AI text only PRE-FILLS the change_summary — the gate stays ○ until the human commits', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '→ test' }).click();
  await page.getByRole('button', { name: '→ candidate' }).click();
  await page.getByRole('button', { name: 'Promover…' }).click();
  const dialog = page.getByRole('dialog', { name: /Ativar v0\.1\.0/ });
  await expect(dialog).toBeVisible();

  const summary = dialog.getByLabel('change_summary');
  const gate = dialog
    .locator('.bpmnr-promotion-gate')
    .filter({ has: page.getByTestId('suggest-summary') });

  // Empty the summary (human act) → the gate is genuinely unsatisfied.
  await summary.fill('');
  await summary.blur();
  await expect(gate).toHaveAttribute('data-satisfied', 'false');

  // The AI suggestion lands in the FIELD but commits NOTHING: the gate keeps
  // showing ○ — there is no path from the suggestion to the version/ledger.
  await page.getByTestId('suggest-summary').click();
  await expect(summary).toHaveValue(/Rascunho da IA sobre o diff real/);
  await expect(gate).toHaveAttribute('data-satisfied', 'false');

  // Only the HUMAN interaction with the field (blur) commits the text.
  await summary.blur();
  await expect(gate).toHaveAttribute('data-satisfied', 'true');

  // The normal human path completes: quorum + activation + hash-chained toast.
  await dialog.getByRole('button', { name: 'Aprovar como Owner' }).click();
  await dialog.getByRole('button', { name: 'Aprovar como Compliance' }).click();
  await dialog.getByRole('button', { name: 'Ativar v0.1.0' }).click();
  await expect(page.locator('.bpmnr-toast')).toContainText(/ledger #[0-9a-f]{7} gravado/);
});
