import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import type { Trace } from '@buildtovalue/replay';
import { BpmnReplay } from '../src/replay/BpmnReplay.js';
import { diagramToReplayGraph } from '../src/replay/diagramToReplayGraph.js';
import { formatDuration, heatWidth } from '../src/replay/format.js';

/** A → B → C model (labels match the log activities). */
function linearModel(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Replay' });
  const node = (id: string, label: string, x: number) => {
    diagram.nodes[id] = createNode({ id, type: id === 'a' ? 'startEvent' : id === 'c' ? 'endEvent' : 'task', label, x, y: 100 });
  };
  node('a', 'A', 0);
  node('b', 'B', 150);
  node('c', 'C', 300);
  diagram.edges.ab = createEdge({ id: 'ab', sourceId: 'a', targetId: 'b' });
  diagram.edges.bc = createEdge({ id: 'bc', sourceId: 'b', targetId: 'c' });
  return diagram;
}

const HOUR = 3_600_000;
const traces: Trace[] = [
  { caseId: 'c1', events: [{ activity: 'A', timestamp: 0 }, { activity: 'B', timestamp: 5 * HOUR }, { activity: 'C', timestamp: 6 * HOUR }] },
  { caseId: 'c2', events: [{ activity: 'A', timestamp: 0 }, { activity: 'B', timestamp: 5 * HOUR }, { activity: 'C', timestamp: 6 * HOUR }] },
  { caseId: 'c3', events: [{ activity: 'A', timestamp: 0 }, { activity: 'C', timestamp: HOUR }] }, // deviation A→C
];

describe('formatDuration', () => {
  it('formats seconds, hours and days in pt-BR', () => {
    expect(formatDuration(40_000)).toBe('40 s');
    expect(formatDuration(6.4 * HOUR)).toBe('6,4 h');
    expect(formatDuration(31 * HOUR)).toBe('31 h');
    expect(formatDuration(1.8 * 24 * HOUR)).toBe('1,8 dias');
  });
});

describe('heatWidth', () => {
  it('scales frequency into the 2–8px band', () => {
    expect(heatWidth(0, 100)).toBe(2);
    expect(heatWidth(100, 100)).toBe(8);
    expect(heatWidth(25, 100)).toBe(5); // 2 + 6*sqrt(.25)
  });
});

describe('diagramToReplayGraph', () => {
  it('projects nodes (id + label) and sequence-flow edges', () => {
    const graph = diagramToReplayGraph(linearModel());
    expect(graph.nodes).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ]);
    expect(graph.edges.map((e) => e.id)).toEqual(['ab', 'bc']);
  });
});

describe('BpmnReplay', () => {
  it('renders the violet mode pill, panel, fitness and heatmap', () => {
    const { container } = render(<BpmnReplay diagram={linearModel()} traces={traces} fileName="log.xes" />);
    expect(container.querySelector('[data-replay-pill]')?.textContent).toContain('MODO REPLAY');
    expect(container.querySelector('[data-replay-file]')?.textContent).toContain('log.xes');
    // 2 of 3 cases conform → fitness 4/5 = 80%.
    expect(container.querySelector('[data-replay-fitness]')?.textContent).toBe('80,0%');
    expect(container.querySelectorAll('[data-replay-edge]').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-replay-chip="b"]')?.textContent).toContain('GARGALO');
    cleanup();
  });

  it('lists the deviation and highlights it on click', () => {
    const { container } = render(<BpmnReplay diagram={linearModel()} traces={traces} />);
    const devs = container.querySelectorAll('[data-replay-devlist] [data-replay-dev]');
    expect(devs).toHaveLength(1); // A→C
    fireEvent.click(devs[0]);
    expect(container.querySelector('[data-replay-dev="0"][data-selected]')).toBeInTheDocument();
    expect(container.querySelector('[data-replay-deviation="0"][data-selected]')).toBeInTheDocument();
    cleanup();
  });

  it('shows the violet variant token when a variant is played', () => {
    const { container } = render(<BpmnReplay diagram={linearModel()} traces={traces} />);
    expect(container.querySelector('[data-replay-token]')).not.toBeInTheDocument();
    const play = container.querySelector<HTMLButtonElement>('[data-replay-play="0"]')!;
    fireEvent.click(play);
    expect(container.querySelector('[data-replay-token]')).toBeInTheDocument();
    cleanup();
  });
});

describe('BpmnReplay — governance (7B-3)', () => {
  const versions = [
    { versionId: 'v20', semanticVersion: '2.0.0', runCount: 3, traces },
    { versionId: 'v21', semanticVersion: '2.1.0', status: 'candidate', runCount: 0, traces: [] },
  ];
  const candidate = { semanticVersion: '2.1.0', change: 'boundary timer de 48h' };

  it('shows a version selector and the comparison card for the version with runs', () => {
    const { container } = render(
      <BpmnReplay diagram={linearModel()} versions={versions} candidate={candidate} author="ana" now={() => '2026-07-09T00:00:00.000Z'} />,
    );
    expect(container.querySelectorAll('[data-replay-version]')).toHaveLength(2);
    // v2.0.0 (with runs) is selected by default.
    expect(container.querySelector('[data-replay-version="v20"][data-active]')).toBeInTheDocument();
    const compare = container.querySelector('[data-replay-compare-text]');
    expect(compare?.textContent).toContain('O gargalo real da v2.0.0');
    expect(compare?.textContent).toContain('a v2.1.0 ataca isso: boundary timer de 48h');
    cleanup();
  });

  it('attaches the analysis to the promotion via the injected callback', () => {
    const onAttach = vi.fn();
    const { container } = render(
      <BpmnReplay diagram={linearModel()} versions={versions} candidate={candidate} onAttachAnalysis={onAttach} author="ana" now={() => '2026-07-09T00:00:00.000Z'} />,
    );
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-replay-attach]')!);
    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(onAttach.mock.calls[0][0]).toMatchObject({
      versionId: 'v20',
      candidateSemanticVersion: '2.1.0',
      bottleneck: { label: 'B' },
    });
    // The button flips to the confirmation.
    expect(container.querySelector('[data-replay-attached]')).toBeInTheDocument();
    cleanup();
  });

  it('switching to the candidate (no runs) shows the empty state, no comparison', () => {
    const { container } = render(
      <BpmnReplay diagram={linearModel()} versions={versions} candidate={candidate} author="ana" now={() => '2026-07-09T00:00:00.000Z'} />,
    );
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-replay-version="v21"]')!);
    expect(container.querySelector('[data-replay-version="v21"][data-active]')).toBeInTheDocument();
    expect(container.querySelector('[data-replay-compare]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-replay-fitness]')?.textContent?.trim()).toBe('—'); // no runs
    cleanup();
  });
});
