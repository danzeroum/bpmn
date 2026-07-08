import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import {
  createDiagram,
  createEdge,
  createNode,
  edgeVersionDiff,
  type BpmnDiagram,
  type BpmnEdge,
} from '@bpmn-react/core';
import { BpmnDesigner, EdgePedigreeStrip } from '../src/index.js';

/** gate→publish handoff renegotiated twice: e1a (closed) → e1b (closed) → e1. */
function chainDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Pedigree' });
  const v = diagram.version.id;
  diagram.nodes = {
    gate: createNode({ type: 'task', id: 'gate', label: 'Gate', x: 40, y: 40 }),
    publish: createNode({ type: 'serviceTask', id: 'publish', label: 'Publish', x: 320, y: 40 }),
  };
  const base = (id: string, label: string): BpmnEdge =>
    createEdge({ id, sourceId: 'gate', targetId: 'publish', type: 'handoff', label, versionId: v });
  diagram.edges = {
    e1a: { ...base('e1a', 'sem canal'), removedInVersion: v },
    e1b: { ...base('e1b', 'canal piloto'), supersedesEdgeId: 'e1a', removedInVersion: v },
    e1: { ...base('e1', 'approved'), supersedesEdgeId: 'e1b' },
  };
  return diagram;
}

const mount = (props: Partial<Parameters<typeof EdgePedigreeStrip>[0]> = {}) =>
  render(
    <BpmnDesigner diagram={chainDiagram()}>
      <EdgePedigreeStrip edgeId="e1b" {...props} />
    </BpmnDesigner>,
  );

describe('EdgePedigreeStrip (Handoff 5 §5, aceite 10.5.7)', () => {
  it('renders the FULL chain in temporal order from ANY member edge', () => {
    const { container } = mount(); // mounted from the MIDDLE of the chain
    const cards = [...container.querySelectorAll('[data-pedigree-card]')];
    expect(cards.map((card) => card.getAttribute('data-pedigree-card'))).toEqual([
      'e1a',
      'e1b',
      'e1',
    ]);
    // "supersede ▸" in gold between cards — exactly N-1 of them.
    expect(container.querySelectorAll('.bpmnr-pedigree-supersede')).toHaveLength(2);
    // Labels: mono line under each card with label + version tag.
    expect(container.querySelectorAll('.bpmnr-pedigree-label')[0]?.textContent).toContain(
      'sem canal',
    );
    expect(container.querySelectorAll('.bpmnr-pedigree-label')[2]?.textContent).toContain(
      'v0.1.0',
    );
  });

  it('hatches closed versions and gold-marks the current one with the vigência badge', () => {
    const { container } = mount();
    expect(
      container.querySelector('[data-pedigree-card="e1a"] [data-pedigree-hatch]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-pedigree-card="e1"] [data-pedigree-hatch]'),
    ).toBeNull();
    const current = container.querySelector('[data-pedigree-card="e1"]')!;
    expect(current.getAttribute('data-pedigree-current')).toBe('true');
    expect(current.querySelector('.bpmnr-pedigree-badge')?.textContent).toBe('RASCUNHO');
    // 1 hatch def for the whole strip, used by both closed cards.
    expect(container.querySelectorAll('pattern#bpmnr-pedigree-hatch')).toHaveLength(1);
  });

  it('card snapshots use the REAL registered shapes of the endpoints', () => {
    const { container } = mount();
    const snapshot = container.querySelector('[data-pedigree-card="e1"] svg')!;
    // Built-in task/serviceTask shapes render rects (cards, not placeholders)
    // plus the border-anchored straight segment between them.
    expect(snapshot.querySelectorAll('rect').length).toBeGreaterThanOrEqual(2);
    expect(snapshot.querySelector('path[d^="M "]')).toBeInTheDocument();
  });

  it('clicking a card opens the DiffView of the two ADJACENT versions; Esc closes diff → strip', () => {
    const onClose = vi.fn();
    const { container } = mount({ onClose });
    fireEvent.click(container.querySelector('[data-pedigree-card="e1b"]')!);
    const panel = container.querySelector('[data-pedigree-diff]')!;
    expect(panel).toBeInTheDocument();
    // supersede op + field changes between e1a and e1b.
    expect(panel.textContent).toContain('e1a superseded by e1b');
    expect(panel.textContent).toContain('label');
    // Root card has no predecessor — not clickable.
    expect(
      (container.querySelector('[data-pedigree-card="e1a"]') as HTMLButtonElement).disabled,
    ).toBe(true);

    // §11.1: first Esc closes the diff, second closes the strip.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-pedigree-diff]')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the ledger hash on hover via the host resolver (§5: hover = hash)', () => {
    const { container } = mount({
      ledgerHash: (edge) => (edge.id === 'e1b' ? 'abc1234def' : undefined),
    });
    expect(container.querySelector('[data-pedigree-card="e1b"]')?.getAttribute('title')).toBe(
      'ledger #abc1234',
    );
    expect(container.querySelector('[data-pedigree-card="e1"]')?.getAttribute('title')).toBeNull();
  });
});

describe('edgeVersionDiff (core plug do DiffView)', () => {
  it('reports the supersede op plus the field changes between adjacent versions', () => {
    const diagram = chainDiagram();
    const diff = edgeVersionDiff(diagram.edges.e1a, diagram.edges.e1b);
    expect(diff.edges[0]).toEqual({ op: 'supersede', edgeId: 'e1a', newEdgeId: 'e1b' });
    const update = diff.edges[1];
    expect(update.op).toBe('update');
    if (update.op === 'update') {
      expect(update.changes.label).toEqual({ from: 'sem canal', to: 'canal piloto' });
      // removedInVersion differs too (e1a closed by v, e1b closed by v — equal)…
      expect(update.changes.sourceId).toBeUndefined(); // unchanged endpoints stay out
    }
  });

  it('collapses to just the supersede op when nothing else changed', () => {
    const diagram = chainDiagram();
    const twin = { ...diagram.edges.e1a, id: 'e1x' };
    const diff = edgeVersionDiff(diagram.edges.e1a, twin);
    expect(diff.edges).toHaveLength(1);
    expect(diff.edges[0].op).toBe('supersede');
  });
});
