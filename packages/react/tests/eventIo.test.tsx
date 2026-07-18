import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  BpmnXmlConverter,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import {
  BpmnEditor,
  eventExecutionModeOf,
  prunePayloadMappings,
  PT_BR,
  type BpmnPlugin,
} from '../src/index.js';

/**
 * Handoff 16 E-4 — I/O de eventos na aba Execução (§3c): gate idêntico à U-6
 * com degradação (critério 1), assimetria throw/catch imposta pela UI com os
 * DOIS lados negativos (critério 2, cerca §1.4), matriz de executáveis
 * (critério 3), props undoáveis + lossless (critério 4), disclosure sem
 * duplo-render (reforço 6) e modelo limpo com poda de linhas vazias
 * (reforço 7).
 */
function ioDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Event I/O', id: 'io' });
  diagram.nodes = {
    host: createNode({ id: 'host', type: 'task', label: 'Cobrar', x: 200, y: 120 }),
    throw1: createNode({
      id: 'throw1',
      type: 'intermediateThrowEvent',
      label: 'Avisar',
      x: 420,
      y: 150,
      properties: { eventDefinition: 'message' },
    }),
    endSig: createNode({
      id: 'endSig',
      type: 'endEvent',
      label: 'Fim sinal',
      x: 700,
      y: 150,
      properties: { eventDefinition: 'signal' },
    }),
    b1: createNode({
      id: 'b1',
      type: 'boundaryEvent',
      label: 'Falhou',
      x: 260,
      y: 180,
      properties: { eventDefinition: 'error', attachedToRef: 'host' },
    }),
    sub: createNode({ id: 'sub', type: 'subProcess', label: 'Tratamento', x: 200, y: 320 }),
    es1: createNode({
      id: 'es1',
      type: 'startEvent',
      label: 'Erro capturado',
      x: 220,
      y: 360,
      properties: { eventDefinition: 'error', parentId: 'sub' },
    }),
    mc: createNode({
      id: 'mc',
      type: 'intermediateCatchEvent',
      label: 'Aguardar',
      x: 560,
      y: 150,
      properties: { eventDefinition: 'message' },
    }),
    topErr: createNode({
      id: 'topErr',
      type: 'startEvent',
      label: 'Erro solto',
      x: 60,
      y: 150,
      properties: { eventDefinition: 'error' },
    }),
  };
  diagram.edges = { e1: createEdge({ id: 'e1', sourceId: 'host', targetId: 'throw1' }) };
  return diagram;
}

const enginePlugin: BpmnPlugin = {
  id: 'zeebe-bridge',
  engine: { id: 'zeebe', name: 'Camunda 8 (Zeebe)' },
};

const selectNode = (container: HTMLElement, id: string) => {
  fireEvent.pointerDown(container.querySelector(`[data-node-id="${id}"]`)!, { button: 0 });
  fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
};

const openExecution = (container: HTMLElement, id: string) => {
  selectNode(container, id);
  fireEvent.click(container.querySelector('[data-inspector-tab="execution"]')!);
};

const undo = () => fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

describe('event I/O on the Execução tab (E-4)', () => {
  it('critério 3 — a matriz de executáveis: 4 positivos e os negativos declarados', () => {
    const diagram = ioDiagram();
    // Positivos: throw message/signal (intermediate + end), captura de erro
    // (boundary + start DENTRO de subProcess).
    expect(eventExecutionModeOf(diagram, diagram.nodes.throw1)).toBe('throw');
    expect(eventExecutionModeOf(diagram, diagram.nodes.endSig)).toBe('throw');
    expect(eventExecutionModeOf(diagram, diagram.nodes.b1)).toBe('catch-error');
    expect(eventExecutionModeOf(diagram, diagram.nodes.es1)).toBe('catch-error');
    // Negativos: catch de message (correlação é host-owned), error start
    // TOP-LEVEL (alvo do EVT_ERROR_START_TOPLEVEL na E-5), atividade comum.
    expect(eventExecutionModeOf(diagram, diagram.nodes.mc)).toBeNull();
    expect(eventExecutionModeOf(diagram, diagram.nodes.topErr)).toBeNull();
    expect(eventExecutionModeOf(diagram, diagram.nodes.host)).toBeNull();
  });

  it('critério 1 — sem engine: zero tabs, aba geral inalterada; com engine: só a matriz ganha a aba', () => {
    // Degradação: SEM plugin de engine o painel é o de antes — sem tab bar,
    // com a seção de definições nomeadas da E-2 intacta.
    const bare = render(<BpmnEditor diagram={ioDiagram()} messages={PT_BR} />);
    selectNode(bare.container, 'throw1');
    expect(bare.container.querySelector('.bpmnr-inspector-tabs')).toBeNull();
    expect(bare.container.querySelector('[data-inspector-node="throw1"]')).not.toBeNull();
    expect(screen.getByTestId('eventdefs-section')).toBeDefined();
    bare.unmount();
    // Com engine: throw e boundary ganham a aba; o catch de message NÃO.
    const { container } = render(
      <BpmnEditor diagram={ioDiagram()} plugins={[enginePlugin]} messages={PT_BR} />,
    );
    selectNode(container, 'throw1');
    expect(container.querySelector('.bpmnr-inspector-tabs')).not.toBeNull();
    selectNode(container, 'mc');
    expect(container.querySelector('.bpmnr-inspector-tabs')).toBeNull();
    selectNode(container, 'topErr');
    expect(container.querySelector('.bpmnr-inspector-tabs')).toBeNull();
  });

  it('critério 2 — assimetria imposta pela UI: catch NUNCA mostra payload; throw NUNCA mostra captura', () => {
    const { container } = render(
      <BpmnEditor diagram={ioDiagram()} plugins={[enginePlugin]} messages={PT_BR} />,
    );
    // Lado 1: throw → payload presente, captura AUSENTE.
    openExecution(container, 'throw1');
    expect(screen.getByTestId('eventio-payload')).toBeDefined();
    expect(screen.queryByTestId('eventio-capture')).toBeNull();
    // Lado 2: catch de erro → captura presente, payload AUSENTE.
    openExecution(container, 'b1');
    expect(screen.getByTestId('eventio-capture')).toBeDefined();
    expect(screen.queryByTestId('eventio-payload')).toBeNull();
    // Campos de atividade (job type) não vazam para eventos.
    expect(screen.queryByLabelText('Job type')).toBeNull();
  });

  it('critério 4 — mapeamento e captura commitam via updateNodeCommand; 1 undo reverte', () => {
    let latest: BpmnDiagram | null = null;
    const { container } = render(
      <BpmnEditor
        diagram={ioDiagram()}
        plugins={[enginePlugin]}
        messages={PT_BR}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    openExecution(container, 'throw1');
    fireEvent.click(screen.getByTestId('eventio-add'));
    fireEvent.change(screen.getByTestId('eventio-source-0'), { target: { value: '=total' } });
    fireEvent.change(screen.getByTestId('eventio-target-0'), { target: { value: 'amount' } });
    fireEvent.blur(screen.getByTestId('eventio-target-0'));
    expect(latest!.nodes.throw1.properties['zeebe:payload']).toEqual([
      { source: '=total', target: 'amount' },
    ]);
    undo();
    expect(latest!.nodes.throw1.properties['zeebe:payload']).toBeUndefined();
    // Captura no boundary: errCode var → 1 undo.
    openExecution(container, 'b1');
    const code = screen.getByLabelText('Variável do código de erro') as HTMLInputElement;
    fireEvent.change(code, { target: { value: 'motivo' } });
    fireEvent.blur(code);
    expect(latest!.nodes.b1.properties['zeebe:errorCodeVariable']).toBe('motivo');
    undo();
    expect(latest!.nodes.b1.properties['zeebe:errorCodeVariable']).toBeUndefined();
  });

  it('reforço 6 — as chaves essenciais ficam FORA do <details> avançado (sem duplo-render)', () => {
    const diagram = ioDiagram();
    diagram.nodes.throw1.properties['zeebe:payload'] = [{ source: '=a', target: 'b' }];
    diagram.nodes.throw1.properties['zeebe:timeout'] = 'PT30S';
    diagram.nodes.b1.properties['zeebe:errorCodeVariable'] = 'motivo';
    diagram.nodes.b1.properties['zeebe:retries'] = '2';
    const { container } = render(
      <BpmnEditor diagram={diagram} plugins={[enginePlugin]} messages={PT_BR} />,
    );
    openExecution(container, 'throw1');
    const advanced = () => screen.getByTestId('execution-advanced');
    expect(advanced().textContent).toContain('zeebe:timeout');
    expect(advanced().textContent).not.toContain('zeebe:payload');
    openExecution(container, 'b1');
    expect(advanced().textContent).toContain('zeebe:retries');
    expect(advanced().textContent).not.toContain('zeebe:errorCodeVariable');
  });

  it('reforço 7 — linha em branco não serializa; remover a última linha remove a prop inteira', () => {
    let latest: BpmnDiagram | null = null;
    const { container } = render(
      <BpmnEditor
        diagram={ioDiagram()}
        plugins={[enginePlugin]}
        messages={PT_BR}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    openExecution(container, 'throw1');
    // Duas linhas: uma preenchida e uma totalmente em branco → só a
    // preenchida commita (a poda é do commit, não da UI).
    fireEvent.click(screen.getByTestId('eventio-add'));
    fireEvent.change(screen.getByTestId('eventio-source-0'), { target: { value: '=total' } });
    fireEvent.change(screen.getByTestId('eventio-target-0'), { target: { value: 'amount' } });
    fireEvent.blur(screen.getByTestId('eventio-target-0'));
    fireEvent.click(screen.getByTestId('eventio-add'));
    fireEvent.blur(screen.getByTestId('eventio-source-1'));
    expect(latest!.nodes.throw1.properties['zeebe:payload']).toEqual([
      { source: '=total', target: 'amount' },
    ]);
    // O XML nunca carrega a linha vazia.
    const xml = new BpmnXmlConverter().toXml(latest!);
    expect(xml).not.toContain('{"source":"","target":""}');
    // Remover a última linha: a prop some INTEIRA (campo ausente = bytes de antes).
    fireEvent.click(screen.getByTestId('eventio-remove-0'));
    expect('zeebe:payload' in latest!.nodes.throw1.properties).toBe(false);
    expect(prunePayloadMappings([{ source: '', target: '' }])).toBeUndefined();
  });

  it('critério 4b — fixture eventIoRoundtrip: throw+catch com passthrough round-tripam byte-estáveis', () => {
    const converter = new BpmnXmlConverter();
    const diagram = ioDiagram();
    diagram.nodes.throw1.properties['zeebe:payload'] = [{ source: '=total', target: 'amount' }];
    diagram.nodes.b1.properties['zeebe:errorCodeVariable'] = 'motivo';
    diagram.nodes.b1.properties['zeebe:errorMessageVariable'] = 'detalhe';
    // Extensão ESTRANGEIRA no mesmo nó (passthrough #119): convive com as
    // nossas props sem perda nem interferência.
    diagram.nodes.throw1.foreignExtensions = [
      {
        tag: 'zeebe:ioMapping',
        attributes: {},
        text: '',
        children: [
          { tag: 'zeebe:input', attributes: { source: '=x', target: 'y' }, children: [], text: '' },
        ],
      },
    ];
    diagram.foreignNamespaces = { zeebe: 'http://camunda.org/schema/zeebe/1.0' };
    const first = converter.toXml(diagram);
    const reimported = converter.fromXml(first).diagram;
    const second = converter.toXml(reimported);
    expect(second).toBe(first); // byte-estável entre os NOSSOS exports
    expect(reimported.nodes.throw1.properties['zeebe:payload']).toEqual([
      { source: '=total', target: 'amount' },
    ]);
    expect(reimported.nodes.b1.properties['zeebe:errorCodeVariable']).toBe('motivo');
    expect(reimported.nodes.throw1.foreignExtensions?.[0]?.tag).toBe('zeebe:ioMapping');
  });
});
