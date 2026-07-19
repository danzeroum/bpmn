import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  BpmnXmlConverter,
  createDefaultRegistry,
  createDiagram,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import {
  BpmnEditor,
  buildCompensationPairInsert,
  PT_BR,
  type PaletteBuildContext,
} from '../src/index.js';

/**
 * Handoff 19 §6b — react: o glifo rewind da fonte única, o boundary ⟲ SEMPRE
 * sólido (sem toggle), a associação tracejada sem seta, o marcador ◀◀ no handler
 * (coexiste com loop), o chip transiente do throw, o picker de ATIVIDADES
 * compensáveis do MESMO escopo (reforço 8) e o composto da paleta (handler
 * abaixo do host + associação com DI estável, byte-estável no 2º export — reforço 9).
 */
function compDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Comp', id: 'comp' });
  diagram.nodes = {
    hotel: createNode({ id: 'hotel', type: 'serviceTask', label: 'Reservar hotel', x: 200, y: 100 }),
    bnd: createNode({
      id: 'bnd',
      type: 'boundaryEvent',
      label: 'Compensar hotel',
      x: 260,
      y: 150,
      properties: { attachedToRef: 'hotel', eventDefinition: 'compensate' },
    }),
    cancel: createNode({
      id: 'cancel',
      type: 'serviceTask',
      label: 'Cancelar reserva',
      x: 200,
      y: 260,
      properties: { isForCompensation: true },
    }),
    thr: createNode({
      id: 'thr',
      type: 'intermediateThrowEvent',
      label: 'Reverter',
      x: 420,
      y: 110,
      properties: { eventDefinition: 'compensate', compensateActivityRef: 'hotel' },
    }),
  };
  diagram.edges = {
    a1: createEdgeAssoc('a1', 'bnd', 'cancel'),
  };
  return diagram;
}

function createEdgeAssoc(id: string, sourceId: string, targetId: string) {
  return {
    id,
    type: 'association',
    sourceId,
    targetId,
    properties: {},
    createdInVersion: '0',
    audit: { createdAt: '2026-07-19T00:00:00.000Z', createdBy: 'test', history: [] },
  } as BpmnDiagram['edges'][string];
}

const select = (container: HTMLElement, id: string) => {
  fireEvent.pointerDown(container.querySelector(`[data-node-id="${id}"]`)!, { button: 0 });
  fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
};

describe('glifo + boundary sólido + toggle ausente', () => {
  it('o boundary ⟲ NÃO mostra o toggle interrupting (sempre sólido)', () => {
    const { container } = render(<BpmnEditor diagram={compDiagram()} messages={PT_BR} />);
    select(container, 'bnd');
    // Diferente do boundary de escalação, o de compensação não tem o toggle.
    expect(screen.queryByTestId('interrupting-checkbox')).toBeNull();
  });

  it('o boundary de compensação renderiza sólido (sem strokeDasharray de NI)', () => {
    const { container } = render(<BpmnEditor diagram={compDiagram()} messages={PT_BR} />);
    const bnd = container.querySelector('[data-node-id="bnd"]');
    expect(bnd).not.toBeNull();
    // Nenhum círculo do boundary desenha tracejado (não há não-interrupting aqui).
    const dashed = bnd!.querySelectorAll('circle[stroke-dasharray]');
    expect(dashed.length).toBe(0);
  });
});

describe('associação tracejada sem seta', () => {
  it('a aresta association desenha tracejada e SEM markerEnd de fluxo', () => {
    const { container } = render(<BpmnEditor diagram={compDiagram()} messages={PT_BR} />);
    const edge = container.querySelector('[data-edge-id="a1"]');
    expect(edge).not.toBeNull();
    const line = edge!.querySelector('path[stroke-dasharray]');
    expect(line).not.toBeNull();
    // Sem seta: nenhum path visível do edge carrega markerEnd.
    const withMarker = [...edge!.querySelectorAll('path')].filter((p) => p.getAttribute('marker-end'));
    expect(withMarker.length).toBe(0);
  });
});

describe('marcador ◀◀ do handler (coexiste com loop/MI)', () => {
  it('o handler isForCompensation mostra o marcador ◀◀', () => {
    const { container, unmount } = render(<BpmnEditor diagram={compDiagram()} messages={PT_BR} />);
    expect(container.querySelector('[data-node-id="cancel"] [data-comp-marker]')).not.toBeNull();
    unmount();
  });

  it('coexiste com o marcador de loop (◀◀ + loop no mesmo handler)', () => {
    const withLoop = compDiagram();
    withLoop.nodes.cancel.properties.marker = 'loop';
    const { container } = render(<BpmnEditor diagram={withLoop} messages={PT_BR} />);
    // O marcador de compensação segue presente mesmo com o loop marker.
    expect(container.querySelector('[data-node-id="cancel"] [data-comp-marker]')).not.toBeNull();
  });
});

describe('picker de atividades compensáveis (mesmo escopo — reforço 8)', () => {
  it('o throw lista as atividades compensáveis do escopo + broadcast default', () => {
    const { container } = render(<BpmnEditor diagram={compDiagram()} messages={PT_BR} />);
    select(container, 'thr');
    const picker = screen.getByTestId('compensation-target') as HTMLSelectElement;
    const options = [...picker.options].map((o) => o.value);
    expect(options).toContain(''); // broadcast (default)
    expect(options).toContain('hotel'); // a atividade compensável do escopo
    // O valor assentado é a atividade escolhida no fixture.
    expect(picker.value).toBe('hotel');
  });

  it('reforço 8: atividade compensável de OUTRO escopo NÃO aparece no throw do topo', () => {
    const diagram = compDiagram();
    // Um subProcess com uma atividade compensável DENTRO.
    diagram.nodes.sub = createNode({ id: 'sub', type: 'subProcess', label: 'Bloco', x: 40, y: 360 });
    diagram.nodes.inner = createNode({
      id: 'inner',
      type: 'serviceTask',
      label: 'Emitir voucher',
      x: 60,
      y: 400,
      properties: { parentId: 'sub' },
    });
    diagram.nodes.bInner = createNode({
      id: 'bInner',
      type: 'boundaryEvent',
      label: 'Compensar voucher',
      x: 100,
      y: 440,
      properties: { attachedToRef: 'inner', eventDefinition: 'compensate' },
    });
    const { container } = render(<BpmnEditor diagram={diagram} messages={PT_BR} />);
    select(container, 'thr'); // throw no TOPO
    const picker = screen.getByTestId('compensation-target') as HTMLSelectElement;
    const options = [...picker.options].map((o) => o.value);
    expect(options).toContain('hotel'); // mesmo escopo (topo)
    expect(options).not.toContain('inner'); // OUTRO escopo — não listado
  });
});

describe('chip transiente «⟲ compensa: …»', () => {
  it('o throw com activityRef mostra o nome da atividade', () => {
    const { container, unmount } = render(<BpmnEditor diagram={compDiagram()} messages={PT_BR} />);
    const chip = container.querySelector('[data-event-compensation="thr"]');
    expect(chip!.textContent).toContain('⟲');
    expect(chip!.textContent).toContain('Reservar hotel');
    unmount();
  });

  it('broadcast (sem activityRef) mostra «escopo»', () => {
    const bc = compDiagram();
    delete bc.nodes.thr.properties.compensateActivityRef;
    const { container } = render(<BpmnEditor diagram={bc} messages={PT_BR} />);
    const chip = container.querySelector('[data-event-compensation="thr"]');
    expect(chip!.textContent).toContain('escopo');
  });
});

describe('paleta «Compensação (par)» — composto + veto + byte-estável (reforço 9)', () => {
  const registry = createDefaultRegistry();
  const t = (key: string) => key;
  const ctxAt = (diagram: BpmnDiagram, x: number, y: number): PaletteBuildContext =>
    ({ diagram, registry, x, y, t }) as PaletteBuildContext;

  it('drop sobre atividade: boundary + handler ABAIXO + associação em 1 undo', () => {
    const diagram = createDiagram({ name: 'H', id: 'h' });
    diagram.nodes = { task: createNode({ id: 'task', type: 'userTask', label: 'T', x: 200, y: 120 }) };
    const result = buildCompensationPairInsert(ctxAt(diagram, 242, 132));
    expect('command' in result).toBe(true);
    if (!('command' in result)) return;
    const next = result.command.execute(diagram);
    const nodes = Object.values(next.nodes);
    const boundary = nodes.find((n) => n.properties.eventDefinition === 'compensate');
    const handler = nodes.find((n) => n.properties.isForCompensation === true);
    expect(boundary).toBeTruthy();
    expect(handler).toBeTruthy();
    expect(boundary!.properties.cancelActivity).toBeUndefined(); // sólido
    // Handler ABAIXO do host (offset declarado).
    expect(handler!.y).toBeGreaterThan(next.nodes.task.y + next.nodes.task.height);
    // A associação liga boundary → handler.
    const assoc = Object.values(next.edges).find((e) => e.type === 'association');
    expect(assoc).toBeTruthy();
    expect(assoc!.sourceId).toBe(boundary!.id);
    expect(assoc!.targetId).toBe(handler!.id);
  });

  it('reforço 9: o diagrama recém-criado re-exporta byte-estável no 2º export', () => {
    const diagram = createDiagram({ name: 'H', id: 'h' });
    diagram.nodes = { task: createNode({ id: 'task', type: 'userTask', label: 'T', x: 200, y: 120 }) };
    const result = buildCompensationPairInsert(ctxAt(diagram, 242, 132));
    if (!('command' in result)) throw new Error('expected a command');
    const next = result.command.execute(diagram);
    const converter = new BpmnXmlConverter();
    const first = converter.toXml(next);
    const second = converter.toXml(converter.fromXml(first).diagram);
    expect(second).toBe(first);
  });

  it('drop em canvas vazio (sem host) = veto declarado, nada criado', () => {
    const diagram = createDiagram({ name: 'Empty', id: 'e' });
    const result = buildCompensationPairInsert(ctxAt(diagram, 400, 400));
    expect('veto' in result).toBe(true);
    expect('command' in result).toBe(false);
  });
});
