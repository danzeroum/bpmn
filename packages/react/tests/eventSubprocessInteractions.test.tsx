import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  createDefaultRuleEngine,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { BpmnEditor, eventExecutionModeOf, PT_BR } from '../src/index.js';

/**
 * Handoff 17 ES-3 — interações (§4c): veto declarado nos DOIS sentidos via
 * announceVeto/🔒 (critério 1), Tab dentro vs na casca (critério 2), toggle
 * "Interrompe o escopo" com os dois negativos (critério 3), aperto da matriz
 * E-4 (critério 4) e a paridade de escopo cruzado (reforço 7).
 */
function esubDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'ESub', id: 'es3' });
  diagram.nodes = {
    outside: createNode({ id: 'outside', type: 'task', label: 'Fora', x: 40, y: 40 }),
    sub: createNode({
      id: 'sub',
      type: 'subProcess',
      label: 'Tratamento',
      x: 240,
      y: 40,
      width: 260,
      height: 180,
      properties: { triggeredByEvent: true, isExpanded: true },
    }),
    st: createNode({
      id: 'st',
      type: 'startEvent',
      label: 'Gatilho',
      x: 260,
      y: 100,
      properties: { parentId: 'sub', eventDefinition: 'message' },
    }),
    inner: createNode({
      id: 'inner',
      type: 'task',
      label: 'Interno',
      x: 340,
      y: 90,
      properties: { parentId: 'sub' },
    }),
    common: createNode({
      id: 'common',
      type: 'subProcess',
      label: 'Comum',
      x: 240,
      y: 300,
      width: 220,
      height: 140,
      properties: { isExpanded: true },
    }),
    commonStart: createNode({
      id: 'commonStart',
      type: 'startEvent',
      label: 'Começo comum',
      x: 260,
      y: 350,
      properties: { parentId: 'common', eventDefinition: 'message' },
    }),
    commonChild: createNode({
      id: 'commonChild',
      type: 'task',
      label: 'Filho comum',
      x: 340,
      y: 340,
      properties: { parentId: 'common' },
    }),
    plainStart: createNode({
      id: 'plainStart',
      type: 'startEvent',
      label: 'Start solto',
      x: 40,
      y: 300,
      properties: { eventDefinition: 'message' },
    }),
  };
  diagram.edges = { e1: createEdge({ id: 'e1', sourceId: 'st', targetId: 'inner' }) };
  return diagram;
}

const select = (container: HTMLElement, id: string) => {
  fireEvent.pointerDown(container.querySelector(`[data-node-id="${id}"]`)!, { button: 0 });
  fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
};

const VETO_SNIPPET = 'não recebe fluxo de sequência';

describe('veto declarado na casca (critérios 1–2)', () => {
  it('portas suprimidas na casca; filhos e subProcess comum mantêm portas', () => {
    const { container } = render(<BpmnEditor diagram={esubDiagram()} messages={PT_BR} />);
    expect(container.querySelector('[data-node-id="sub"] [data-ports]')).toBeNull();
    expect(container.querySelector('[data-node-id="inner"] [data-ports]')).not.toBeNull();
    expect(container.querySelector('[data-node-id="common"] [data-ports]')).not.toBeNull();
  });

  it('drop de conexão NA casca (porta→casca) → 🔒 com a mensagem PT da ES-1', () => {
    const { container } = render(<BpmnEditor diagram={esubDiagram()} messages={PT_BR} />);
    // Gesto: porta do nó de fora → soltar sobre a casca (coordenadas de
    // cliente ≈ mundo no jsdom — precedente editorEvents.test).
    const port = container.querySelector('[data-node-id="outside"] [data-port]')!;
    fireEvent.pointerDown(port, { button: 0, clientX: 160, clientY: 70 });
    const svg = container.querySelector('svg.bpmnr-canvas')!;
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 100 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 300, clientY: 100 });
    const veto = container.querySelector('.bpmnr-toolbar-veto');
    expect(veto?.textContent).toContain(VETO_SNIPPET);
    expect(veto?.textContent).toContain('Tratamento');
    // Nenhuma aresta nova nasceu em silêncio.
    expect(Object.keys(esubDiagram().edges)).toHaveLength(1);
  });

  it('Tab na CASCA = veto declarado (mesma mensagem); Tab num FILHO encadeia normal', () => {
    let latest: BpmnDiagram | null = null;
    const { container } = render(
      <BpmnEditor
        diagram={esubDiagram()}
        messages={PT_BR}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    // Tab na casca: nada criado, 🔒 nomeia a regra (foco no canvas — o Tab
    // mantém seu papel de navegação fora dele, precedente contextPad.test).
    const svg = container.querySelector<SVGSVGElement>('svg.bpmnr-canvas')!;
    select(container, 'sub');
    svg.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(container.querySelector('.bpmnr-toolbar-veto')?.textContent).toContain(VETO_SNIPPET);
    expect(latest).toBeNull(); // nenhum comando executou
    // Tab num filho: quick-add normal (aresta filho→novo, contenção herdada).
    select(container, 'inner');
    svg.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    const added = Object.values(latest!.nodes).find((node) => node.type === 'task' && node.id !== 'outside' && node.id !== 'inner' && node.id !== 'commonChild')!;
    expect(added.properties.parentId).toBe('sub');
    expect(
      Object.values(latest!.edges).some(
        (edge) => edge.sourceId === 'inner' && edge.targetId === added.id,
      ),
    ).toBe(true);
    // Ciclo de vida do reforço 8: o sucesso LIMPOU o veto anterior.
    expect(container.querySelector('.bpmnr-toolbar-veto')).toBeNull();
  });

  it('context pad da casca sem connect/appends; filhos com pad completo', () => {
    const { container } = render(<BpmnEditor diagram={esubDiagram()} messages={PT_BR} />);
    select(container, 'sub');
    expect(container.querySelector('[data-context-pad-action="connect"]')).toBeNull();
    expect(container.querySelector('[data-context-pad-action="task"]')).toBeNull();
    select(container, 'inner');
    expect(container.querySelector('[data-context-pad-action="connect"]')).not.toBeNull();
    expect(container.querySelector('[data-context-pad-action="task"]')).not.toBeNull();
  });
});

describe('toggle "Interrompe o escopo" (critério 3)', () => {
  it('SÓ em start de event subprocess; commit undoável com modelo limpo (default ausente)', () => {
    let latest: BpmnDiagram | null = null;
    const { container } = render(
      <BpmnEditor
        diagram={esubDiagram()}
        messages={PT_BR}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    select(container, 'st');
    const checkbox = screen.getByTestId('interrupting-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true); // default OMG
    fireEvent.click(checkbox);
    expect(latest!.nodes.st.properties.isInterrupting).toBe(false);
    // O círculo tracejado da ES-2 reage no canvas.
    expect(
      container.querySelector('[data-node-id="st"] circle[stroke-dasharray="3,2"]'),
    ).not.toBeNull();
    // Voltar = campo AUSENTE (modelo limpo), não true explícito.
    fireEvent.click(screen.getByTestId('interrupting-checkbox'));
    expect('isInterrupting' in latest!.nodes.st.properties).toBe(false);
    // 1 undo restaura o false.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(latest!.nodes.st.properties.isInterrupting).toBe(false);
  });

  it('negativos: start comum e start de subProcess COMUM não mostram o toggle', () => {
    const { container } = render(<BpmnEditor diagram={esubDiagram()} messages={PT_BR} />);
    select(container, 'plainStart');
    expect(screen.queryByTestId('interrupting-toggle')).toBeNull();
    select(container, 'commonStart');
    expect(screen.queryByTestId('interrupting-toggle')).toBeNull();
  });
});

describe('aperto da matriz E-4 (critério 4)', () => {
  it('catch-error exige isEventSubprocess no pai — subProcess comum agora é null', () => {
    const diagram = esubDiagram();
    diagram.nodes.st = {
      ...diagram.nodes.st,
      properties: { ...diagram.nodes.st.properties, eventDefinition: 'error' },
    };
    diagram.nodes.commonStart = {
      ...diagram.nodes.commonStart,
      properties: { ...diagram.nodes.commonStart.properties, eventDefinition: 'error' },
    };
    expect(eventExecutionModeOf(diagram, diagram.nodes.st)).toBe('catch-error');
    expect(eventExecutionModeOf(diagram, diagram.nodes.commonStart)).toBeNull();
  });
});

describe('reforço 7 — paridade de escopo cruzado', () => {
  it('filho de event subprocess → nó de fora: MESMO verdict do filho de subProcess comum', () => {
    const diagram = esubDiagram();
    const engine = createDefaultRuleEngine();
    const fromEventChild = engine.evaluate(
      'edge.connect.pre',
      { sourceId: 'inner', targetId: 'outside' },
      diagram,
    );
    const fromCommonChild = engine.evaluate(
      'edge.connect.pre',
      { sourceId: 'commonChild', targetId: 'outside' },
      diagram,
    );
    // Consistência entre os dois contêineres — nenhuma restrição nova nesta
    // PR; a não-conformidade OMG herdada está registrada em pendencias.md.
    expect(fromEventChild.allowed).toBe(fromCommonChild.allowed);
    expect(fromEventChild.allowed).toBe(true);
  });
});
