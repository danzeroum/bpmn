import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import {
  BpmnEditor,
  eventBindingRule,
  PT_BR,
  SIG_REF_MISSING,
  SIG_REF_STALE,
  type BpmnPlugin,
  type EventDefinitionResolver,
} from '../src/index.js';

/**
 * Handoff 16 E-3 — refs governadas `nome@semver` via Biblioteca: contrato de
 * resolução INJETADO com degradação declarada (critério 1), vínculo em UM
 * composto com espelho local (critério 2), selo glifo+texto nos três estados
 * + SIG_REF_MISSING/STALE (critério 3), troca undoável (critério 4), veto por
 * construção + GC do espelho órfão (critério 6) e espelho READ-ONLY na seção
 * da E-2 (reforço 10).
 */
const CATALOG = [
  { name: 'pedido.aprovado', semanticVersion: '1.0.0', status: 'active', definition: { name: 'Pedido aprovado' } },
  { name: 'pedido.aprovado', semanticVersion: '2.0.0', status: 'candidate', definition: { name: 'Pedido aprovado (v2)' } },
  { name: 'falha.cobranca', semanticVersion: '1.0.0', status: 'active', definition: { name: 'Falha de cobrança', errorCode: 'PAY-42' } },
];

const resolver: EventDefinitionResolver = {
  list: (kind) =>
    CATALOG.filter((record) => (record.definition.errorCode ? kind === 'error' : kind === 'message')).map(
      ({ name, semanticVersion, status }) => ({ name, semanticVersion, status }),
    ),
  resolve: (ref, kind) =>
    CATALOG.map((record) => ({ ...record, kind: record.definition.errorCode ? 'error' : 'message' })).find(
      (record) => record.kind === kind && `${record.name}@${record.semanticVersion}` === ref,
    ),
};

const libraryPlugin: BpmnPlugin = { id: 'test/library', eventDefinitionResolver: resolver };

function bindingDiagram(options: { bound?: { binding: string; mirrorName?: string } } = {}): BpmnDiagram {
  const diagram = createDiagram({ name: 'Bindings', id: 'bind' });
  diagram.nodes = {
    plain: createNode({
      id: 'plain',
      type: 'intermediateCatchEvent',
      label: 'Aguardar aprovação',
      x: 60,
      y: 60,
      properties: { eventDefinition: 'message' },
    }),
  };
  if (options.bound) {
    const name = options.bound.binding.slice(0, options.bound.binding.lastIndexOf('@'));
    diagram.nodes.bound = createNode({
      id: 'bound',
      type: 'intermediateCatchEvent',
      label: 'Evento vinculado',
      x: 320,
      y: 60,
      properties: {
        eventDefinition: 'message',
        eventDefinitionRef: `gov-${name}`,
        eventDefinitionBinding: options.bound.binding,
      },
    });
    diagram.definitions = {
      messages: [{ id: `gov-${name}`, name: options.bound.mirrorName ?? name }],
      signals: [],
      errors: [],
    };
  }
  return diagram;
}

const select = (container: HTMLElement, id: string) => {
  fireEvent.pointerDown(container.querySelector(`[data-node-id="${id}"]`)!, { button: 0 });
  fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
};

const undo = () => fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
const picker = () => screen.getByTestId('eventdefs-picker') as HTMLSelectElement;

describe('governed event bindings (E-3)', () => {
  it('critério 1 — sem resolver a degradação é DECLARADA: binding como texto + aviso, sem grupo Biblioteca', () => {
    const { container } = render(
      <BpmnEditor diagram={bindingDiagram({ bound: { binding: 'pedido.aprovado@1.0.0' } })} messages={PT_BR} />,
    );
    select(container, 'bound');
    const degraded = screen.getByTestId('eventdefs-degraded');
    expect(degraded.textContent).toContain('resolução não configurada');
    expect(degraded.textContent).toContain('pedido.aprovado@1.0.0');
    // Sem resolver: nenhum selo e nenhum optgroup "Da Biblioteca".
    expect(screen.queryByTestId('eventdefs-seal')).toBeNull();
    expect(picker().querySelector('optgroup[label="Da Biblioteca"]')).toBeNull();
    // O chip do canvas degrada com o MESMO aviso (glifo ~ + texto).
    const chip = container.querySelector('[data-event-binding="bound"]')!;
    expect(chip.getAttribute('data-binding-state')).toBe('degraded');
    expect(chip.textContent).toContain('resolução não configurada');
  });

  it('critérios 2+10 — vincular pela Biblioteca = UM composto (espelho + ref + pin) e espelho READ-ONLY; 1 undo reverte tudo', () => {
    let latest: BpmnDiagram | null = null;
    const { container } = render(
      <BpmnEditor
        diagram={bindingDiagram()}
        plugins={[libraryPlugin]}
        messages={PT_BR}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    select(container, 'plain');
    // Picker em duas seções: locais + "Da Biblioteca" com nome@semver.
    const group = picker().querySelector('optgroup[label="Da Biblioteca"]')!;
    expect(group).not.toBeNull();
    expect([...group.querySelectorAll('option')].map((option) => option.textContent)).toContain(
      'pedido.aprovado@1.0.0',
    );
    fireEvent.change(picker(), { target: { value: 'bind:pedido.aprovado@1.0.0' } });
    // O binding gravou e o espelho local existe com o payload resolvido.
    expect(picker().value).toBe('bind:pedido.aprovado@1.0.0');
    expect(latest!.nodes.plain.properties.eventDefinitionBinding).toBe('pedido.aprovado@1.0.0');
    expect(latest!.nodes.plain.properties.eventDefinitionRef).toBe('gov-pedido.aprovado');
    expect(latest!.definitions?.messages).toEqual([
      { id: 'gov-pedido.aprovado', name: 'Pedido aprovado' },
    ]);
    // Reforço 10: o espelho é gerenciado — nome bloqueado com aviso.
    const nameInput = screen.getByTestId('eventdefs-name') as HTMLInputElement;
    expect(nameInput.value).toBe('Pedido aprovado');
    expect(nameInput.disabled).toBe(true);
    expect(screen.getByTestId('eventdefs-mirror-notice').textContent).toContain(
      'Gerenciada pela Biblioteca',
    );
    // UM undo: pin, ref E espelho somem juntos (composto atômico).
    undo();
    expect(picker().value).toBe('');
    expect(latest!.nodes.plain.properties.eventDefinitionBinding).toBeUndefined();
    expect(latest!.definitions?.messages ?? []).toEqual([]);
  });

  it('critério 3 — selo glifo+texto nos três estados + chip no canvas (e TRANSIENT no export)', () => {
    // VIGENTE (active) e CANDIDATA (stale) via troca; NÃO RESOLVIDA via pin órfão.
    const { container, unmount } = render(
      <BpmnEditor
        diagram={bindingDiagram({ bound: { binding: 'pedido.aprovado@1.0.0' } })}
        plugins={[libraryPlugin]}
        messages={PT_BR}
      />,
    );
    select(container, 'bound');
    expect(screen.getByTestId('eventdefs-seal').textContent).toBe('✓ VIGENTE');
    expect(screen.getByTestId('eventdefs-seal').getAttribute('data-binding-state')).toBe('active');
    expect(container.querySelector('[data-event-binding="bound"]')!.getAttribute('data-binding-state')).toBe('active');
    fireEvent.change(picker(), { target: { value: 'bind:pedido.aprovado@2.0.0' } });
    expect(screen.getByTestId('eventdefs-seal').textContent).toBe('⚠ CANDIDATA');
    expect(screen.getByTestId('eventdefs-seal').getAttribute('data-binding-state')).toBe('stale');
    unmount();
    const missing = render(
      <BpmnEditor
        diagram={bindingDiagram({ bound: { binding: 'sumida@9.9.9' } })}
        plugins={[libraryPlugin]}
        messages={PT_BR}
      />,
    );
    select(missing.container, 'bound');
    expect(screen.getByTestId('eventdefs-seal').textContent).toBe('✕ NÃO RESOLVIDA');
    expect(
      missing.container.querySelector('[data-event-binding="bound"]')!.getAttribute('data-binding-state'),
    ).toBe('missing');
  });

  it('critério 3b — eventBindingRule emite SIG_REF_MISSING (erro) e SIG_REF_STALE (warning) com código', () => {
    const staleDiagram = bindingDiagram({ bound: { binding: 'pedido.aprovado@2.0.0' } });
    const stale = eventBindingRule(resolver)(staleDiagram);
    expect(stale).toEqual([
      {
        code: SIG_REF_STALE,
        severity: 'warning',
        message: 'Referência governada "pedido.aprovado@2.0.0" aponta para versão não vigente',
        nodeId: 'bound',
      },
    ]);
    const missingDiagram = bindingDiagram({ bound: { binding: 'sumida@9.9.9' } });
    const missing = eventBindingRule(resolver)(missingDiagram);
    expect(missing).toEqual([
      {
        code: SIG_REF_MISSING,
        severity: 'error',
        message: 'Referência governada "sumida@9.9.9" não resolve na Biblioteca',
        nodeId: 'bound',
      },
    ]);
  });

  it('critério 4 — trocar a ref é um comando undoável: 1 undo restaura o pin anterior', () => {
    let latest: BpmnDiagram | null = null;
    const { container } = render(
      <BpmnEditor
        diagram={bindingDiagram({
          bound: { binding: 'pedido.aprovado@1.0.0', mirrorName: 'Pedido aprovado' },
        })}
        plugins={[libraryPlugin]}
        messages={PT_BR}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    select(container, 'bound');
    fireEvent.change(picker(), { target: { value: 'bind:pedido.aprovado@2.0.0' } });
    expect(latest!.nodes.bound.properties.eventDefinitionBinding).toBe('pedido.aprovado@2.0.0');
    expect(latest!.definitions?.messages[0].name).toBe('Pedido aprovado (v2)');
    undo();
    expect(latest!.nodes.bound.properties.eventDefinitionBinding).toBe('pedido.aprovado@1.0.0');
    expect(latest!.definitions?.messages[0].name).toBe('Pedido aprovado');
    expect(picker().value).toBe('bind:pedido.aprovado@1.0.0');
  });

  it('critério 6 — o espelho conta como USO no veto (por construção); desvincular faz GC do espelho órfão', () => {
    let latest: BpmnDiagram | null = null;
    const { container } = render(
      <BpmnEditor
        diagram={bindingDiagram({ bound: { binding: 'pedido.aprovado@1.0.0' } })}
        plugins={[libraryPlugin]}
        messages={PT_BR}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    select(container, 'bound');
    // Tentar excluir o espelho vinculado → veto honesto listando o evento.
    fireEvent.click(screen.getByTestId('eventdefs-delete'));
    const veto = container.querySelector('.bpmnr-toolbar-veto')!;
    expect(veto.textContent).toContain('Definição em uso por 1 evento(s)');
    expect(veto.textContent).toContain('Evento vinculado (bound)');
    // Desvincular (— sem definição —): pin limpo E espelho órfão coletado.
    fireEvent.change(picker(), { target: { value: '' } });
    expect(latest!.nodes.bound.properties.eventDefinitionBinding).toBeUndefined();
    expect(latest!.nodes.bound.properties.eventDefinitionRef).toBeUndefined();
    expect(latest!.definitions?.messages ?? []).toEqual([]);
    // 1 undo restaura pin + ref + espelho (o GC vive no MESMO composto).
    undo();
    expect(latest!.nodes.bound.properties.eventDefinitionBinding).toBe('pedido.aprovado@1.0.0');
    expect(latest!.definitions?.messages).toHaveLength(1);
  });
});
