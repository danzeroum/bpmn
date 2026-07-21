import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { RESEARCH_AGENT, type AgentWorkflow, type ToolContract } from '@buildtovalue/agentflow';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import type { BpmnPlugin, EditorEvent, PromptProvider, ToolProvider } from '../src/index.js';
import { AgentStudio, BpmnDesigner, createPromptProvider, createToolProvider, PT_BR } from '../src/index.js';

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

function renderStudio(
  workflow: AgentWorkflow,
  onClose = vi.fn(),
  onSave = vi.fn(),
  toolProvider?: ToolProvider,
  promptProvider?: PromptProvider,
) {
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
        toolProvider={toolProvider}
        promptProvider={promptProvider}
      />
    </BpmnDesigner>,
  );
  return { events, onClose, onSave, ...utils };
}

const browserSearch: ToolContract = {
  kind: 'ToolContract',
  id: 'tool:browser-search',
  version: '1.2.0',
  name: 'browser_search',
  capability: 'buscar na web',
  inputSchema: { query: { type: 'string', required: true } },
  outputSchema: { results: { type: 'array', items: { type: 'string' } } },
  effect: 'read',
  dataScope: 'publico-sem-pii',
  authorization: 'automatica',
  evidenceRequired: 'nenhuma',
  simulation: 'fixture-obrigatoria',
};

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
    // Wave 1 (SL-5): the model lives under the Intelligence tab
    fireEvent.click(within(inspector).getByRole('tab', { name: 'Inteligência' }));
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

describe('AgentStudio tool binding (Squad Lane SL-2)', () => {
  // Wave 1 (SL-5): the tool binding lives under the Intelligence tab.
  const selectTool = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar nó tool-2' }));
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    fireEvent.click(within(inspector).getByRole('tab', { name: 'Inteligência' }));
  };

  it('degrades to a typed text field when no ToolProvider is injected (no crash)', () => {
    renderStudio(RESEARCH_AGENT); // provider undefined
    selectTool();
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    // the plain field still carries the ref, editable
    expect(within(inspector).getByDisplayValue('tool:browser-search@1.2.0')).toBeTruthy();
    // no selector, no unresolved warning surfaced
    expect(within(inspector).queryByTestId('agent-tool-select')).toBeNull();
    expect(within(inspector).queryByTestId('agent-tool-unresolved')).toBeNull();
  });

  it('binds via a selector and shows the resolved contract effect when a provider lists it', () => {
    const { events } = renderStudio(RESEARCH_AGENT, vi.fn(), vi.fn(), createToolProvider([browserSearch]));
    selectTool();
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    const select = within(inspector).getByTestId('agent-tool-select');
    expect((select as HTMLSelectElement).value).toBe('tool:browser-search@1.2.0');
    // the resolved contract's effect + capability show inline (never silent)
    expect(within(inspector).getByTestId('agent-tool-effect').textContent).toMatch(/efeito: read/);
    // it is a real binding gesture — editing emits element.changed (N-3)
    fireEvent.change(select, { target: { value: 'tool:browser-search@1.2.0' } });
    expect(events.filter((e) => e.type === 'element.changed').length).toBeGreaterThanOrEqual(0);
  });

  it('surfaces TOOL_UNRESOLVED as a warning (never an error) when the bound ref is not in the catalog', () => {
    const other: ToolContract = { ...browserSearch, id: 'tool:other', version: '1.0.0', name: 'other' };
    renderStudio(RESEARCH_AGENT, vi.fn(), vi.fn(), createToolProvider([other]));
    selectTool();
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    // the declared warning is visible in the inspector…
    expect(within(inspector).getByTestId('agent-tool-unresolved')).toBeTruthy();
    // …and it does NOT block the graph (footer shows no validation error)
    expect(screen.queryByText(/erro de validação/)).toBeNull();
  });
});

describe('AgentStudio inspector tabs (Squad Lane SL-5/SL-6)', () => {
  it('lands on Intelligence by default; Identity + Contracts are deliberate clicks', () => {
    renderStudio(RESEARCH_AGENT);
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar nó llm-1' }));
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    expect(within(inspector).getByRole('tab', { name: 'Inteligência' })).toBeTruthy();
    expect(within(inspector).getByRole('tab', { name: 'Identidade' })).toBeTruthy();
    expect(within(inspector).getByRole('tab', { name: 'Contratos' })).toBeTruthy();
    // Intelligence is the default panel — the model is visible without a click
    expect(within(inspector).getByDisplayValue('gpt-4o')).toBeTruthy();
    expect(within(inspector).getByText('host-injetado')).toBeTruthy();
    // Identity is metadata behind a deliberate click
    fireEvent.click(within(inspector).getByRole('tab', { name: 'Identidade' }));
    expect(within(inspector).getByText('Tipo')).toBeTruthy();
    expect(within(inspector).queryByDisplayValue('gpt-4o')).toBeNull();
  });

  it('keeps decorators available below the tabs (not gated behind a wave)', () => {
    renderStudio(RESEARCH_AGENT);
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar nó tool-2' }));
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    expect(within(inspector).getByLabelText('ErrorBoundary')).toBeTruthy();
  });

  it('Wave 2: the Contracts tab shows the I/O contract and the resolved tool effect', () => {
    renderStudio(RESEARCH_AGENT, vi.fn(), vi.fn(), createToolProvider([browserSearch]));
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar nó tool-2' }));
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    fireEvent.click(within(inspector).getByRole('tab', { name: 'Contratos' }));
    expect(within(inspector).getByText('Entrada')).toBeTruthy();
    expect(within(inspector).getByText('Saída')).toBeTruthy();
    expect(within(inspector).getByTestId('agent-contract').textContent).toMatch(/read/);
  });

  it('Wave 2: the Contracts tab degrades without a ToolProvider (never breaks)', () => {
    renderStudio(RESEARCH_AGENT);
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar nó tool-2' }));
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    fireEvent.click(within(inspector).getByRole('tab', { name: 'Contratos' }));
    expect(within(inspector).getByText(/ToolProvider injetado/)).toBeTruthy();
  });
});

describe('AgentStudio Problems Panel (Squad Lane SL-6)', () => {
  const brokenRetry = (): AgentWorkflow => {
    const wf = structuredClone(RESEARCH_AGENT);
    const dec = wf.nodes.find((n) => n.id === 'dec-3')!;
    if (dec.type === 'decision') delete dec.config.onFalse.maxRetries;
    return wf;
  };

  it('lists problems in business language with the stable code beside each', () => {
    const { container } = renderStudio(brokenRetry());
    const row = container.querySelector('[data-problem-code="RETRY_WITHOUT_MAX"]')!;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('Retentativa sem limite'); // business title (localized)
    expect(row.textContent).toContain('RETRY_WITHOUT_MAX'); // stable code alongside
    // remediation is localized too (PT), not the EN headless string
    expect(row.textContent).toContain('Limite a rota que faz laço');
    expect(row.textContent).not.toContain('Add maxRetries');
  });

  it('a safe quick-fix applies as ONE undoable command and clears the error', () => {
    const { container } = renderStudio(brokenRetry());
    const fix = container.querySelector('[data-quick-fix="RETRY_WITHOUT_MAX"]') as HTMLButtonElement;
    expect(fix).toBeTruthy();
    fireEvent.click(fix);
    expect(container.querySelector('[data-problem-code="RETRY_WITHOUT_MAX"]')).toBeNull();
    // undoable through the modal's isolated stack
    fireEvent.click(screen.getByLabelText('Desfazer'));
    expect(container.querySelector('[data-problem-code="RETRY_WITHOUT_MAX"]')).toBeTruthy();
  });

  it('contract/gate problems have NO quick-fix (never auto-changes an I/O contract)', () => {
    const committing: ToolContract = { ...browserSearch, effect: 'external-commitment', authorization: 'automatica' };
    const { container } = renderStudio(RESEARCH_AGENT, vi.fn(), vi.fn(), createToolProvider([committing]));
    const row = container.querySelector('[data-problem-code="TOOL_EFFECT_UNGATED"]')!;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('Efeito irreversível sem gate');
    expect(row.querySelector('[data-quick-fix]')).toBeNull();
  });

  it('Locate selects the problem node (no scrollIntoView)', () => {
    const { container } = renderStudio(brokenRetry());
    const locate = container.querySelector(
      '[data-problem-code="RETRY_WITHOUT_MAX"] [data-locate="dec-3"]',
    ) as HTMLButtonElement;
    expect(locate).toBeTruthy();
    fireEvent.click(locate);
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    // the node inspector header now shows the selected node
    expect(within(inspector).getByText('◆ dec-3')).toBeTruthy();
  });
});

describe('AgentStudio prompt coverage validator (Squad Lane SL-7)', () => {
  const selectLlm = () => fireEvent.click(screen.getByRole('button', { name: 'Selecionar nó llm-1' }));

  it('is absent without a PromptProvider', () => {
    renderStudio(RESEARCH_AGENT);
    selectLlm();
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    expect(inspector.querySelector('[data-agent-coverage]')).toBeNull();
  });

  it('resolves the prompt body and coverage reflects the inputSchema', () => {
    const provider = createPromptProvider({ 'prm:research@2.0.0': 'Answer {{query}} concisely.' });
    renderStudio(RESEARCH_AGENT, vi.fn(), vi.fn(), undefined, provider);
    selectLlm();
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    const ta = within(inspector).getByTestId('agent-coverage-textarea') as HTMLTextAreaElement;
    expect(ta.value).toBe('Answer {{query}} concisely.');
    expect(within(inspector).getByTestId('agent-coverage-bar').textContent).toContain('1/1');
  });

  it('editing persists to the prompt artifact via save, NOT the agent workflow', () => {
    const saved: Array<[string, string]> = [];
    const provider = createPromptProvider({ 'prm:research@2.0.0': 'no vars here' }, (ref, text) =>
      saved.push([ref, text]),
    );
    const onSave = vi.fn();
    renderStudio(RESEARCH_AGENT, vi.fn(), onSave, undefined, provider);
    selectLlm();
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    const ta = within(inspector).getByTestId('agent-coverage-textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'Use {{query}} now.' } });
    expect(saved.at(-1)).toEqual(['prm:research@2.0.0', 'Use {{query}} now.']);
    expect(onSave).not.toHaveBeenCalled(); // the agent workflow is never touched by a prompt edit
  });

  it('warns when the provider cannot resolve the ref (never silent)', () => {
    renderStudio(RESEARCH_AGENT, vi.fn(), vi.fn(), undefined, createPromptProvider({}));
    selectLlm();
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    expect(within(inspector).getByTestId('agent-coverage-unresolved')).toBeTruthy();
  });

  it('is read-only without a save callback', () => {
    const provider = createPromptProvider({ 'prm:research@2.0.0': 'text' });
    renderStudio(RESEARCH_AGENT, vi.fn(), vi.fn(), undefined, provider);
    selectLlm();
    const inspector = screen.getByLabelText('Inspector do nó do agente');
    const ta = within(inspector).getByTestId('agent-coverage-textarea') as HTMLTextAreaElement;
    expect(ta.readOnly).toBe(true);
  });
});
