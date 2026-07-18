import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnDesigner, BpmnEditor, EventDefinitionSection, PT_BR } from '../src/index.js';

/**
 * Handoff 16 E-2 — seção "Evento" do properties panel: «+» = UM composto
 * (régua 1, vinculante), rename com cascata visual por construção (régua 2),
 * exclusão vetada com lista de usos navegável (régua 3, pan U-4 +
 * reduced-motion), errorCode só para erro (régua 4).
 */
function eventsDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Eventos', id: 'ev' });
  diagram.definitions = {
    messages: [{ id: 'msg-1', name: 'Pedido aprovado' }],
    signals: [],
    errors: [{ id: 'err-1', name: 'Falha de cobrança', errorCode: 'PAY-42' }],
  };
  diagram.nodes = {
    a: createNode({
      id: 'a',
      type: 'intermediateCatchEvent',
      label: 'Aguardar A',
      x: 40,
      y: 40,
      properties: { eventDefinition: 'message', eventDefinitionRef: 'msg-1' },
    }),
    b: createNode({
      id: 'b',
      type: 'startEvent',
      label: 'Começo B',
      x: 400,
      y: 40,
      properties: { eventDefinition: 'message', eventDefinitionRef: 'msg-1' },
    }),
    c: createNode({
      id: 'c',
      type: 'endEvent',
      label: 'Fim com erro',
      x: 700,
      y: 40,
      properties: { eventDefinition: 'error', eventDefinitionRef: 'err-1' },
    }),
    plain: createNode({
      id: 'plain',
      type: 'intermediateCatchEvent',
      label: 'Sem ref',
      x: 40,
      y: 300,
      properties: { eventDefinition: 'message' },
    }),
  };
  diagram.edges = { e1: createEdge({ id: 'e1', sourceId: 'b', targetId: 'a' }) };
  return diagram;
}

const select = (container: HTMLElement, id: string) => {
  fireEvent.pointerDown(container.querySelector(`[data-node-id="${id}"]`)!, { button: 0 });
  fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
};

const undo = () => fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

const stubReducedMotion = () => {
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
  return () => {
    window.matchMedia = original;
  };
};

describe('EventDefinitionSection (E-2)', () => {
  it('régua 1 — «+» cria e referencia em UM composto; 1 undo reverte os dois', () => {
    const { container } = render(<BpmnEditor diagram={eventsDiagram()} messages={PT_BR} />);
    select(container, 'plain');
    const picker = () => screen.getByTestId('eventdefs-picker') as HTMLSelectElement;
    expect(picker().value).toBe('');
    fireEvent.click(screen.getByTestId('eventdefs-add'));
    // msg-1 já existe → o auto id é msg-2; a ref já aponta para ele.
    expect(picker().value).toBe('msg-2');
    expect((screen.getByTestId('eventdefs-name') as HTMLInputElement).value).toBe('Nova mensagem');
    // UM undo: definição E referência somem juntas (composto atômico).
    undo();
    expect(picker().value).toBe('');
    expect([...picker().options].map((option) => option.value)).not.toContain('msg-2');
  });

  it('régua 2 — rename em UM evento reflete no outro (cascata por construção); 1 undo restaura', () => {
    const { container } = render(<BpmnEditor diagram={eventsDiagram()} messages={PT_BR} />);
    select(container, 'a');
    const nameInput = () => screen.getByTestId('eventdefs-name') as HTMLInputElement;
    fireEvent.change(nameInput(), { target: { value: 'Pedido CANCELADO' } });
    fireEvent.blur(nameInput());
    // O OUTRO evento (b) reflete o nome novo sem ter sido tocado.
    select(container, 'b');
    expect(nameInput().value).toBe('Pedido CANCELADO');
    const option = [...(screen.getByTestId('eventdefs-picker') as HTMLSelectElement).options].find(
      (candidate) => candidate.value === 'msg-1',
    )!;
    expect(option.textContent).toContain('Pedido CANCELADO');
    // 1 undo restaura o nome para AMBOS.
    undo();
    expect(nameInput().value).toBe('Pedido aprovado');
  });

  it('régua 3 — exclusão referenciada é vetada (lastVeto na UI) e a lista navega com pan', () => {
    const restore = stubReducedMotion();
    try {
      const { container } = render(<BpmnEditor diagram={eventsDiagram()} messages={PT_BR} />);
      select(container, 'a');
      // Lista de usos honesta (a própria seleção + o outro evento).
      const usages = screen.getByTestId('eventdefs-usages');
      expect(usages.textContent).toContain('Usada por 2 eventos');
      expect(usages.textContent).toContain('Começo B');
      // Excluir referenciada → veto do core aparece no canal lastVeto (🔒).
      fireEvent.click(screen.getByTestId('eventdefs-delete'));
      const veto = container.querySelector('.bpmnr-toolbar-veto')!;
      expect(veto.textContent).toContain('Definição em uso por 2 evento(s)');
      expect(veto.textContent).toContain('Começo B (b)');
      // A definição segue lá (nada excluído em silêncio).
      expect((screen.getByTestId('eventdefs-picker') as HTMLSelectElement).value).toBe('msg-1');
      // Clique no uso navega: seleção muda para b e o viewport centraliza
      // (reduced-motion → pan instantâneo, sem pulso).
      fireEvent.click(usages.querySelector('[data-eventdefs-usage="b"]')!);
      expect(container.querySelector('[data-node-id="b"][data-selected]')).not.toBeNull();
      const [x, , width] = container
        .querySelector('svg.bpmnr-canvas')!
        .getAttribute('viewBox')!
        .split(' ')
        .map(Number);
      // b é um startEvent (36×36 → centro 418): viewport centraliza no alvo.
      expect(Math.abs(x - (418 - width / 2))).toBeLessThan(1);
    } finally {
      restore();
    }
  });

  it('régua 4 — errorCode SÓ para definições de erro; edição grava no modelo', () => {
    const { container } = render(<BpmnEditor diagram={eventsDiagram()} messages={PT_BR} />);
    select(container, 'a'); // message
    expect(screen.queryByTestId('eventdefs-errorcode')).toBeNull();
    select(container, 'c'); // error
    const code = screen.getByTestId('eventdefs-errorcode') as HTMLInputElement;
    expect(code.value).toBe('PAY-42');
    fireEvent.change(code, { target: { value: 'PAY-99' } });
    fireEvent.blur(code);
    select(container, 'a');
    select(container, 'c');
    expect((screen.getByTestId('eventdefs-errorcode') as HTMLInputElement).value).toBe('PAY-99');
  });

  it('read-only: picker desabilitado, sem «+»/excluir', () => {
    const diagram = eventsDiagram();
    render(
      <BpmnDesigner diagram={diagram} messages={PT_BR} readOnly>
        <EventDefinitionSection node={diagram.nodes.a} readOnly />
      </BpmnDesigner>,
    );
    expect((screen.getByTestId('eventdefs-picker') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByTestId('eventdefs-add')).toBeNull();
    expect(screen.queryByTestId('eventdefs-delete')).toBeNull();
  });
});
