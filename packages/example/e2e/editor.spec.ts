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
  // The pending gate conveys its state through an accessible <title> now that
  // the glyph replaced the ✋ emoji.
  await expect(page.locator('[data-node-type="btv:gate"] title')).toHaveText(
    'aguardando aprovação',
  );
  await expect(page.locator('[data-edge-id="e3"]')).toBeVisible();
  // Domain edge styling reaches the DOM: the feedback edge (gate → reviewer)
  // uses the open arrowhead marker.
  await expect(page.locator('[data-edge-id="e5"] path[marker-end]').first()).toHaveAttribute(
    'marker-end',
    'url(#bpmnr-edge-open)',
  );
  // Craft pack: the fixed-waypoint handoff (e6) renders rounded (Q) corners.
  await expect(page.locator('[data-edge-id="e6"] path[marker-end]').first()).toHaveAttribute(
    'd',
    / Q /,
  );
  // F7-3: call activity and data store render with their BPMN notation.
  await expect(page.locator('[data-node-type="callActivity"]')).toBeVisible();
  await expect(page.locator('[data-node-type="dataStore"]')).toBeVisible();
  await expect(page.getByRole('status', { name: /Version/ })).toContainText('RASCUNHO');
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

test('renders a boundary event that rides along when its host moves', async ({ page }) => {
  const boundary = page.locator('[data-node-id="publishTimeout"]');
  await expect(boundary).toBeVisible();
  const before = await boundary.getAttribute('transform');

  const host = page.locator('[data-node-id="publish"]');
  const box = (await host.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();

  // The attached boundary event moved together with its host.
  await expect.poll(async () => boundary.getAttribute('transform')).not.toBe(before);
});

test('adds a typed timer event from the palette', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Timer Event' }).click();
  const timer = page.locator('[data-node-type="intermediateCatchEvent"]');
  await expect(timer).toHaveCount(1);
  await expect(timer).toBeVisible();
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
  await expect(badge).toContainText('TESTE INTERNO');
  await page.getByRole('button', { name: '→ candidate' }).click();
  await expect(badge).toContainText('CANDIDATA');
  // The candidate meta reflects the engine's quorum (2 roles by default).
  await expect(badge).toContainText('aguarda 2 aprovações');

  // Activation goes through the formal promotion flow (gates from the core).
  await page.getByRole('button', { name: 'Promover…' }).click();
  const dialog = page.getByRole('dialog', { name: /Ativar v0\.1\.0/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('PROMOÇÃO FORMAL · STATE MACHINE DO CORE');

  // Blocked until the quorum is met: 0/2 and a disabled activate button.
  const activate = dialog.getByRole('button', { name: 'Ativar v0.1.0' });
  await expect(dialog).toContainText('(0/2)');
  await expect(activate).toBeDisabled();

  // The side effects are announced before activation (ledger, pinned runs).
  await expect(dialog).toContainText('ledger hash-chained');

  // Approve as two distinct roles from inside the flow.
  await dialog.getByRole('button', { name: 'Aprovar como Owner' }).click();
  await expect(dialog).toContainText('(1/2)');
  await dialog.getByRole('button', { name: 'Aprovar como Compliance' }).click();
  await expect(dialog).toContainText('(2/2)');
  await expect(activate).toBeEnabled();

  await activate.click();
  await expect(dialog).not.toBeVisible();
  await expect(badge).toContainText('ATIVA');
  await expect(badge).toContainText('vigente desde');
  // The activation toast records the hash-chained ledger entry.
  await expect(page.locator('.bpmnr-toast')).toContainText(/ledger #[0-9a-f]{7} gravado/);
  // B3: the session history timeline answers vigência per version.
  await expect(page.locator('.bpmnr-timeline')).toContainText('ATIVA');
  await expect(page.locator('.bpmnr-timeline')).toContainText('vigente desde');

  // Editing an active diagram is vetoed
  await page.getByRole('button', { name: 'Add Task' }).click();
  await expect(page.locator('.bpmnr-toolbar-veto')).toContainText('immutable');

  // Cloning restores editability with a bumped version
  await page.getByRole('button', { name: 'New draft from this version' }).click();
  await expect(badge).toContainText('RASCUNHO');
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
  // Sample flow has no start event (domain diagram) → warnings listed. The
  // ONLY error is intentional (F-A): the shared-billing call activity is not
  // registered in the demo registry (CALL_REF_MISSING).
  await expect(panel).toContainText('warning');
  await expect(panel).toContainText('no version in effect');
  expect(await panel.locator('li[data-severity="error"]').count()).toBe(1);
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
  // Resolve the dialog deterministically: accept it, then assert on the
  // captured message. Asserting *inside* the handler risks an unhandled
  // rejection that leaves the modal open and hangs the file input.
  const dialogMessage = new Promise<string>((resolve) => {
    page.once('dialog', (dialog) => {
      const message = dialog.message();
      void dialog.accept().then(() => resolve(message));
    });
  });
  await page
    .locator('.demo-import input')
    .setInputFiles({ name: 'broken.xml', mimeType: 'application/xml', buffer: Buffer.from('<not-bpmn>') });
  expect(await dialogMessage).toContain('Import failed');
  // The sample diagram is still intact
  await expect(page.locator('[data-node-type="btv:squad"]')).toBeVisible();
});

test('businessRuleTask shows the decision-link badge; broken call ref shows its code (F-A)', async ({
  page,
}) => {
  // The sample's 'Score risk' carries decisionRef → gold badge (visual only).
  const badge = page.locator('[data-node-id="score"] [data-decision-link]');
  await expect(badge).toBeVisible();

  // Validate: the demo registry is empty, so 'Billing (shared)' resolves to
  // CALL_REF_MISSING — error badge + stable code below the shape.
  await page.getByRole('button', { name: 'Validate diagram' }).click();
  const call = page.locator('[data-node-id="billing"]');
  await expect(call).toHaveAttribute('data-node-issue-state', 'error');
  await expect(call.locator('[data-node-issue-code]')).toHaveText('CALL_REF_MISSING');
  await page.getByRole('button', { name: 'Close validation' }).click();
  await expect(page.locator('[data-node-issue]')).toHaveCount(0);
});

test('decision peek opens on selection outside the SVG, Esc closes it before the selection', async ({
  page,
}) => {
  const score = page.locator('[data-node-id="score"]');
  await score.scrollIntoViewIfNeeded();
  await score.click();

  // Peek is an HTML overlay — zero nodes inserted into the SVG (10.5.1).
  const peek = page.locator('[data-decision-peek="demo-decision-risk"]');
  await expect(peek).toBeVisible();
  expect(await page.locator('svg.bpmnr-canvas [data-decision-peek]').count()).toBe(0);
  await expect(peek).toContainText('Aprovar crédito?');
  await expect(peek).toContainText('First · 4 regras · 2→1');
  await expect(peek).toContainText('editar tabela →');
  await expect(peek.locator('.bpmnr-breadcrumb-seal')).toHaveText('RASCUNHO');

  const svgCount = await page.locator('svg.bpmnr-canvas *').count();
  // 1º Esc: closes the peek, selection preserved (§11.1)...
  await page.keyboard.press('Escape');
  await expect(peek).toHaveCount(0);
  await expect(score).toHaveAttribute('data-selected', 'true');
  // ...and the SVG element count is untouched by the peek's lifecycle.
  expect(await page.locator('svg.bpmnr-canvas *').count()).toBe(svgCount);

  // 2º Esc: clears the selection.
  await page.keyboard.press('Escape');
  await expect(score).not.toHaveAttribute('data-selected', 'true');

  // Inspector: DECISÃO · DMN section shows the linked card (wireframe 2d).
  await score.click();
  await expect(page.locator('[data-decision-card="demo-decision-risk"]')).toBeVisible();
  await expect(page.locator('.btv-dmn-inspector-kicker')).toContainText('DECISÃO · DMN 1.3');
});
