import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnEditor, PT_BR, svgToString } from '../src/index.js';
import { buildLayoutProposal } from '../src/canvas/arrange.js';

/**
 * Handoff 14 §1e — auto-layout as a PROPOSAL (cerca §1.7): "Arrumar" shows
 * target ghosts + the Aplicar/Recusar card with counts; refusing changes
 * NOTHING; applying is ONE composite that also rigidly translates the manual
 * 📍 routes of moved nodes (translateManualEdges, R-3 — never re-routed) and
 * plays a 160ms crossfade (reduced-motion → none).
 */

function messy(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Messy' });
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', x: 500, y: 500 }),
    a: createNode({ id: 'a', type: 'task', x: 90, y: 400 }),
    b: createNode({ id: 'b', type: 'task', x: 10, y: 10 }),
    end: createNode({ id: 'end', type: 'endEvent', x: 5, y: 700 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'a' }),
    e2: createEdge({ id: 'e2', sourceId: 'a', targetId: 'b' }),
    e3: createEdge({ id: 'e3', sourceId: 'b', targetId: 'end' }),
  };
  return diagram;
}

/** messy() plus one MANUAL 📍 route between a and b (user-authored bends). */
function messyWithManualRoute(): BpmnDiagram {
  const diagram = messy();
  diagram.edges.e2 = {
    ...diagram.edges.e2,
    waypoints: [
      { x: 150, y: 430 },
      { x: 300, y: 250 },
      { x: 70, y: 40 },
    ],
    properties: { ...diagram.edges.e2.properties, routeMode: 'manual' },
  };
  return diagram;
}

const nodePos = (container: HTMLElement, id: string) => {
  const match = container
    .querySelector(`[data-node-id="${id}"]`)!
    .getAttribute('transform')!
    .match(/translate\(([-\d.]+), ([-\d.]+)\)/)!;
  return { x: Number(match[1]), y: Number(match[2]) };
};

function open(diagram = messy()) {
  const utils = render(<BpmnEditor diagram={diagram} messages={PT_BR} />);
  fireEvent.click(screen.getByRole('button', { name: 'Arrumar o diagrama automaticamente' }));
  return utils;
}

describe('layout proposal card (spec 1e)', () => {
  it('shows the counts in the mock format and target-position ghosts', () => {
    const { container } = open(messyWithManualRoute());
    const counts = screen.getByTestId('layout-counts').textContent!;
    expect(counts).toMatch(/\d+ nós movidos · \d+ arestas re-roteadas · 1 rota manual 📍 preservada/);
    // "DEPOIS" preview: one dashed ghost per moved node, nothing really moved.
    const ghosts = container.querySelectorAll('[data-layout-preview] rect');
    expect(ghosts.length).toBeGreaterThan(0);
    expect(nodePos(container, 'start').x).toBe(500);
  });

  it('Recusar discards the proposal — NOTHING changes, no undo entry', () => {
    const { container } = open();
    fireEvent.click(screen.getByTestId('layout-refuse'));
    expect(screen.queryByTestId('layout-proposal')).toBeNull();
    expect(container.querySelector('[data-layout-preview]')).toBeNull();
    expect(nodePos(container, 'start').x).toBe(500);
    // Nothing to undo: positions stay after Ctrl+Z.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(nodePos(container, 'start').x).toBe(500);
  });

  it('Esc refuses via the dismissal stack', () => {
    const { container } = open();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('layout-proposal')).toBeNull();
    expect(nodePos(container, 'start').x).toBe(500);
  });

  it('the preview ghosts NEVER leak into an export (mid-proposal)', () => {
    const { container } = open();
    const svg = container.querySelector('svg.bpmnr-canvas') as SVGSVGElement;
    expect(svg.querySelector('[data-layout-preview]')).not.toBeNull();
    expect(svgToString(svg)).not.toContain('data-layout-preview');
  });

  it('applying translates the manual 📍 rigidly — bends preserved, never re-routed', () => {
    const diagram = messyWithManualRoute();
    const proposal = buildLayoutProposal(diagram)!;
    expect(proposal.manualCount).toBe(1);
    const applied = proposal.command.execute(diagram);
    const route = applied.edges.e2.waypoints!;
    // Same number of waypoints — the route was translated, not re-routed.
    expect(route).toHaveLength(3);
    // Endpoints follow their own node's delta (a → first, b → last)…
    const aDelta = proposal.moved.find((m) => m.id === 'a')!;
    const bDelta = proposal.moved.find((m) => m.id === 'b')!;
    expect(route[0]).toEqual({
      x: 150 + (aDelta.to.x - aDelta.from.x),
      y: 430 + (aDelta.to.y - aDelta.from.y),
    });
    expect(route[2]).toEqual({
      x: 70 + (bDelta.to.x - bDelta.from.x),
      y: 40 + (bDelta.to.y - bDelta.from.y),
    });
    // …and the user-authored interior bend does not move.
    expect(route[1]).toEqual({ x: 300, y: 250 });
    // ONE undo restores positions AND the original manual route.
    const restored = proposal.command.undo(applied);
    expect(restored.edges.e2.waypoints).toEqual(diagram.edges.e2.waypoints);
    expect(restored.nodes.a.x).toBe(90);
  });

  it('applying plays the 160ms crossfade ghosts of the OLD positions', () => {
    const { container } = open();
    fireEvent.click(screen.getByTestId('layout-apply'));
    expect(container.querySelector('[data-layout-settle]')).not.toBeNull();
    // Crossfade artifacts never export either.
    const svg = container.querySelector('svg.bpmnr-canvas') as SVGSVGElement;
    expect(svgToString(svg)).not.toContain('data-layout-settle');
  });

  it('prefers-reduced-motion: apply is instant, ZERO crossfade ghosts', () => {
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
      const { container } = open();
      fireEvent.click(screen.getByTestId('layout-apply'));
      expect(container.querySelector('[data-layout-settle]')).toBeNull();
      expect(nodePos(container, 'start').x).not.toBe(500);
    } finally {
      window.matchMedia = original;
    }
  });

  it('a proposal computed against a stale diagram discards itself', () => {
    const { container } = open();
    expect(screen.getByTestId('layout-proposal')).toBeInTheDocument();
    // Any command while the card is open (delete a node) invalidates it.
    fireEvent.pointerDown(container.querySelector('[data-node-id="end"]')!, { button: 0 });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(screen.queryByTestId('layout-proposal')).toBeNull();
    // The earlier positions were never touched by the discarded proposal.
    expect(nodePos(container, 'start').x).toBe(500);
  });
});
