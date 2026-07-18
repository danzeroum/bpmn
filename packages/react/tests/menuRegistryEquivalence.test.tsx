import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import type { BpmnPlugin } from '../src/index.js';
import { BpmnDesigner, PT_BR } from '../src/index.js';

/**
 * Handoff 15 V-7 (V-0 decisão 4, padrão N-7): teste de EQUIVALÊNCIA congelado
 * ANTES da extração do registro de comandos do ContextMenu. Cada cenário fixa
 * ids, rótulos E ORDEM exatamente como a implementação inline os produz hoje
 * — o refactor (builtinMenuItems) só passa se render for idêntico. Nenhuma
 * asserção aqui pode ser afrouxada durante a extração.
 */

function baseDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Equivalência' });
  diagram.nodes = {
    a: createNode({ type: 'task', id: 'a', label: 'A', x: 0, y: 0 }),
    b: createNode({ type: 'task', id: 'b', label: 'B', x: 400, y: 0 }),
    c: createNode({ type: 'task', id: 'c', label: 'C', x: 800, y: 0 }),
  };
  diagram.edges = {
    e: createEdge({ id: 'e', sourceId: 'a', targetId: 'b' }),
  };
  return diagram;
}

function manualEdgeDiagram(): BpmnDiagram {
  const diagram = baseDiagram();
  diagram.edges.e = {
    ...diagram.edges.e,
    waypoints: [
      { x: 40, y: 30 },
      { x: 200, y: 30 },
      { x: 440, y: 30 },
    ],
    properties: { routeMode: 'manual' },
  };
  return diagram;
}

function subprocessDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Containers' });
  diagram.nodes = {
    sub: createNode({
      type: 'subProcess',
      id: 'sub',
      label: 'Sub',
      x: 100,
      y: 100,
      width: 320,
      height: 160,
      properties: { isExpanded: true },
    }),
    // Dentro do container, SEM parentId → candidato a "mover para dentro".
    inside: createNode({ type: 'task', id: 'inside', label: 'Dentro', x: 140, y: 140 }),
    // parentId no container mas centro FORA → só "remover do sub-processo".
    outside: createNode({
      type: 'task',
      id: 'outside',
      label: 'Fora',
      x: 600,
      y: 400,
      properties: { parentId: 'sub' },
    }),
  };
  diagram.edges = {};
  return diagram;
}

/** ids na ORDEM renderizada + rótulo visível por id. */
function menuSnapshot(container: HTMLElement): Array<[string, string]> {
  return [...container.querySelectorAll<HTMLButtonElement>('[data-menu-item]')].map((button) => [
    button.getAttribute('data-menu-item')!,
    button.textContent!.trim(),
  ]);
}

function openMenuOn(container: HTMLElement, selector: string, at?: { x: number; y: number }) {
  fireEvent.contextMenu(container.querySelector(selector)!, {
    clientX: at?.x ?? 10,
    clientY: at?.y ?? 10,
  });
}

const select = (container: HTMLElement, id: string, additive = false) => {
  fireEvent.pointerDown(container.querySelector(`[data-node-id="${id}"]`)!, {
    button: 0,
    ...(additive ? { shiftKey: true } : {}),
  });
  fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
};

describe('equivalência congelada do ContextMenu (pré-refactor V-7)', () => {
  it('aresta MANUAL: back-to-auto → add-waypoint → edit-label, nesta ordem', () => {
    const { container } = render(<BpmnDesigner diagram={manualEdgeDiagram()} messages={PT_BR} />);
    openMenuOn(container, '[data-edge-id="e"]', { x: 200, y: 30 });
    expect(menuSnapshot(container)).toEqual([
      ['edge.back-to-auto', 'Voltar ao automático'],
      ['edge.add-waypoint', 'Adicionar waypoint aqui'],
      ['edge.edit-label', 'Editar rótulo'],
    ]);
  });

  it('aresta AUTO: sem back-to-auto; ordem preservada', () => {
    const { container } = render(<BpmnDesigner diagram={baseDiagram()} messages={PT_BR} />);
    openMenuOn(container, '[data-edge-id="e"]', { x: 200, y: 30 });
    expect(menuSnapshot(container)).toEqual([
      ['edge.add-waypoint', 'Adicionar waypoint aqui'],
      ['edge.edit-label', 'Editar rótulo'],
    ]);
  });

  it('nó simples: edit-label → copy → duplicate → delete', () => {
    const { container } = render(<BpmnDesigner diagram={baseDiagram()} messages={PT_BR} />);
    openMenuOn(container, '[data-node-id="a"]');
    expect(menuSnapshot(container)).toEqual([
      ['node.edit-label', 'Editar rótulo'],
      ['node.copy', 'Copiar'],
      ['node.duplicate', 'Duplicar'],
      ['node.delete', 'Excluir'],
    ]);
  });

  it('nó sobre container sem parentId: move-into entra na 2ª posição', () => {
    const { container } = render(<BpmnDesigner diagram={subprocessDiagram()} messages={PT_BR} />);
    openMenuOn(container, '[data-node-id="inside"]');
    expect(menuSnapshot(container).map(([id]) => id)).toEqual([
      'node.edit-label',
      'node.move-into-subprocess',
      'node.copy',
      'node.duplicate',
      'node.delete',
    ]);
    expect(menuSnapshot(container)[1][1]).toBe('Mover para dentro de “Sub”');
  });

  it('nó com parentId fora do container: remove-from na 2ª posição', () => {
    const { container } = render(<BpmnDesigner diagram={subprocessDiagram()} messages={PT_BR} />);
    openMenuOn(container, '[data-node-id="outside"]');
    expect(menuSnapshot(container).map(([id]) => id)).toEqual([
      'node.edit-label',
      'node.remove-from-subprocess',
      'node.copy',
      'node.duplicate',
      'node.delete',
    ]);
  });

  it('seleção de 3 nós: align ×4 e distribute ×2 no fim, na ordem canônica', () => {
    const { container } = render(<BpmnDesigner diagram={baseDiagram()} messages={PT_BR} />);
    select(container, 'a');
    select(container, 'b', true);
    select(container, 'c', true);
    openMenuOn(container, '[data-node-id="a"]');
    expect(menuSnapshot(container).map(([id]) => id)).toEqual([
      'node.edit-label',
      'node.copy',
      'node.duplicate',
      'node.delete',
      'selection.align-left',
      'selection.align-center-x',
      'selection.align-top',
      'selection.align-center-y',
      'selection.distribute-horizontal',
      'selection.distribute-vertical',
    ]);
  });

  it('canvas com clipboard: só paste; canvas sem clipboard: menu ausente', () => {
    const { container } = render(<BpmnDesigner diagram={baseDiagram()} messages={PT_BR} />);
    // Sem conteúdo copiado o menu de canvas nem abre (zero itens).
    openMenuOn(container, 'svg.bpmnr-canvas');
    expect(container.querySelector('[data-testid="context-menu"]')).toBeNull();
    // Copiar um nó habilita o paste do canvas.
    openMenuOn(container, '[data-node-id="a"]');
    fireEvent.click(container.querySelector('[data-menu-item="node.copy"]')!);
    openMenuOn(container, 'svg.bpmnr-canvas');
    expect(menuSnapshot(container)).toEqual([['canvas.paste', 'Colar aqui']]);
  });

  it('plugins: when() decide presença, id prefixado, seção com kicker, run só via execute', () => {
    const run = vi.fn();
    const plugin: BpmnPlugin = {
      id: 'demo',
      contextMenuItems: () => [
        { id: 'always', label: 'Sempre', run },
        { id: 'never', label: 'Nunca', when: () => false, run: vi.fn() },
        {
          id: 'nodes-only',
          label: 'Só nós',
          when: (t) => t.kind === 'node',
          run: vi.fn(),
        },
      ],
    };
    const { container } = render(
      <BpmnDesigner diagram={baseDiagram()} messages={PT_BR} plugins={[plugin]} />,
    );
    openMenuOn(container, '[data-node-id="a"]');
    expect(menuSnapshot(container)).toEqual([
      ['node.edit-label', 'Editar rótulo'],
      ['node.copy', 'Copiar'],
      ['node.duplicate', 'Duplicar'],
      ['node.delete', 'Excluir'],
      ['demo/always', 'Sempre'],
      ['demo/nodes-only', 'Só nós'],
    ]);
    // Kicker da seção = id do plugin, uma vez.
    const kickers = [...container.querySelectorAll('.bpmnr-context-menu-kicker')].map(
      (k) => k.textContent,
    );
    expect(kickers).toEqual(['demo']);
  });
});
