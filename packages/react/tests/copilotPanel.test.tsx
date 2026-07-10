import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { createDiagram, type BpmnDiagram } from '@buildtovalue/core';
import type { AIProvider } from '@buildtovalue/copilot';
import { BpmnDesigner, CopilotPanel } from '../src/index.js';

/**
 * Handoff 9 CP-2 — the governed copilot panel with a DETERMINISTIC FAKE
 * provider (§8.6: CI never calls the network). C1 draft applies as ONE
 * composite with AI authorship; integral rejection shows errors and applies
 * nothing; "Desfazer tudo" reverts the whole plan in one step; without a
 * provider the panel is absent (§8.5).
 */
const DRAFT = JSON.stringify({
  commands: [
    { type: 'addNode', params: { id: 's', type: 'startEvent', label: 'Início', x: 0, y: 100 } },
    { type: 'addNode', params: { id: 't', type: 'task', label: 'Analisar', x: 160, y: 90 } },
    { type: 'addNode', params: { id: 'e', type: 'endEvent', label: 'Fim', x: 360, y: 100 } },
    { type: 'addEdge', params: { id: 'f1', sourceId: 's', targetId: 't' } },
    { type: 'addEdge', params: { id: 'f2', sourceId: 't', targetId: 'e' } },
  ],
  rationale: 'Rascunho do processo de reembolso.',
  promptTemplateRef: { id: 'copilot-draft', version: '1.0.0' },
});

const fakeProvider = (responses: string[]): AIProvider => {
  let call = 0;
  return { id: 'claude-4', complete: async () => responses[Math.min(call++, responses.length - 1)] };
};

function mount(provider: AIProvider | undefined, onChange?: (d: BpmnDiagram) => void) {
  return render(
    <BpmnDesigner diagram={createDiagram({ name: 'C' })} onChange={onChange}>
      <CopilotPanel
        provider={provider}
        author="ana.ruiz"
        resolveLedgerHash={async () => 'abcdef1234567890'}
      />
    </BpmnDesigner>,
  );
}

async function generate(container: HTMLElement, text = 'processo de reembolso') {
  fireEvent.change(container.querySelector('textarea')!, { target: { value: text } });
  fireEvent.click(container.querySelector('[data-testid="copilot-generate"]')!);
  await waitFor(() => expect(container.querySelector('[data-testid="copilot-footer"]')).not.toBeNull());
}

describe('CopilotPanel (CP-2)', () => {
  it('without a provider the panel is absent — zero regression (§8.5)', () => {
    const { container } = mount(undefined);
    expect(container.querySelector('[data-testid="copilot-panel"]')).toBeNull();
  });

  it('header shows provider, versioned prompt-template and the SÓ RASCUNHA pill (§6)', () => {
    const { container } = mount(fakeProvider([DRAFT]));
    expect(container.querySelector('[data-testid="copilot-meta"]')?.textContent).toContain(
      'claude-4 · prompt: copilot-draft v1.0.0',
    );
    expect(container.querySelector('[data-testid="copilot-pill"]')?.textContent).toBe('SÓ RASCUNHA');
  });

  it('C1: draft applies as ONE composite with AI authorship + local soundness footer', async () => {
    const onChange = vi.fn();
    const { container } = mount(fakeProvider([DRAFT]), onChange);
    await generate(container);

    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(Object.keys(latest.nodes)).toHaveLength(3);
    const footer = container.querySelector('[data-testid="copilot-footer"]')!.textContent!;
    expect(footer).toContain('autoria: ia.copilot@claude-4 + ana.ruiz');
    expect(footer).toContain('ledger: #abcdef123456');
    expect(footer).toContain('soundness: 0 erros');
    // Mixed-authorship draft seal (§6).
    expect(container.querySelector('[data-testid="copilot-seal"]')?.textContent).toContain(
      'ia.copilot@claude-4',
    );
  });

  it('"Desfazer tudo" reverts the WHOLE plan in one step (§8.3)', async () => {
    const onChange = vi.fn();
    const { container } = mount(fakeProvider([DRAFT]), onChange);
    await generate(container);
    const undoAll = container.querySelector('[data-testid="copilot-undo-all"]') as HTMLButtonElement;
    expect(undoAll.disabled).toBe(false);
    fireEvent.click(undoAll);
    const latest = onChange.mock.lastCall![0] as BpmnDiagram;
    expect(Object.keys(latest.nodes)).toHaveLength(0);
  });

  it('integral rejection: a proposal smuggling `promote` applies NOTHING and shows the error', async () => {
    const bad = JSON.stringify({
      commands: [
        { type: 'addNode', params: { id: 's', type: 'startEvent', label: 'I', x: 0, y: 0 } },
        { type: 'promote', params: {} },
      ],
      rationale: 'tenta governança',
      promptTemplateRef: { id: 'copilot-draft', version: '1.0.0' },
    });
    const onChange = vi.fn();
    const { container } = mount(fakeProvider([bad]), onChange);
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'x' } });
    fireEvent.click(container.querySelector('[data-testid="copilot-generate"]')!);
    await waitFor(() =>
      expect(container.querySelector('[data-error]')?.textContent).toContain('rejeitada por inteiro'),
    );
    expect(container.querySelector('[data-error]')?.textContent).toContain("'promote' is not on the whitelist");
    expect(onChange).not.toHaveBeenCalled(); // nothing applied
  });

  it('C2: after a draft the action becomes "Pedir ajuste" and applies incrementally', async () => {
    const adjust = JSON.stringify({
      commands: [{ type: 'updateNode', params: { id: 't', label: 'Analisar pedido' } }],
      rationale: 'Ajuste no rótulo.',
      promptTemplateRef: { id: 'copilot-adjust', version: '1.0.0' },
    });
    const onChange = vi.fn();
    const { container } = mount(fakeProvider([DRAFT, adjust]), onChange);
    await generate(container);

    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'renomeie a tarefa' } });
    fireEvent.click(container.querySelector('[data-testid="copilot-adjust"]')!);
    await waitFor(() => {
      const latest = onChange.mock.lastCall![0] as BpmnDiagram;
      expect(latest.nodes.t.label).toBe('Analisar pedido');
    });
  });
});
