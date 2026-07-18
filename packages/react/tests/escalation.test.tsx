import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  createDefaultRegistry,
  createDiagram,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import {
  BpmnEditor,
  buildEscalationBoundaryInsert,
  insertPaletteItem,
  PT_BR,
  type PaletteBuildContext,
  type PaletteItem,
} from '../src/index.js';

/**
 * Handoff 18 §5b — react: o kind escalation entra nos gates locais (picker +
 * chips) com escalationCode por tipo; a autoridade é prop de nó (bpmnr:) com
 * chip transiente lendo o valor ASSENTADO (reforço 8); e o item de paleta
 * composto anexa a um host ou recusa com veto declarado (reforço 7).
 */
function escDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Esc', id: 'esc' });
  diagram.definitions = {
    messages: [{ id: 'msg-1', name: 'Pedido' }],
    signals: [],
    errors: [],
    escalations: [{ id: 'esc-1', name: 'Acima da alçada', escalationCode: 'OVER_BUDGET' }],
  };
  diagram.nodes = {
    task: createNode({ id: 'task', type: 'userTask', label: 'Aprovar', x: 200, y: 100 }),
    bnd: createNode({
      id: 'bnd',
      type: 'boundaryEvent',
      label: 'Alçada',
      x: 260,
      y: 150,
      properties: {
        attachedToRef: 'task',
        cancelActivity: false,
        eventDefinition: 'escalation',
        eventDefinitionRef: 'esc-1',
      },
    }),
    msg: createNode({
      id: 'msg',
      type: 'intermediateCatchEvent',
      label: 'Msg',
      x: 40,
      y: 320,
      properties: { eventDefinition: 'message', eventDefinitionRef: 'msg-1' },
    }),
  };
  return diagram;
}

const select = (container: HTMLElement, id: string) => {
  fireEvent.pointerDown(container.querySelector(`[data-node-id="${id}"]`)!, { button: 0 });
  fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
};

describe('picker + escalationCode (gate + assimetria por tipo)', () => {
  it('escalação mostra a seção e o campo de código; mensagem não tem código', () => {
    const { container } = render(<BpmnEditor diagram={escDiagram()} messages={PT_BR} />);
    select(container, 'bnd');
    expect(screen.getByTestId('eventdefs-section')).toBeTruthy();
    const code = screen.getByTestId('eventdefs-errorcode') as HTMLInputElement;
    expect(code.value).toBe('OVER_BUDGET');
    // A label é a de escalação, não a de erro.
    expect(screen.getByText('Código de escalação')).toBeTruthy();
    // Mensagem: sem campo de código.
    select(container, 'msg');
    expect(screen.queryByTestId('eventdefs-errorcode')).toBeNull();
  });

  it('editar o escalationCode grava no modelo (commit no blur)', () => {
    const { container } = render(<BpmnEditor diagram={escDiagram()} messages={PT_BR} />);
    select(container, 'bnd');
    const code = () => screen.getByTestId('eventdefs-errorcode') as HTMLInputElement;
    fireEvent.change(code(), { target: { value: 'WAY_OVER' } });
    fireEvent.blur(code());
    select(container, 'msg');
    select(container, 'bnd');
    expect(code().value).toBe('WAY_OVER');
  });
});

describe('autoridade — prop de nó + chip transiente assentado (reforço 8)', () => {
  it('campo só para escalação; blur grava; chip aparece com o valor assentado', () => {
    const { container } = render(<BpmnEditor diagram={escDiagram()} messages={PT_BR} />);
    // Mensagem não tem autoridade.
    select(container, 'msg');
    expect(screen.queryByTestId('eventdefs-authority')).toBeNull();
    // Escalação: sem autoridade → nenhum chip.
    select(container, 'bnd');
    expect(container.querySelector('[data-event-authority="bnd"]')).toBeNull();
    const field = () => screen.getByTestId('eventdefs-authority') as HTMLInputElement;
    // Digitar SEM blur não move o chip (lê o valor assentado, não a tecla).
    fireEvent.change(field(), { target: { value: 'Gate G2' } });
    expect(container.querySelector('[data-event-authority="bnd"]')).toBeNull();
    // Blur assenta → o chip aparece nomeando a autoridade.
    fireEvent.blur(field());
    const chip = container.querySelector('[data-event-authority="bnd"]');
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain('↟');
    expect(chip!.textContent).toContain('Gate G2');
  });

  it('autoridade vazia = ausente: string em branco não gera chip', () => {
    const { container } = render(<BpmnEditor diagram={escDiagram()} messages={PT_BR} />);
    select(container, 'bnd');
    const field = () => screen.getByTestId('eventdefs-authority') as HTMLInputElement;
    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.blur(field());
    expect(container.querySelector('[data-event-authority="bnd"]')).toBeNull();
  });
});

describe('degradação sem agentflow (§5c)', () => {
  it('agentTask renderiza sem plugin de agente — o shape é do react core', () => {
    const diagram = createDiagram({ name: 'D', id: 'd' });
    diagram.nodes = {
      agent: createNode({
        id: 'agent',
        type: 'agentTask',
        label: 'Analisar contrato',
        x: 100,
        y: 100,
        properties: { agentWorkflowRef: 'analisar-contrato@1.0.0' },
      }),
    };
    // Sem NENHUM plugin de agente injetado, o agentTask ainda desenha (🤖 + ref).
    const { container } = render(<BpmnEditor diagram={diagram} messages={PT_BR} />);
    expect(container.querySelector('[data-node-id="agent"]')).not.toBeNull();
    expect(container.textContent).toContain('analisar-contrato@1.0.0');
  });
});

describe('toggle interrupting no boundary (decisão 3)', () => {
  it('o toggle existente flipa o cancelActivity do boundary de escalação', () => {
    const { container } = render(<BpmnEditor diagram={escDiagram()} messages={PT_BR} />);
    select(container, 'bnd');
    const toggle = () => screen.getByTestId('interrupting-checkbox') as HTMLInputElement;
    // Nasce não-interrupting (cancelActivity:false) → checkbox desmarcada.
    expect(toggle().checked).toBe(false);
    fireEvent.click(toggle()); // → interrupting (cancelActivity removido)
    select(container, 'task');
    select(container, 'bnd');
    expect(toggle().checked).toBe(true);
  });
});

describe('item de paleta composto — attach OU veto declarado (reforço 7)', () => {
  const registry = createDefaultRegistry();
  const t = (key: string) => key;

  function ctxAt(diagram: BpmnDiagram, x: number, y: number): PaletteBuildContext {
    return { diagram, registry, x, y, t };
  }

  it('drop sobre uma atividade: boundary anexado + definição local + ref, cancelActivity false, 1 undo', () => {
    const diagram = createDiagram({ name: 'H', id: 'h' });
    diagram.nodes = {
      task: createNode({ id: 'task', type: 'userTask', label: 'T', x: 200, y: 120 }),
    };
    // x/y = canto do boundary cujo centro cai DENTRO da task.
    const result = buildEscalationBoundaryInsert(ctxAt(diagram, 242, 132));
    expect('command' in result).toBe(true);
    if (!('command' in result)) return;
    const after = result.command.execute(diagram);
    const boundary = after.nodes[result.selectId];
    expect(boundary.type).toBe('boundaryEvent');
    expect(boundary.properties.attachedToRef).toBe('task');
    expect(boundary.properties.cancelActivity).toBe(false);
    expect(boundary.properties.eventDefinition).toBe('escalation');
    expect(typeof boundary.properties.eventDefinitionRef).toBe('string');
    // Definição local esc-1 criada no mesmo composto.
    expect(after.definitions?.escalations?.[0]?.id).toBe(boundary.properties.eventDefinitionRef);
  });

  it('drop em canvas vazio: recusa com veto declarado (sem boundary órfão)', () => {
    const diagram = createDiagram({ name: 'V', id: 'v' });
    const result = buildEscalationBoundaryInsert(ctxAt(diagram, 500, 500));
    expect('veto' in result).toBe(true);
    if ('veto' in result) expect(result.veto).toBe('palette.veto.boundaryNeedsHost');
  });

  it('§5c reforço 1 — o boundary composto anexa a um agentTask (category activity)', () => {
    const diagram = createDiagram({ name: 'B', id: 'b' });
    diagram.nodes = {
      agent: createNode({ id: 'agent', type: 'agentTask', label: 'Analisar', x: 200, y: 120 }),
    };
    const result = buildEscalationBoundaryInsert(ctxAt(diagram, 242, 132));
    expect('command' in result).toBe(true);
    if (!('command' in result)) return;
    const after = result.command.execute(diagram);
    expect(after.nodes[result.selectId].properties.attachedToRef).toBe('agent');
    expect(after.nodes[result.selectId].properties.cancelActivity).toBe(false);
  });

  it('insertPaletteItem: veto → announceVeto no 🔒, nada executado (nunca no-op mudo)', () => {
    const diagram = createDiagram({ name: 'V', id: 'v' });
    const store = {
      getState: () => ({
        viewport: { x: 0, y: 0, width: 200, height: 200 },
        gridSize: 0,
        snapEnabled: false,
      }),
      setState: vi.fn(),
    } as unknown as Parameters<typeof insertPaletteItem>[1]['store'];
    const execute = vi.fn(() => ({ allowed: true }));
    const announceVeto = vi.fn();
    const item: PaletteItem = {
      id: 'escalationBoundary',
      label: 'Escalation (boundary)',
      nodeType: 'boundaryEvent',
      build: buildEscalationBoundaryInsert,
    };
    const verdict = insertPaletteItem(item, { diagram, registry, store, t, execute, announceVeto });
    expect(verdict.allowed).toBe(false);
    expect(announceVeto).toHaveBeenCalledWith('palette.veto.boundaryNeedsHost');
    expect(execute).not.toHaveBeenCalled();
  });
});
