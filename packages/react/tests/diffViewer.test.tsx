import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  BpmnXmlConverter,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { BpmnDiffViewer, PT_BR, svgToString } from '../src/index.js';

/**
 * Handoff 15 V-2 — the diff painted on the read-only viewer (§2a).
 * Binding: read-only absoluto (cerca §1.1), XML round-trip byte-idêntico com
 * review ativo (§1.2), semântica visual do mock, tokens+glifo (nunca só cor),
 * rerouted pinta a rota, legenda com contagens, export mid-diff limpo.
 */

function baseDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Review', id: 'review' });
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
    fax: createNode({ id: 'fax', type: 'sendTask', label: 'Notificar fax', x: 400, y: 220 }),
    file: createNode({ id: 'file', type: 'task', label: 'Arquivar', x: 400, y: 100 }),
    end: createNode({ id: 'end', type: 'endEvent', label: 'Fim', x: 600, y: 100 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'limit' }),
    e2: createEdge({ id: 'e2', sourceId: 'limit', targetId: 'fax' }),
    e3: createEdge({ id: 'e3', sourceId: 'limit', targetId: 'file' }),
    e4: createEdge({ id: 'e4', sourceId: 'file', targetId: 'end' }),
  };
  return diagram;
}

function targetDiagram(): BpmnDiagram {
  const diagram = baseDiagram();
  const nodes = { ...diagram.nodes };
  const edges = { ...diagram.edges };
  nodes.limit = { ...nodes.limit, properties: { retries: 4, timeout: '30s' } }; // changed Δ1(properties)
  nodes.fraud = createNode({ id: 'fraud', type: 'serviceTask', label: 'Checar fraude', x: 200, y: 240 }); // added
  edges.e5 = createEdge({ id: 'e5', sourceId: 'limit', targetId: 'fraud' }); // added edge
  const { fax: _fax, ...withoutFax } = nodes; // removed node
  const { e2: _e2, ...withoutE2 } = edges; // removed edge
  withoutFax.file = { ...withoutFax.file, y: 180 }; // moved
  withoutE2.e4 = {
    ...withoutE2.e4,
    waypoints: [
      { x: 520, y: 210 },
      { x: 560, y: 130 },
      { x: 600, y: 130 },
    ],
  }; // rerouted-only
  return { ...diagram, nodes: withoutFax, edges: withoutE2 };
}

function renderDiff() {
  return render(<BpmnDiffViewer base={baseDiagram()} target={targetDiagram()} messages={PT_BR} />);
}

describe('BpmnDiffViewer — mock semantics (2a)', () => {
  it('dims unchanged elements to 45% via data-diff-state, never hides them', () => {
    const { container } = renderDiff();
    const start = container
      .querySelector('[data-node-id="start"]')!
      .closest('[data-diff-state]')!;
    expect(start.getAttribute('data-diff-state')).toBe('unchanged');
    // Touched elements carry their kind — the CSS dims only 'unchanged'.
    expect(
      container.querySelector('[data-node-id="fraud"]')!.closest('[data-diff-state]')!
        .getAttribute('data-diff-state'),
    ).toBe('added');
    expect(
      container.querySelector('[data-node-id="limit"]')!.closest('[data-diff-state]')!
        .getAttribute('data-diff-state'),
    ).toBe('changed');
  });

  it('removed = dashed ghost AT THE BASE POSITION with glyph+text (−REM)', () => {
    const { container } = renderDiff();
    // The removed node is NOT rendered as a real element…
    expect(container.querySelector('[data-node-id="fax"]')).toBeNull();
    // …but its ghost is, at the v-base position (400, 220).
    const ghost = container.querySelector('[data-diff-ghost="removed"]')!;
    expect(ghost.getAttribute('transform')).toBe('translate(400, 220)');
    expect(ghost.textContent).toContain('−REM');
    expect(ghost.textContent).toContain('Notificar fax');
  });

  it('moved = ghost at the origin + arrow to the destination (→MOV)', () => {
    const { container } = renderDiff();
    const ghost = container.querySelector('[data-diff-ghost="moved"]')!;
    const outline = ghost.querySelector('.bpmnr-diff-ghost-moved')!;
    expect(outline.getAttribute('x')).toBe('400');
    expect(outline.getAttribute('y')).toBe('100'); // origem na v-base
    expect(ghost.querySelector('.bpmnr-diff-move-arrow')).not.toBeNull();
    expect(ghost.querySelector('.bpmnr-diff-move-head')).not.toBeNull();
    expect(ghost.textContent).toContain('→MOV');
  });

  it('added carries the +ADD tag; changed shows the dashed halo + ΔN badge', () => {
    const { container } = renderDiff();
    expect(container.querySelector('[data-diff-ghost="added"]')!.textContent).toContain('+ADD');
    const changed = container.querySelector('[data-diff-ghost="changed"]')!;
    expect(changed.querySelector('.bpmnr-diff-halo-changed')).not.toBeNull();
    // ΔN = properties only (1 field) — never x/y/waypoints.
    expect(changed.querySelector('.bpmnr-diff-badge-text')!.textContent).toBe('Δ1');
  });

  it('ΔN badge opens the before→after popover; Esc closes it', () => {
    const { container } = renderDiff();
    fireEvent.click(container.querySelector('[data-diff-badge="limit"]')!);
    const popover = screen.getByTestId('diff-popover');
    expect(popover.textContent).toContain('Validar limite');
    const field = popover.querySelector('[data-diff-field="properties"]')!;
    expect(field.textContent).toContain('retries');
    expect(field.querySelector('.bpmnr-diff-popover-from')!.textContent).toContain('2');
    expect(field.querySelector('.bpmnr-diff-popover-to')!.textContent).toContain('4');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('diff-popover')).toBeNull();
  });

  it('rerouted paints the ROUTE (never a node halo) with the ↷ROTA tag', () => {
    const { container } = renderDiff();
    const route = container.querySelector('[data-diff-ghost="rerouted-edge"]')!;
    expect(route.querySelector('.bpmnr-diff-edge-rerouted')!.getAttribute('points')).toContain(
      '520,210',
    );
    expect(route.textContent).toContain('↷ROTA');
    // The endpoints of the rerouted edge get NO diff halo of their own.
    const end = container.querySelector('[data-node-id="end"]')!.closest('[data-diff-state]')!;
    expect(end.getAttribute('data-diff-state')).toBe('unchanged');
  });

  it('legend counts every category and the total', () => {
    renderDiff();
    const legend = screen.getByTestId('diff-legend');
    expect(legend.querySelector('[data-legend="added"]')!.textContent).toContain('+2'); // fraud + e5
    expect(legend.querySelector('[data-legend="removed"]')!.textContent).toContain('−2'); // fax + e2
    expect(legend.querySelector('[data-legend="moved"]')!.textContent).toContain('→1');
    expect(legend.querySelector('[data-legend="changed"]')!.textContent).toContain('Δ1');
    expect(legend.querySelector('[data-legend="rerouted"]')!.textContent).toContain('↷1');
    expect(legend.querySelector('[data-legend="total"]')!.textContent).toContain('7 mudanças');
  });
});

describe('BpmnDiffViewer — cercas §1.1/§1.2 (vinculantes)', () => {
  it('READ-ONLY absoluto: nenhum comando de mutação é alcançável', () => {
    const target = targetDiagram();
    const before = new BpmnXmlConverter().toXml(target);
    const { container } = render(<BpmnDiffViewer base={baseDiagram()} target={target} />);
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    const node = container.querySelector('[data-node-id="limit"]')!;
    // Every mutation entry point of the editor: selection+Delete, drag,
    // double-click label edit, keyboard quick-add, undo — none may exist.
    fireEvent.pointerDown(node, { button: 0 });
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 300 });
    fireEvent.pointerUp(svg, { button: 0 });
    fireEvent.doubleClick(node);
    fireEvent.keyDown(window, { key: 'Delete' });
    fireEvent.keyDown(window, { key: 'Tab' });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.contextMenu(node);
    // No editor affordances in the DOM…
    expect(container.querySelector('[data-ports]')).toBeNull();
    expect(container.querySelector('[data-context-pad]')).toBeNull();
    expect(container.querySelector('[data-testid="context-menu"]')).toBeNull();
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
    expect(container.querySelector('input, textarea')).toBeNull();
    // …and the diagram OBJECT is untouched: same XML, byte-identical.
    expect(new BpmnXmlConverter().toXml(target)).toBe(before);
  });

  it('XML round-trip stays byte-identical with review active (§1.2)', () => {
    const converter = new BpmnXmlConverter();
    const target = targetDiagram();
    const before = converter.toXml(target);
    const { container } = render(<BpmnDiffViewer base={baseDiagram()} target={target} />);
    // Interact with the review surface (badge → popover → Esc)…
    fireEvent.click(container.querySelector('[data-diff-badge="limit"]')!);
    fireEvent.keyDown(window, { key: 'Escape' });
    // …nothing of the review ever reaches the model or its XML.
    const after = converter.toXml(target);
    expect(after).toBe(before);
    // …and the round-trip through import stays byte-stable too.
    const { diagram: reimported } = converter.fromXml(after);
    expect(converter.toXml(reimported)).toBe(before);
  });

  it('the overlay and the paint NEVER leak into an export (mid-diff)', () => {
    const { container } = renderDiff();
    const svg = container.querySelector('svg.bpmnr-canvas') as SVGSVGElement;
    // Live DOM has the artifacts…
    expect(svg.querySelector('[data-diff-overlay]')).not.toBeNull();
    expect(svg.querySelector('[data-diff-state]')).not.toBeNull();
    // …the export has none (TRANSIENT_SELECTORS + TRANSIENT_ATTRIBUTES).
    const exported = svgToString(svg);
    expect(exported).not.toContain('data-diff-overlay');
    expect(exported).not.toContain('data-diff-state');
    expect(exported).not.toContain('bpmnr-diff-ghost');
  });
});
