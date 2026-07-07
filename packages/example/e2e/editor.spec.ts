import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
});

async function nodeCount(page: Page): Promise<number> {
  return page.locator('[data-node-id]').count();
}

test('renders the sample diagram with domain shapes', async ({ page }) => {
  await expect(page.locator('[data-node-type="btv:squad"]')).toBeVisible();
  await expect(page.locator('[data-node-type="btv:gate"]')).toBeVisible();
  await expect(page.locator('[data-edge-id="e3"]')).toBeVisible();
  await expect(page.getByRole('status', { name: /Version/ })).toContainText('Draft');
});

test('creates a node from the palette and undoes/redoes it', async ({ page }) => {
  const before = await nodeCount(page);
  await page.getByRole('button', { name: 'Add User Task' }).click();
  await expect(page.locator('[data-node-id]')).toHaveCount(before + 1);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('[data-node-id]')).toHaveCount(before);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.locator('[data-node-id]')).toHaveCount(before + 1);
});

test('drags a node to a new position', async ({ page }) => {
  const node = page.locator('[data-node-id="writer"]');
  const before = await node.getAttribute('transform');
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => node.getAttribute('transform'))
    .not.toBe(before);
});

test('edits a node label inline via double-click', async ({ page }) => {
  const node = page.locator('[data-node-id="writer"]');
  await node.dblclick();
  const input = page.locator('[data-node-label-editor="writer"]');
  await expect(input).toBeVisible();
  await input.fill('Senior Writer');
  await input.press('Enter');
  await expect(input).toBeHidden();
  await expect(node).toContainText('Senior Writer');

  // Undo restores the original label.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(node).not.toContainText('Senior Writer');
});

test('connects two nodes via a port', async ({ page }) => {
  const edgesBefore = await page.locator('[data-edge-id]').count();
  // Select the prompt node to reveal its ports
  const prompt = page.locator('[data-node-id="prompt"]');
  const promptBox = (await prompt.boundingBox())!;
  await page.mouse.click(promptBox.x + promptBox.width / 2, promptBox.y + promptBox.height / 2);
  const port = page.locator('[data-node-id="prompt"] [data-port]').first();
  await expect(port).toBeVisible();

  const portBox = (await port.boundingBox())!;
  const target = page.locator('[data-node-id="publish"]');
  const targetBox = (await target.boundingBox())!;

  await page.mouse.move(portBox.x + portBox.width / 2, portBox.y + portBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 10,
  });
  await page.mouse.up();

  await expect(page.locator('[data-edge-id]')).toHaveCount(edgesBefore + 1);
});

test('blocks self-connections with a live veto message', async ({ page }) => {
  const edgesBefore = await page.locator('[data-edge-id]').count();
  const prompt = page.locator('[data-node-id="prompt"]');
  const box = (await prompt.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const port = page.locator('[data-node-id="prompt"] [data-port]').first();
  const portBox = (await port.boundingBox())!;

  await page.mouse.move(portBox.x + portBox.width / 2, portBox.y + portBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await expect(page.locator('[data-connection-preview]')).toContainText(
    'cannot connect to itself',
  );
  await page.mouse.up();
  await expect(page.locator('[data-edge-id]')).toHaveCount(edgesBefore);
});

test('zooms with toolbar controls', async ({ page }) => {
  const zoom = page.locator('.bpmnr-toolbar-zoom');
  const initial = await zoom.textContent();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoom).not.toHaveText(initial!);
  await page.getByRole('button', { name: 'Fit diagram' }).click();
  await expect(page.locator('svg.bpmnr-canvas')).toBeVisible();
});

test('promotes through the lifecycle with multi-role approval and locks active diagrams', async ({
  page,
}) => {
  const badge = page.getByRole('status', { name: /Version/ });

  // draft → test → candidate
  await page.getByRole('button', { name: '→ test' }).click();
  await expect(badge).toContainText('Test');
  await page.getByRole('button', { name: '→ candidate' }).click();
  await expect(badge).toContainText('Candidate');

  // Promotion to active without approvals must fail
  await page.getByRole('button', { name: '→ active' }).click();
  await expect(page.getByRole('alert')).toContainText('distinct roles');

  // Approve with two distinct roles
  await page.getByRole('button', { name: 'Approve as owner' }).click();
  await page.getByLabel('Acting as').selectOption({ label: 'Carlos (compliance)' });
  await page.getByRole('button', { name: 'Approve as compliance' }).click();

  await page.getByRole('button', { name: '→ active' }).click();
  await expect(badge).toContainText('Active');

  // Editing an active diagram is vetoed
  await page.getByRole('button', { name: 'Add Task' }).click();
  await expect(page.locator('.bpmnr-toolbar-veto')).toContainText('immutable');

  // Cloning restores editability with a bumped version
  await page.getByRole('button', { name: 'New draft from this version' }).click();
  await expect(badge).toContainText('Draft');
  await expect(badge).toContainText('v0.2.0');
});

test('records audit entries with a verifiable hash chain', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Task' }).click();
  await expect(page.locator('.demo-audit li code').first()).toHaveText('NODE_ADDED');
  await page.getByRole('button', { name: 'verify' }).click();
  await expect(page.locator('.demo-audit')).toContainText('chain intact');
});

test('validates the diagram from the toolbar', async ({ page }) => {
  await page.getByRole('button', { name: 'Validate diagram' }).click();
  const panel = page.getByRole('status', { name: 'Validation result' });
  // Sample flow has no start event (domain diagram) → warning listed, no errors
  await expect(panel).toContainText('warning');
  await expect(panel).not.toContainText('error');
});

test('exports BPMN XML with DI', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export BPMN XML' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.bpmn\.xml$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const xml = Buffer.concat(chunks).toString('utf8');
  expect(xml).toContain('<bpmn:definitions');
  expect(xml).toContain('<bpmndi:BPMNShape');
  expect(xml).toContain('<di:waypoint');
  expect(xml).toContain('type="btv:squad"');
});

test('exports SVG', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export SVG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const svg = Buffer.concat(chunks).toString('utf8');
  expect(svg).toContain('<svg');
  expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  // Transient interaction chrome must not leak into the exported file.
  expect(svg).not.toContain('data-resize-handles');
});

test('exports PNG', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const bytes = Buffer.concat(chunks);
  expect(bytes.length).toBeGreaterThan(0);
  // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});

test('rejects invalid XML imports with a readable error', async ({ page }) => {
  page.on('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Import failed');
    await dialog.accept();
  });
  await page
    .locator('.demo-import input')
    .setInputFiles({ name: 'broken.xml', mimeType: 'application/xml', buffer: Buffer.from('<not-bpmn>') });
  // The sample diagram is still intact
  await expect(page.locator('[data-node-type="btv:squad"]')).toBeVisible();
});
