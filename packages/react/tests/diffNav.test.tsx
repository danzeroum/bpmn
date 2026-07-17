import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  createDiagram,
  createEdge,
  createNode,
  diffDiagrams,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { BpmnDiffViewer, PT_BR, svgToString } from '../src/index.js';

/**
 * Handoff 15 V-3 — change-by-change navigation (§2b). Réguas da validação:
 * sequência = a MESMA ordem topológica da V-1 (teste de identidade);
 * F7/Shift+F7 com wrap + pan animado + 2 pulsos (reduced-motion → 0); chips
 * combináveis recalculam M preservando o item sobrevivente; lista
 * sincronizada clique-navega; removidos navegáveis (pan ao fantasma da
 * v-base); Esc local (decisão V-2); export mid-navegação limpo.
 */

function baseDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Nav', id: 'nav' });
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Início', x: 40, y: 100 }),
    limit: createNode({
      id: 'limit',
      type: 'serviceTask',
      label: 'Validar limite',
      x: 200,
      y: 100,
      properties: { retries: 2 },
    }),
    fax: createNode({ id: 'fax', type: 'sendTask', label: 'Notificar fax', x: 900, y: 500 }),
    end: createNode({ id: 'end', type: 'endEvent', label: 'Fim', x: 600, y: 100 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'limit' }),
    e2: createEdge({ id: 'e2', sourceId: 'limit', targetId: 'fax' }),
    e3: createEdge({ id: 'e3', sourceId: 'limit', targetId: 'end' }),
  };
  return diagram;
}

function targetDiagram(): BpmnDiagram {
  const diagram = baseDiagram();
  const nodes = { ...diagram.nodes };
  const edges = { ...diagram.edges };
  nodes.limit = { ...nodes.limit, properties: { retries: 4 } }; // changed
  nodes.fraud = createNode({ id: 'fraud', type: 'serviceTask', label: 'Checar fraude', x: 200, y: 260 }); // added
  edges.e4 = createEdge({ id: 'e4', sourceId: 'limit', targetId: 'fraud' }); // added edge
  const { fax: _fax, ...withoutFax } = nodes; // removed (ghost at 900,500)
  const { e2: _e2, ...withoutE2 } = edges; // removed edge
  return { ...diagram, nodes: withoutFax, edges: withoutE2 };
}

function renderNav(onClose?: () => void) {
  return render(
    <BpmnDiffViewer base={baseDiagram()} target={targetDiagram()} messages={PT_BR} onClose={onClose} />,
  );
}

const viewBoxOf = (container: HTMLElement) =>
  container.querySelector('svg.bpmnr-canvas')!.getAttribute('viewBox')!.split(' ').map(Number);

describe('diff navigation (spec 2b)', () => {
  it('the bar/list sequence is IDENTICAL to the core topological order', () => {
    const coreOrder = diffDiagrams(baseDiagram(), targetDiagram()).map(
      (e) => `${e.elementKind}:${e.elementId}`,
    );
    renderNav();
    const listOrder = [...screen.getByTestId('diff-list').querySelectorAll('[data-diff-item]')].map(
      (li) =>
        `${li.getAttribute('data-diff-item-kind') === 'rerouted' || li.querySelector('[data-kind]') ? '' : ''}${li.getAttribute('data-diff-item')}`,
    );
    // Compare element ids in order (kind prefix is a rendering detail).
    expect(listOrder).toEqual(coreOrder.map((k) => k.split(':')[1]));
    expect(screen.getByTestId('diff-nav-counter').textContent).toContain('de 5');
  });

  it('F7 walks with wrap, pans (animated) and plays 2 pulses; Shift+F7 goes back', async () => {
    const { container } = renderNav();
    fireEvent.keyDown(window, { key: 'F7' });
    // First step lands on entry 1 (visited discipline of the U-4 search).
    expect(screen.getByTestId('diff-nav-counter').textContent).toContain('mudança 1 de 5');
    // 2 pulse rings at the focus point.
    expect(container.querySelectorAll('.bpmnr-search-pulse')).toHaveLength(2);
    // The animated pan converges on the first entry (limit at 200,100 —
    // center 260,130 → viewport x = 260-600 = -340, y = 130-400 = -270).
    await waitFor(
      () => {
        const [x, y] = viewBoxOf(container);
        expect(Math.abs(x - -340)).toBeLessThan(1);
        expect(Math.abs(y - -270)).toBeLessThan(1);
      },
      { timeout: 5000 },
    );
    fireEvent.keyDown(window, { key: 'F7' });
    expect(screen.getByTestId('diff-nav-counter').textContent).toContain('mudança 2 de 5');
    // Shift+F7 walks back…
    fireEvent.keyDown(window, { key: 'F7', shiftKey: true });
    expect(screen.getByTestId('diff-nav-counter').textContent).toContain('mudança 1 de 5');
    // …and wraps below 1 to M.
    fireEvent.keyDown(window, { key: 'F7', shiftKey: true });
    expect(screen.getByTestId('diff-nav-counter').textContent).toContain('mudança 5 de 5');
  });

  it('prefers-reduced-motion: instant pan, ZERO pulses', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      const { container } = renderNav();
      fireEvent.keyDown(window, { key: 'F7' });
      expect(container.querySelectorAll('.bpmnr-search-pulse')).toHaveLength(0);
      const [x] = viewBoxOf(container);
      expect(Math.abs(x - -340)).toBeLessThan(1); // instantâneo
    } finally {
      window.matchMedia = original;
    }
  });

  it('chips filter with counts; M recalcula e o item atual sobrevive com novo N', () => {
    renderNav();
    const chips = screen.getByTestId('diff-nav');
    expect(chips.querySelector('[data-diff-chip="added"]')!.textContent).toContain('+2');
    expect(chips.querySelector('[data-diff-chip="removed"]')!.textContent).toContain('−2');
    expect(chips.querySelector('[data-diff-chip="changed"]')!.textContent).toContain('Δ1');
    // Navigate to the CHANGED entry (limit — first in topological order).
    fireEvent.keyDown(window, { key: 'F7' });
    expect(screen.getByTestId('diff-list').querySelector('[data-diff-item="limit"]')!.getAttribute('aria-selected')).toBe('true');
    // Filter to changed-only: M becomes 1 and the survivor keeps its place as N=1.
    fireEvent.click(chips.querySelector('[data-diff-chip="changed"]')!);
    expect(screen.getByTestId('diff-nav-counter').textContent).toContain('mudança 1 de 1');
    expect(screen.getByTestId('diff-list').querySelectorAll('[data-diff-item]')).toHaveLength(1);
    expect(screen.getByTestId('diff-list').querySelector('[data-diff-item="limit"]')!.getAttribute('aria-selected')).toBe('true');
    // Combinable: adding the added-chip keeps the survivor active with M=3.
    fireEvent.click(chips.querySelector('[data-diff-chip="added"]')!);
    expect(screen.getByTestId('diff-nav-counter').textContent).toContain('de 3');
    expect(screen.getByTestId('diff-list').querySelector('[data-diff-item="limit"]')!.getAttribute('aria-selected')).toBe('true');
  });

  it('clicking a list row navigates (pan converge) and the active row follows', async () => {
    const { container } = renderNav();
    const row = screen.getByTestId('diff-list').querySelector('[data-diff-item="fraud"]')!;
    fireEvent.click(row);
    expect(row.getAttribute('aria-selected')).toBe('true');
    // fraud at 200,260 center (260,290) → x=-340, y=-110.
    await waitFor(
      () => {
        const [x, y] = viewBoxOf(container);
        expect(Math.abs(x - -340)).toBeLessThan(1);
        expect(Math.abs(y - -110)).toBeLessThan(1);
      },
      { timeout: 5000 },
    );
  });

  it('REMOVIDOS são navegáveis: o pan vai à posição do fantasma na v-base', async () => {
    const { container } = renderNav();
    const row = screen.getByTestId('diff-list').querySelector('[data-diff-item="fax"]')!;
    expect(row.getAttribute('data-diff-item-kind')).toBe('removed');
    fireEvent.click(row);
    // Ghost at base position 900,500 (120×60 → center 960,530): x=360, y=130.
    await waitFor(
      () => {
        const [x, y] = viewBoxOf(container);
        expect(Math.abs(x - 360)).toBeLessThan(1);
        expect(Math.abs(y - 130)).toBeLessThan(1);
      },
      { timeout: 5000 },
    );
  });

  it('Esc segue a decisão V-2: popover primeiro, depois onClose do host', () => {
    const onClose = vi.fn();
    const { container } = renderNav(onClose);
    fireEvent.click(container.querySelector('[data-diff-badge="limit"]')!);
    expect(screen.getByTestId('diff-popover')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('diff-popover')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('export mid-navegação: pulso e overlay nunca vazam (TRANSIENT_*)', () => {
    const { container } = renderNav();
    fireEvent.keyDown(window, { key: 'F7' });
    const svg = container.querySelector('svg.bpmnr-canvas') as SVGSVGElement;
    expect(svg.querySelectorAll('.bpmnr-search-pulse').length).toBeGreaterThan(0);
    const exported = svgToString(svg);
    expect(exported).not.toContain('bpmnr-search-pulse');
    expect(exported).not.toContain('data-diff-overlay');
    expect(exported).not.toContain('data-diff-state');
  });
});
