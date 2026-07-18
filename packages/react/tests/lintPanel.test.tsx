import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import type { AIProvider } from '@buildtovalue/copilot';
import { BpmnDesigner, LintPanel, PT_BR, svgToString } from '../src/index.js';

/**
 * Handoff 14 §1d — the lint problems dock: resizable bottom surface grouped
 * by rule; click → select + animated pan; quick-fix = ONE undoable command,
 * fix-all = ONE composite; no mechanical fix + AIProvider → ✦ C5 route;
 * etiquette AND engine findings on the SAME panel.
 */

function buildDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Lint flow' });
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Início', x: 40, y: 40 }),
    a: createNode({ id: 'a', type: 'task', label: 'Trabalhar', x: 240, y: 40 }),
    end: createNode({ id: 'end', type: 'endEvent', label: 'Fim', x: 460, y: 40 }),
    // Unlabeled task → LINT_LABEL_REQUIRED (etiquette, NOT mechanically fixable).
    u: createNode({ id: 'u', type: 'userTask', label: '', x: 900, y: 300 }),
    // Service task without binding → EXEC_MISSING_IMPLEMENTATION (engine).
    svc: createNode({ id: 'svc', type: 'serviceTask', label: 'Cobrar', x: 640, y: 40 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'a' }),
    e2: createEdge({ id: 'e2', sourceId: 'a', targetId: 'end' }),
    // Duplicate flow → LINT_DUPLICATE_FLOW (etiquette, fixable).
    dup: createEdge({ id: 'dup', sourceId: 'start', targetId: 'a' }),
  };
  return diagram;
}

function renderPanel(diagram = buildDiagram(), props: { provider?: AIProvider } = {}) {
  return render(
    <BpmnDesigner diagram={diagram} messages={PT_BR}>
      <LintPanel {...props} />
    </BpmnDesigner>,
  );
}

function openPanel() {
  fireEvent.click(screen.getByTestId('lint-toggle'));
  return screen.getByTestId('lint-panel');
}

describe('lint panel (spec 1d)', () => {
  it('toggle opens the bottom dock; Esc closes it via the dismissal stack', () => {
    renderPanel();
    expect(screen.queryByTestId('lint-panel')).toBeNull();
    openPanel();
    expect(screen.getByTestId('lint-panel')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('lint-panel')).toBeNull();
    expect(screen.getByTestId('lint-toggle')).toBeInTheDocument();
  });

  it('header shows severity counts and the versioned policy with the VIGENTE seal', () => {
    renderPanel();
    const panel = openPanel();
    // dup + implicit join on "a" (2 incoming) + u unlabeled + svc missing impl = 4.
    expect(panel.querySelector('[data-lint-count="warnings"]')!.textContent).toContain('4');
    expect(panel.querySelector('[data-lint-count="errors"]')!.textContent).toContain('0');
    const policy = screen.getByTestId('lint-policy');
    expect(policy.textContent).toContain('lint-etiquette@1.3.0');
    expect(policy.textContent).toContain('lint-engine@1.3.0');
    expect(policy.textContent).toContain('VIGENTE');
  });

  it('groups findings by rule and shows engine findings on the SAME surface', () => {
    renderPanel();
    const panel = openPanel();
    expect(panel.querySelector('[data-lint-group="duplicate-flow"]')).not.toBeNull();
    expect(panel.querySelector('[data-lint-group="label-required"]')).not.toBeNull();
    const engineGroup = panel.querySelector('[data-lint-group="service-task-implementation"]')!;
    expect(engineGroup.querySelector('[data-lint-source="executability"]')!.textContent).toBe(
      'engine',
    );
    expect(
      panel
        .querySelector('[data-lint-group="label-required"] [data-lint-source="etiquette"]')!
        .textContent,
    ).toBe('etiqueta');
  });

  it('clicking a finding selects the element and pans (animated) to it', async () => {
    const { container } = renderPanel();
    const panel = openPanel();
    const row = panel.querySelector('[data-lint-row="u"] [data-lint-goto]')!;
    fireEvent.click(row);
    expect(container.querySelector('[data-node-id="u"][data-selected="true"]')).not.toBeNull();
    // u at (900,300) size 120×60 → viewport x = 960-600 = 360, y = 330-400 = -70.
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    await waitFor(
      () => {
        const [x, y] = svg.getAttribute('viewBox')!.split(' ').map(Number);
        expect(Math.abs(x - 360)).toBeLessThan(1);
        expect(Math.abs(y - -70)).toBeLessThan(1);
      },
      // Generous under coverage instrumentation — rAF frames slow down there.
      { timeout: 5000 },
    );
  });

  it('"corrigir" applies ONE undoable command (Ctrl+Z restores the duplicate)', () => {
    const { container } = renderPanel();
    const panel = openPanel();
    const fix = panel.querySelector('[data-lint-group="duplicate-flow"] [data-lint-fix]')!;
    fireEvent.click(fix);
    expect(panel.querySelector('[data-lint-group="duplicate-flow"]')).toBeNull();
    expect(container.querySelector('[data-edge-id="dup"]')).toBeNull();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(container.querySelector('[data-edge-id="dup"]')).not.toBeNull();
    expect(panel.querySelector('[data-lint-group="duplicate-flow"]')).not.toBeNull();
  });

  it('"Corrigir todos (N)" carries the count and is ONE composite (single undo)', () => {
    const diagram = buildDiagram();
    // A second fixable issue: flow back INTO the start event.
    diagram.edges.back = createEdge({ id: 'back', sourceId: 'a', targetId: 'start' });
    const { container } = renderPanel(diagram);
    const panel = openPanel();
    const fixAll = screen.getByTestId('lint-fix-all');
    expect(fixAll.textContent).toContain('(2)');
    fireEvent.click(fixAll);
    expect(container.querySelector('[data-edge-id="dup"]')).toBeNull();
    expect(container.querySelector('[data-edge-id="back"]')).toBeNull();
    expect(panel.querySelector('[data-lint-fix]')).toBeNull();
    // ONE undo restores the whole sweep.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(container.querySelector('[data-edge-id="dup"]')).not.toBeNull();
    expect(container.querySelector('[data-edge-id="back"]')).not.toBeNull();
  });

  it('without an AIProvider there is NO ✦ button on unfixable findings', () => {
    renderPanel();
    const panel = openPanel();
    expect(panel.querySelector('[data-lint-suggest]')).toBeNull();
  });

  it('with an AIProvider, ✦ routes the finding through the C5 pipeline', async () => {
    const asked: Array<{ system: string; content: string }> = [];
    const provider: AIProvider = {
      id: 'fake',
      complete: async ({ system, messages }) => {
        asked.push({ system, content: String(messages[0]?.content ?? '') });
        return JSON.stringify({
          commands: [{ type: 'updateNode', params: { id: 'u', label: 'Revisar pedido' } }],
          rationale: 'Nomeia a tarefa sem rótulo.',
          promptTemplateRef: { id: 'copilot-fix', version: '1.0.0' },
        });
      },
    };
    renderPanel(buildDiagram(), { provider });
    const panel = openPanel();
    const suggest = panel.querySelector(
      '[data-lint-group="label-required"] [data-lint-suggest]',
    )!;
    // Fixable rows keep the mechanical button — ✦ only where no fix exists.
    expect(
      panel.querySelector('[data-lint-group="duplicate-flow"] [data-lint-suggest]'),
    ).toBeNull();
    fireEvent.click(suggest);
    await waitFor(() => {
      expect(panel.querySelector('[data-lint-group="label-required"]')).toBeNull();
    });
    expect(asked).toHaveLength(1);
    expect(asked[0].content).toContain('LINT_LABEL_REQUIRED');
    // The C5 fix prompt drives the ask — same pipeline as the copilot panel.
    expect(asked[0].system.length).toBeGreaterThan(0);
    // Applied through the command stack: one undo reverts the AI fix.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(panel.querySelector('[data-lint-group="label-required"]')).not.toBeNull();
  });

  it('open panel mirrors findings as canvas badges — and exports stay clean', () => {
    const { container } = renderPanel();
    openPanel();
    const svg = container.querySelector('svg.bpmnr-canvas') as SVGSVGElement;
    // Badges are live on the canvas while the dock is open…
    expect(svg.querySelectorAll('[data-node-issue]').length).toBeGreaterThan(0);
    // …but NEVER in the export (TRANSIENT_SELECTORS, "export mid-gesture").
    expect(svgToString(svg)).not.toContain('data-node-issue');
    // Closing clears them.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(svg.querySelectorAll('[data-node-issue]')).toHaveLength(0);
  });

  it('the dock is resizable by dragging the top handle', () => {
    renderPanel();
    const panel = openPanel();
    expect(panel.getAttribute('style')).toContain('height: 240px');
    const handle = panel.querySelector('[data-lint-resize]')!;
    fireEvent.pointerDown(handle, { clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(panel.getAttribute('style')).toContain('height: 340px');
  });

  it('readOnly hides every mutating button but keeps the diagnostic list', () => {
    render(
      <BpmnDesigner diagram={buildDiagram()} readOnly>
        <LintPanel />
      </BpmnDesigner>,
    );
    const panel = openPanel();
    expect(panel.querySelector('[data-lint-row="u"]')).not.toBeNull();
    expect(panel.querySelector('[data-lint-fix]')).toBeNull();
    expect(screen.queryByTestId('lint-fix-all')).toBeNull();
  });
});
