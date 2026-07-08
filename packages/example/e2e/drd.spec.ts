import { expect, test } from '@playwright/test';

/**
 * Handoff 5 F-B1: the minimum viable DRD renders with spec geometry and the
 * three requirement edge forms (one family color, straight routing).
 */
test('renders the DRD with the 4 DMN nodes and form-coded requirement edges', async ({ page }) => {
  await page.goto('/?drd=1');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();

  for (const type of [
    'dmn:decision',
    'dmn:inputData',
    'dmn:knowledgeSource',
    'dmn:businessKnowledgeModel',
  ]) {
    await expect(page.locator(`[data-node-type="${type}"]`).first()).toBeVisible();
  }
  // Decision has a bound table → glyph visible.
  await expect(page.locator('[data-decision-table-glyph]')).toBeVisible();

  // information: solid + filled arrow · knowledge: dashed + open · authority:
  // dotted + disc. All straight (single M…L segment).
  const line = (id: string) => page.locator(`[data-edge-id="${id}"] path[marker-end]`);
  await expect(line('r1')).toHaveAttribute('marker-end', 'url(#bpmnr-edge-filled)');
  await expect(line('r3')).toHaveAttribute('stroke-dasharray', '5,4');
  await expect(line('r3')).toHaveAttribute('marker-end', 'url(#bpmnr-edge-open)');
  await expect(line('r4')).toHaveAttribute('stroke-dasharray', '2,4');
  await expect(line('r4')).toHaveAttribute('marker-end', 'url(#bpmnr-edge-disc)');
  await expect(line('r1')).toHaveAttribute('d', /^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+$/);

  // The DMN palette group is registered (185° family).
  await expect(page.getByRole('button', { name: 'Add Decision' })).toBeVisible();
});

/**
 * Handoff 5 F-B2: the decision's own editing surface — deep link opens the
 * table with the governance breadcrumb; edits ride the shared CommandStack
 * (global undo); Esc rides the single dismissal stack.
 */
test('opens the decision table surface with breadcrumb, edits a cell, undoes globally', async ({
  page,
}) => {
  await page.goto('/?drd=1&decision=demo-decision-risk');
  const editor = page.locator('.btv-dmn-editor');
  await expect(editor).toBeVisible();

  // Breadcrumb: fluxo vX ▸ nó ▸ tabela vY [SELO] (aceite 10.5.3).
  const breadcrumb = page.getByRole('navigation', { name: 'Decision navigation' });
  await expect(breadcrumb).toContainText('Decisão de crédito (DRD)');
  await expect(breadcrumb).toContainText('Aprovar crédito?');
  await expect(breadcrumb).toContainText('tabela');
  await expect(breadcrumb.locator('.bpmnr-breadcrumb-seal').last()).toHaveText('RASCUNHO');

  // Canonical anatomy: gold hit cell + double input/output divider.
  await expect(editor.locator('.btv-dmn-hit button')).toHaveText('F');
  await expect(editor.locator('th.btv-dmn-input-last')).toBeVisible();

  // Edit a cell inline; commit lands on the shared stack.
  const cell = editor.locator('[data-cell$=":0"]').first();
  await cell.dblclick();
  const input = editor.locator('td input');
  await expect(input).toBeVisible();
  await input.fill('>= 9000');
  await input.press('Enter');
  await expect(editor.locator('[data-cell$=":0"]').first()).toContainText('>= 9000');

  // Global undo restores the original expression (aceite 10.5.4).
  await page.keyboard.press('Control+z');
  await expect(editor.locator('[data-cell$=":0"]').first()).toContainText('>= 8000');

  // Esc precedence: hit-policy menu closes before the surface (§11.1).
  await editor.locator('.btv-dmn-hit button').click();
  await expect(editor.locator('.btv-dmn-hit-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editor.locator('.btv-dmn-hit-menu')).toHaveCount(0);
  await expect(editor).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.btv-dmn-editor')).toHaveCount(0);
});
