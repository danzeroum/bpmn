import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnSimulator } from '../src/simulation/BpmnSimulator.js';
import { edgeGeometryFor, nodeCenter } from '../src/simulation/edgePath.js';

/** The three-path prototype fixture (happy / rejection / timeout). */
function threePaths(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Sim' });
  const node = (id: string, type: string, x: number, y: number) => {
    diagram.nodes[id] = createNode({ id, type, label: id, x, y });
  };
  node('s', 'startEvent', 0, 100);
  node('prod', 'task', 100, 90);
  node('x', 'exclusiveGateway', 260, 95);
  node('ship', 'task', 380, 40);
  node('fix', 'task', 380, 150);
  node('timer', 'boundaryEvent', 150, 140);
  node('done', 'endEvent', 540, 45);
  node('rejected', 'endEvent', 540, 155);
  node('timedout', 'endEvent', 200, 240);
  diagram.nodes.timer.properties.attachedToRef = 'prod';
  diagram.nodes.timer.label = '48h';
  const edges: [string, string, string?][] = [
    ['s', 'prod'],
    ['prod', 'x'],
    ['x', 'ship', 'approve'],
    ['x', 'fix', 'reject'],
    ['ship', 'done'],
    ['fix', 'rejected'],
    ['timer', 'timedout'],
  ];
  edges.forEach(([source, target, label], index) => {
    diagram.edges[`e${index}`] = createEdge({ id: `e${index}`, sourceId: source, targetId: target, ...(label ? { label } : {}) });
  });
  return diagram;
}

const coverageText = (c: HTMLElement) =>
  c.querySelector('[data-sim-panel] .bpmnr-sim-card-title')?.textContent ?? '';

function advanceUntilChoiceOrDone(container: HTMLElement) {
  for (let i = 0; i < 10; i++) {
    const btn = container.querySelector<HTMLButtonElement>('[data-sim-advance]');
    if (!btn || btn.disabled) break;
    fireEvent.click(btn);
  }
}

describe('BpmnSimulator', () => {
  it('renders the mode pill, panel and 3-path coverage checklist', () => {
    const { container } = render(<BpmnSimulator diagram={threePaths()} />);
    expect(container.querySelector('[data-sim-pill]')?.textContent).toContain('MODO SIMULAÇÃO');
    expect(container.querySelector('[data-sim-panel]')).toBeInTheDocument();
    expect(coverageText(container)).toContain('0/3');
    expect(container.querySelectorAll('[data-sim-coverage] li')).toHaveLength(3);
    cleanup();
  });

  it('closes 3/3 across the happy, rejection and timeout sessions', () => {
    const { container } = render(<BpmnSimulator diagram={threePaths()} />);

    // Happy path — advance to the gate, choose approve, finish.
    advanceUntilChoiceOrDone(container);
    const approve = container.querySelector<HTMLButtonElement>('[data-sim-choice-option="e2"]');
    expect(approve).toBeTruthy();
    // Touch target ≥44px (§8).
    expect(approve!.style.minHeight).toBe('44px');
    fireEvent.click(approve!);
    advanceUntilChoiceOrDone(container);
    expect(coverageText(container)).toContain('1/3');

    // Rejection path.
    fireEvent.click(container.querySelector('[data-sim-reset]')!);
    advanceUntilChoiceOrDone(container);
    fireEvent.click(container.querySelector('[data-sim-choice-option="e3"]')!);
    advanceUntilChoiceOrDone(container);
    expect(coverageText(container)).toContain('2/3');

    // Timeout path — fire the boundary while the token rests on its host.
    fireEvent.click(container.querySelector('[data-sim-reset]')!);
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // s → prod
    const boundary = container.querySelector<HTMLButtonElement>('[data-sim-boundary="timer"]');
    expect(boundary).toBeTruthy();
    fireEvent.click(boundary!);
    advanceUntilChoiceOrDone(container);

    expect(coverageText(container)).toContain('3/3');
    expect(container.querySelectorAll('[data-sim-coverage] li[data-covered]')).toHaveLength(3);
    cleanup();
  });

  it('paints exercised edges and the active-node highlight in the overlay', () => {
    const { container } = render(<BpmnSimulator diagram={threePaths()} />);
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // s → prod
    expect(container.querySelector('[data-sim-exercised-edge="e0"]')).toBeTruthy();
    expect(container.querySelector('[data-sim-active-node="prod"]')).toBeTruthy();
    cleanup();
  });

  it('builds a session and hands it to onRecord, then shows the SACM confirmation', async () => {
    const onRecord = vi.fn();
    const { container } = render(<BpmnSimulator diagram={threePaths()} author="ana" onRecord={onRecord} />);

    // Close the happy path so coverage > 0 and the record button appears.
    advanceUntilChoiceOrDone(container);
    fireEvent.click(container.querySelector('[data-sim-choice-option="e2"]')!);
    advanceUntilChoiceOrDone(container);

    const record = container.querySelector<HTMLButtonElement>('[data-sim-record]');
    expect(record).toBeTruthy();
    fireEvent.click(record!);

    await waitFor(() => expect(onRecord).toHaveBeenCalledTimes(1));
    const session = onRecord.mock.calls[0][0];
    expect(session).toMatchObject({
      author: 'ana',
      coverage: { covered: 1, total: 3 },
    });
    expect(session.scenarioHash).toMatch(/^[0-9a-f]{12}$/);
    expect(session.scenario.decisions).toEqual([{ kind: 'exclusive', gateway: 'x', edge: 'e2' }]);

    // Default confirmation surfaces the roteiro hash and the SACM evidence line.
    await waitFor(() =>
      expect(container.querySelector('[data-sim-recorded]')).toHaveTextContent('Sessão registrada'),
    );
    expect(container.querySelector('[data-sim-recorded]')).toHaveTextContent('1/3 caminhos exercitados');
    expect(container.querySelector('[data-sim-record]')).toBeNull(); // button hides after recording
    cleanup();
  });

  it('defaults to step mode when the user prefers reduced motion', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal('matchMedia', matchMedia);
    const { container } = render(<BpmnSimulator diagram={threePaths()} />);
    const checkbox = container.querySelector<HTMLInputElement>('[data-sim-stepmode]');
    expect(checkbox?.checked).toBe(true);
    vi.unstubAllGlobals();
    cleanup();
  });
});

describe('edgeGeometryFor', () => {
  it('rounds explicit waypoints and computes a node center', () => {
    const diagram = threePaths();
    const edge = createEdge({
      id: 'w',
      sourceId: 's',
      targetId: 'prod',
      waypoints: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 40 },
      ],
    });
    const geometry = edgeGeometryFor(edge, diagram.nodes.s, diagram.nodes.prod, () => {
      throw new Error('router should not be called when waypoints exist');
    });
    expect(geometry?.path).toContain('M 0 0');
    expect(geometry?.path).toContain('Q');
    expect(nodeCenter(diagram.nodes.prod)).toEqual({ x: 160, y: 120 });
  });

  it('falls back to the edge router without waypoints', () => {
    const diagram = threePaths();
    const router = vi.fn().mockReturnValue({ path: 'M 0 0', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, midpoint: { x: 0.5, y: 0.5 } });
    const geometry = edgeGeometryFor(diagram.edges.e0, diagram.nodes.s, diagram.nodes.prod, router);
    expect(router).toHaveBeenCalledOnce();
    expect(geometry?.path).toBe('M 0 0');
  });

  it('returns null when an endpoint is missing', () => {
    const diagram = threePaths();
    expect(edgeGeometryFor(diagram.edges.e0, undefined, diagram.nodes.prod, () => {
      throw new Error('unused');
    })).toBeNull();
  });
});
