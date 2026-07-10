import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { RESEARCH_AGENT, type AgentWorkflow } from '@buildtovalue/agentflow';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import type { BpmnPlugin, EditorEvent } from '../src/index.js';
import { AgentStudio, BpmnDesigner, PT_BR } from '../src/index.js';

/**
 * Handoff 12 A-4 — the Agent Studio shell (§9.5): opens over the Designer,
 * edits emit N-3 catalog events from inside the modal, Esc closes the modal
 * before any Designer dismissal, validation is visible with remediation, and
 * every string is localized (grep gate guards the file separately).
 */
function hostDiagram(): BpmnDiagram {
  const d = createDiagram({ name: 'Macro' });
  d.nodes = { t1: createNode({ type: 'agentTask', id: 't1', label: 'Pesquisar', x: 40, y: 40 }) };
  return d;
}

function capture(): { events: EditorEvent[]; plugin: BpmnPlugin } {
  const events: EditorEvent[] = [];
  return { events, plugin: { id: 'obs/agent', onEditorEvent: (e) => events.push(e) } };
}

function renderStudio(workflow: AgentWorkflow, onClose = vi.fn(), onSave = vi.fn()) {
  const { events, plugin } = capture();
  const utils = render(
    <BpmnDesigner diagram={hostDiagram()} plugins={[plugin]} messages={PT_BR}>
      <AgentStudio
        open
        workflow={workflow}
        workflowRef="agnt-rsch@2.1.0"
        lifecycleStatus="CANDIDATA"
        openedFrom="Pesquisar"
        onSave={onSave}
        onClose={onClose}
      />
    </BpmnDesigner>,
  );
  return { events, onClose, onSave, ...utils };
}

const of = (events: EditorEvent[], type: string) => events.filter((e) => e.type === type);

describe('AgentStudio shell', () => {
  it('renders the modal over the Designer with the ref + autonomy pill', () => {
    renderStudio(RESEARCH_AGENT);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Agent Studio — Research Agent/)).toBeTruthy();
    expect(within(dialog).getByText(/agnt-rsch@2\.1\.0/)).toBeTruthy();
    expect(within(dialog).getByText(/CANDIDATA/)).toBeTruthy();
  });

  it('adding a node emits element.added + command.executed from INSIDE the modal', () => {
    const { events } = renderStudio(RESEARCH_AGENT);
    const before = RESEARCH_AGENT.nodes.length;
    fireEvent.click(screen.getByLabelText(/Adicionar LLM Call/));
    // a new selectable node appeared on the canvas
    expect(screen.getAllByRole('button', { name: /Selecionar nó/ }).length).toBe(before + 1);
    // the modal is not a silent hole in the bus (N-3)
    const added = of(events, 'element.added').filter((e) => (e.meta as { kind?: string })?.kind === 'node');
    expect(added.length).toBeGreaterThan(0);
    expect(of(events, 'command.executed').length).toBeGreaterThan(0);
  });

  it('undo is isolated + emits command.undone (never touches the BPMN behind)', () => {
    const { events } = renderStudio(RESEARCH_AGENT);
    const before = RESEARCH_AGENT.nodes.length;
    fireEvent.click(screen.getByLabelText(/Adicionar Tool Call/));
    expect(screen.getAllByRole('button', { name: /Selecionar nó/ }).length).toBe(before + 1);
    fireEvent.click(screen.getByLabelText('Desfazer'));
    expect(screen.getAllByRole('button', { name: /Selecionar nó/ }).length).toBe(before);
    expect(of(events, 'command.undone').length).toBe(1);
  });

  it('Esc closes the modal before any Designer dismissal (dismissal stack)', () => {
    const onClose = vi.fn();
    renderStudio(RESEARCH_AGENT, onClose);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a §3 validation error with its remediation in the footer', () => {
    const broken: AgentWorkflow = { ...structuredClone(RESEARCH_AGENT), inputSchema: {} };
    renderStudio(broken);
    expect(screen.getByText(/erro de validação/)).toBeTruthy();
    expect(screen.getByText(/Correção:/)).toBeTruthy();
  });

  it('Save returns the edited sub-workflow to the host (Library, never the XML)', () => {
    const onSave = vi.fn();
    renderStudio(RESEARCH_AGENT, vi.fn(), onSave);
    fireEvent.click(screen.getByText(/Salvar e voltar/));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'agnt-rsch' }));
  });

  it('selecting a node opens the inspector; editing a field emits element.changed', () => {
    const { events } = renderStudio(RESEARCH_AGENT);
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar nó llm-1' }));
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    const model = within(inspector).getByDisplayValue('gpt-4o');
    fireEvent.change(model, { target: { value: 'gpt-5' } });
    expect(of(events, 'element.changed').length).toBeGreaterThan(0);
  });

  it('toggling ErrorBoundary shows the undoable boundary-proposal notice', () => {
    renderStudio(RESEARCH_AGENT);
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar nó tool-2' }));
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    fireEvent.click(within(inspector).getByLabelText('ErrorBoundary'));
    expect(within(inspector).getByText(/boundary event de erro no nó BPMN/)).toBeTruthy();
  });

  it('applying a template replaces the sub-workflow (governance default first)', () => {
    renderStudio(RESEARCH_AGENT);
    fireEvent.click(screen.getByText('Approval Gate Agent'));
    expect(screen.getByText(/Agent Studio — Approval Gate Agent/)).toBeTruthy();
  });
});
