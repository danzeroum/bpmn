import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { RESEARCH_AGENT, type AgentWorkflow, type Fixtures } from '@buildtovalue/agentflow';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import type { AgentSimulationRecord, BpmnPlugin } from '../src/index.js';
import { AgentStudio, BpmnDesigner, PT_BR, useDiagram } from '../src/index.js';
import type { DiagramContextValue } from '../src/contexts/DiagramContext.js';

/**
 * Handoff 12 A-5 — simulation in the Studio (shared H7 trail/stops UI),
 * the never-silent undoable boundary proposal, and the ledger session (§9.6).
 */
function hostDiagram(): BpmnDiagram {
  const d = createDiagram({ name: 'Macro' });
  d.nodes = { t1: createNode({ type: 'agentTask', id: 't1', label: 'Pesquisar', x: 120, y: 100 }) };
  return d;
}

function Driver({ onReady }: { onReady: (api: DiagramContextValue) => void }) {
  const api = useDiagram();
  useEffect(() => {
    onReady(api);
  });
  return null;
}

function renderSim(
  workflow: AgentWorkflow,
  extra: Partial<React.ComponentProps<typeof AgentStudio>> = {},
) {
  let latest: BpmnDiagram | undefined;
  let api: DiagramContextValue | undefined;
  const plugin: BpmnPlugin = { id: 'obs/sim' };
  render(
    <BpmnDesigner diagram={hostDiagram()} plugins={[plugin]} messages={PT_BR} onChange={(d) => (latest = d)}>
      <AgentStudio
        open
        workflow={workflow}
        workflowRef="agnt-rsch@2.1.0"
        openedFrom="Pesquisar"
        agentTaskId="t1"
        onSave={vi.fn()}
        onClose={vi.fn()}
        {...extra}
      />
      <Driver onReady={(a) => (api = a)} />
    </BpmnDesigner>,
  );
  return { getLatest: () => latest, getApi: () => api! };
}

beforeEach(() => {
  // Default: motion allowed. Individual tests override for the reduced path.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('AgentStudio — simulation (shared trail/stops)', () => {
  it('simulating with no fixtures shows the declared block (node + reason) in the shared chip', () => {
    renderSim(RESEARCH_AGENT); // empty fixtures → output.is_complete absent → honest stop
    fireEvent.click(screen.getByRole('button', { name: /Simular/ }));
    const chip = screen.getByTestId('decision-blocked');
    expect(chip).toBeTruthy();
    // the trail (shared UI) names the blocked node
    const trail = screen.getByText(/⛔ dec-3/);
    expect(trail).toBeTruthy();
  });

  it('reduced-motion jumps straight to the end (0ms — no interval scheduled)', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    renderSim(RESEARCH_AGENT);
    fireEvent.click(screen.getByRole('button', { name: /Simular/ }));
    expect(setInterval).not.toHaveBeenCalled(); // 0ms path
    expect(screen.getByTestId('decision-blocked')).toBeTruthy(); // full result already shown
  });

  it('animates step-by-step (interval scheduled) when motion is allowed', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    renderSim(RESEARCH_AGENT);
    fireEvent.click(screen.getByRole('button', { name: /Simular/ }));
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 400);
  });

  it('records a session to the ledger with the ref@version (blocked run)', () => {
    const onRecordSimulation = vi.fn<(record: AgentSimulationRecord) => void>();
    renderSim(RESEARCH_AGENT, { onRecordSimulation, author: 'u-1', timestamp: '2026-07-10T00:00:00.000Z' });
    fireEvent.click(screen.getByRole('button', { name: /Simular/ }));
    fireEvent.click(screen.getByTestId('agent-record'));
    expect(onRecordSimulation).toHaveBeenCalledWith(
      expect.objectContaining({ workflowRef: 'agnt-rsch@2.1.0', complete: false, author: 'u-1' }),
    );
    expect(onRecordSimulation.mock.calls[0][0].blocked?.nodeId).toBe('dec-3');
  });
});

describe('AgentStudio — boundary proposal (never silent, undoable)', () => {
  it('accept adds ONE boundary event on the macro agentTask; undo removes it', () => {
    const { getLatest, getApi } = renderSim(RESEARCH_AGENT); // has an errorBoundary decorator
    fireEvent.click(screen.getByText(/Salvar e voltar/));
    expect(screen.getByTestId('agent-boundary-proposal')).toBeTruthy();
    fireEvent.click(screen.getByTestId('agent-boundary-accept'));
    const attached = Object.values(getLatest()!.nodes).filter(
      (n) => n.type === 'boundaryEvent' && n.properties.attachedToRef === 't1',
    );
    expect(attached).toHaveLength(1);
    // one undoable command → a single undo removes it
    getApi().undo();
    const after = Object.values(getLatest()!.nodes).filter((n) => n.type === 'boundaryEvent');
    expect(after).toHaveLength(0);
  });

  it('refuse changes nothing and does not re-ask in the same session', () => {
    const { getLatest } = renderSim(RESEARCH_AGENT);
    fireEvent.click(screen.getByText(/Salvar e voltar/));
    fireEvent.click(screen.getByTestId('agent-boundary-refuse'));
    expect(screen.queryByTestId('agent-boundary-proposal')).toBeNull();
    expect(Object.values(getLatest()?.nodes ?? {}).some((n) => n.type === 'boundaryEvent')).toBe(false);
    // saving again does not re-open the proposal
    fireEvent.click(screen.getByText(/Salvar e voltar/));
    expect(screen.queryByTestId('agent-boundary-proposal')).toBeNull();
  });
});

describe('AgentStudio — templates', () => {
  it('an empty canvas offers the template chooser with the ★ default', () => {
    const emptyWf: AgentWorkflow = {
      kind: 'AgentWorkflow',
      id: 'agnt-blank',
      version: '1.0.0',
      name: 'Blank',
      autonomyLevel: 1,
      inputSchema: { x: 'string' },
      outputSchema: { y: 'string' },
      nodes: [],
      edges: [],
    };
    renderSim(emptyWf);
    const chooser = screen.getByTestId('agent-template-chooser');
    expect(chooser.textContent).toMatch(/Approval Gate Agent ★ default/);
  });
});

// exercise a completing run for the record "complete" path
const COMPLETE_FIXTURES: Fixtures = {
  'llm-1': { outputs: [{ is_complete: true, answer: 'ok' }] },
  'tool-2': { outputs: [{ results: ['a'] }] },
};
describe('AgentStudio — completing simulation', () => {
  it('a configured run completes and can be recorded as complete', () => {
    const onRecordSimulation = vi.fn<(record: AgentSimulationRecord) => void>();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
    renderSim(RESEARCH_AGENT, { simulationFixtures: COMPLETE_FIXTURES, onRecordSimulation, author: 'u-1', timestamp: 'ts' });
    fireEvent.click(screen.getByRole('button', { name: /Simular/ }));
    expect(screen.queryByTestId('decision-blocked')).toBeNull();
    fireEvent.click(screen.getByText(/Registrar sessão/));
    expect(onRecordSimulation.mock.calls[0][0].complete).toBe(true);
  });
});
