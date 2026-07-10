import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import {
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { BpmnEditor, BpmnViewer, PT_BR } from '../src/index.js';
import { describeViolation, runAxe } from './axeHelper.js';

/**
 * Handoff 11 N-8 — accessibility gate. Zero CRITICAL axe violations on the main
 * react surfaces is a hard gate; serious/moderate are surfaced (logged) and
 * tracked in pendencias.md, not silently swallowed. The canvas keyboard
 * navigation is re-asserted here too (it already exists; this proves the a11y
 * pass didn't regress it).
 */
function diagram(): BpmnDiagram {
  const d = createDiagram({ name: 'A11y' });
  d.nodes = {
    a: createNode({ type: 'startEvent', id: 'a', label: 'Início', x: 40, y: 80 }),
    b: createNode({ type: 'task', id: 'b', label: 'Fazer', x: 160, y: 60 }),
    c: createNode({ type: 'endEvent', id: 'c', label: 'Fim', x: 320, y: 80 }),
  };
  d.edges = { e: createEdge({ id: 'e', sourceId: 'a', targetId: 'b' }) };
  return d;
}

async function expectNoCritical(container: Element, label: string) {
  const summary = await runAxe(container);
  if (summary.critical.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`${label} CRITICAL:\n${summary.critical.map(describeViolation).join('\n')}`);
  }
  // Surface serious/moderate counts for the pendencias ledger (never silent).
  // eslint-disable-next-line no-console
  console.log(
    `[a11y] ${label}: critical=${summary.byImpact.critical} serious=${summary.byImpact.serious} moderate=${summary.byImpact.moderate} minor=${summary.byImpact.minor}`,
  );
  expect(summary.critical, label).toEqual([]);
}

describe('a11y — zero critical axe violations (N-8)', () => {
  it('BpmnEditor (Designer chrome: toolbar, palette, inspector)', async () => {
    const { container } = render(<BpmnEditor diagram={diagram()} messages={PT_BR} />);
    await expectNoCritical(container, 'Designer');
  });

  it('BpmnViewer (lightweight read-only)', async () => {
    const { container } = render(<BpmnViewer diagram={diagram()} messages={PT_BR} />);
    await expectNoCritical(container, 'Viewer');
  });

  it('context menu (opened on an edge)', async () => {
    const { container } = render(<BpmnEditor diagram={diagram()} messages={PT_BR} />);
    const edge = container.querySelector('[data-edge-id="e"]')!;
    fireEvent.contextMenu(edge, { clientX: 100, clientY: 60 });
    expect(container.querySelector('[data-testid="context-menu"]')).not.toBeNull();
    await expectNoCritical(container, 'ContextMenu');
  });
});

describe('a11y — canvas keyboard navigation re-asserted (N-8)', () => {
  it('the canvas exposes an application role with an accessible name', () => {
    const { container } = render(<BpmnEditor diagram={diagram()} messages={PT_BR} />);
    const canvas = container.querySelector('svg.bpmnr-canvas')!;
    expect(canvas.getAttribute('role')).toBe('application');
    expect(canvas.getAttribute('aria-label')).toContain('A11y');
  });

  it('Escape clears selection through the dismissal stack', () => {
    const { container } = render(<BpmnEditor diagram={diagram()} messages={PT_BR} />);
    const node = container.querySelector('[data-node-id="b"]')!;
    fireEvent.pointerDown(node, { button: 0 });
    fireEvent.pointerUp(node, { button: 0 });
    expect(container.querySelector('[data-node-id="b"]')?.getAttribute('data-selected')).toBe('true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-node-id="b"]')?.getAttribute('data-selected')).toBeNull();
  });
});
