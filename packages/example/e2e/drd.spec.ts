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
