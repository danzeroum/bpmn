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

/** C5 fixtures: the XOR-split → AND-join trap and the real fix (XOR join). */
const TRAP_DRAFT = JSON.stringify({
  commands: [
    { type: 'addNode', params: { id: 's', type: 'startEvent', label: 'Início', x: 0, y: 0 } },
    { type: 'addNode', params: { id: 'x', type: 'exclusiveGateway', label: 'X?', x: 120, y: 0 } },
    { type: 'addNode', params: { id: 'a', type: 'task', label: 'A', x: 240, y: -60 } },
    { type: 'addNode', params: { id: 'b', type: 'task', label: 'B', x: 240, y: 60 } },
    { type: 'addNode', params: { id: 'j', type: 'parallelGateway', label: 'Join', x: 380, y: 0 } },
    { type: 'addNode', params: { id: 'e', type: 'endEvent', label: 'Fim', x: 500, y: 0 } },
    { type: 'addEdge', params: { id: 'f1', sourceId: 's', targetId: 'x' } },
    { type: 'addEdge', params: { id: 'f2', sourceId: 'x', targetId: 'a' } },
    { type: 'addEdge', params: { id: 'f3', sourceId: 'x', targetId: 'b' } },
    { type: 'addEdge', params: { id: 'f4', sourceId: 'a', targetId: 'j' } },
    { type: 'addEdge', params: { id: 'f5', sourceId: 'b', targetId: 'j' } },
    { type: 'addEdge', params: { id: 'f6', sourceId: 'j', targetId: 'e' } },
  ],
  rationale: 'Rascunho com sincronização (armadilha).',
  promptTemplateRef: { id: 'copilot-draft', version: '1.0.0' },
});

const REAL_FIX = JSON.stringify({
  commands: [
    { type: 'removeNode', params: { id: 'j' } },
    { type: 'addNode', params: { id: 'j2', type: 'exclusiveGateway', label: 'Convergir', x: 380, y: 0 } },
    { type: 'addEdge', params: { id: 'g1', sourceId: 'a', targetId: 'j2' } },
    { type: 'addEdge', params: { id: 'g2', sourceId: 'b', targetId: 'j2' } },
    { type: 'addEdge', params: { id: 'g3', sourceId: 'j2', targetId: 'e' } },
  ],
  rationale: 'Correção: a sincronização AND vira convergência XOR — os ramos são alternativos.',
  promptTemplateRef: { id: 'copilot-fix', version: '1.0.0' },
});

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

  it('C5: SND_* error listed → the applied fix REALLY removes it (local re-analysis)', async () => {
    const { container } = mount(fakeProvider([TRAP_DRAFT, REAL_FIX]));
    await generate(container, 'processo com sincronização');

    // The trap surfaced by the LOCAL analyzer: list + named code + fix button.
    const snd = container.querySelector('[data-testid="copilot-snd-errors"]')!;
    expect(snd.textContent).toContain('SND_DEADLOCK_JOIN');
    expect(snd.textContent).toContain('prompt: copilot-fix v1.0.0');

    fireEvent.click(container.querySelector('[data-testid="copilot-fix"]')!);
    await waitFor(() =>
      expect(container.querySelectorAll('[data-testid="copilot-footer"]')).toHaveLength(2),
    );
    // The motivating error is REALLY gone — the list recomputed over the real
    // diagram disappears and the footer shows the local 0-error preview.
    expect(container.querySelector('[data-testid="copilot-snd-errors"]')).toBeNull();
    const footers = container.querySelectorAll('[data-testid="copilot-footer"]');
    expect(footers[1].textContent).toContain('soundness: 0 erros');
  });

  it('C5: a "fix" that does NOT fix keeps the error listed (honesty by re-analysis)', async () => {
    const noopFix = JSON.stringify({
      commands: [{ type: 'updateNode', params: { id: 'j', label: 'Join (renomeado)' } }],
      rationale: 'Só renomeia — não corrige nada.',
      promptTemplateRef: { id: 'copilot-fix', version: '1.0.0' },
    });
    const { container } = mount(fakeProvider([TRAP_DRAFT, noopFix]));
    await generate(container, 'processo com sincronização');

    fireEvent.click(container.querySelector('[data-testid="copilot-fix"]')!);
    await waitFor(() =>
      expect(container.querySelectorAll('[data-testid="copilot-footer"]')).toHaveLength(2),
    );
    const snd = container.querySelector('[data-testid="copilot-snd-errors"]')!;
    expect(snd.textContent).toContain('SND_DEADLOCK_JOIN'); // still there
    const footers = container.querySelectorAll('[data-testid="copilot-footer"]');
    expect(footers[1].textContent).toContain('soundness: 1 erros');
  });

  it('C5: a fix smuggling governance is rejected whole by the SAME pipeline', async () => {
    const evilFix = JSON.stringify({
      commands: [
        { type: 'removeNode', params: { id: 'j' } },
        { type: 'promote', params: {} },
      ],
      rationale: 'corrige e promove',
      promptTemplateRef: { id: 'copilot-fix', version: '1.0.0' },
    });
    const onChange = vi.fn();
    const { container } = mount(fakeProvider([TRAP_DRAFT, evilFix]), onChange);
    await generate(container, 'processo com sincronização');
    const callsAfterDraft = onChange.mock.calls.length;

    fireEvent.click(container.querySelector('[data-testid="copilot-fix"]')!);
    await waitFor(() =>
      expect(container.querySelector('[data-error]')?.textContent).toContain('rejeitada por inteiro'),
    );
    expect(onChange.mock.calls.length).toBe(callsAfterDraft); // nothing applied
    // The trap is untouched — the error list stays.
    expect(container.querySelector('[data-testid="copilot-snd-errors"]')?.textContent).toContain(
      'SND_DEADLOCK_JOIN',
    );
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
