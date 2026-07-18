import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render } from '@testing-library/react';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { lintFindings } from '@buildtovalue/lint';
import {
  BpmnEditor,
  StartEventShape,
  SubProcessShape,
  svgToString,
  PT_BR,
} from '../src/index.js';

/**
 * Handoff 17 ES-2 — shapes do event subprocess (§4b): pontilhado SÓ com o
 * helper do core (critério 1, com snapshot byte-idêntico do subProcess
 * comum), start tracejado (critério 2), colapsado com glifo + degradação
 * declarada (critério 3 + reforço 7), paleta composta lint-clean com 1 undo
 * (critério 4), export fiel (critério 5) e anti-drift do ⌘K (reforço 8).
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const FROZEN = JSON.parse(readFileSync(join(HERE, 'subProcessShapeFrozen.json'), 'utf8')) as {
  expanded: string;
  expandedSelected: string;
  collapsed: string;
};

const subNode = (properties: Record<string, unknown>) =>
  createNode({
    id: 'sub',
    type: 'subProcess',
    label: 'Tratamento',
    x: 0,
    y: 0,
    width: 260,
    height: 160,
    properties,
  });

describe('SubProcessShape (critério 1)', () => {
  it('subProcess COMUM é byte-idêntico ao markup congelado pré-ES-2', () => {
    expect(renderToStaticMarkup(<SubProcessShape node={subNode({ isExpanded: true })} selected={false} />)).toBe(FROZEN.expanded);
    expect(renderToStaticMarkup(<SubProcessShape node={subNode({ isExpanded: true })} selected />)).toBe(FROZEN.expandedSelected);
    expect(renderToStaticMarkup(<SubProcessShape node={subNode({})} selected={false} />)).toBe(FROZEN.collapsed);
  });

  it('pontilhado + tag "event subProcess" SÓ com triggeredByEvent (helper do core)', () => {
    const markup = renderToStaticMarkup(
      <SubProcessShape node={subNode({ isExpanded: true, triggeredByEvent: true })} selected={false} />,
    );
    expect(markup).toContain('stroke-dasharray="2,3"');
    expect(markup).toContain('event subProcess');
    // Prop com valor errado nunca conta (predicado estrito do helper).
    const bogus = renderToStaticMarkup(
      <SubProcessShape node={subNode({ isExpanded: true, triggeredByEvent: 'yes' })} selected={false} />,
    );
    expect(bogus).not.toContain('stroke-dasharray');
  });
});

describe('StartEventShape (critério 2)', () => {
  const startNode = (properties: Record<string, unknown>) =>
    createNode({ id: 's', type: 'startEvent', label: 'Início', x: 0, y: 0, width: 36, height: 36, properties });

  it('tracejado (mesmo dash do boundary H6) SÓ com startIsInterrupting === false', () => {
    const dashed = renderToStaticMarkup(
      <StartEventShape node={startNode({ eventDefinition: 'message', isInterrupting: false })} selected={false} />,
    );
    expect(dashed).toContain('stroke-dasharray="3,2"');
    const solid = renderToStaticMarkup(
      <StartEventShape node={startNode({ eventDefinition: 'message' })} selected={false} />,
    );
    expect(solid).not.toContain('stroke-dasharray');
  });
});

/** Diagrama com o contêiner colapsado + starts configuráveis. */
function collapsedDiagram(starts: Array<Record<string, unknown>>): BpmnDiagram {
  const diagram = createDiagram({ name: 'ESub', id: 'esub' });
  diagram.nodes = {
    sub: createNode({
      id: 'sub',
      type: 'subProcess',
      label: 'Tratamento',
      x: 120,
      y: 80,
      width: 200,
      height: 120,
      properties: { triggeredByEvent: true },
    }),
  };
  starts.forEach((properties, index) => {
    diagram.nodes[`st${index}`] = createNode({
      id: `st${index}`,
      type: 'startEvent',
      label: `S${index}`,
      x: 140,
      y: 120,
      properties: { parentId: 'sub', ...properties },
    });
  });
  return diagram;
}

describe('colapsado + degradação (critério 3, reforço 7)', () => {
  it('mostra o glifo do PRIMEIRO start tipado; expand/collapse herdados', () => {
    const { container } = render(
      <BpmnEditor diagram={collapsedDiagram([{ eventDefinition: 'message' }])} messages={PT_BR} />,
    );
    expect(container.querySelector('[data-event-subprocess-trigger="message"]')).not.toBeNull();
  });

  it('reforço 7 — 0 starts e >1 starts degradam SEM crash (glifo do primeiro tipado, declarado)', () => {
    // 0 starts: sem glifo, zero exceção.
    const zero = render(<BpmnEditor diagram={collapsedDiagram([])} messages={PT_BR} />);
    expect(zero.container.querySelector('[data-event-subprocess-trigger]')).toBeNull();
    zero.unmount();
    // 2 starts (import sujo): o PRIMEIRO tipado vence — escolha declarada no
    // código; corrigir é papel do lint ES-4, nunca do shape.
    const two = render(
      <BpmnEditor
        diagram={collapsedDiagram([{ eventDefinition: 'message' }, { eventDefinition: 'error' }])}
        messages={PT_BR}
      />,
    );
    expect(
      two.container.querySelector('[data-event-subprocess-trigger]')?.getAttribute('data-event-subprocess-trigger'),
    ).toBe('message');
  });
});

describe('paleta composta (critério 4) + ⌘K (reforço 8) + export (critério 5)', () => {
  it('critério 4 — o item cria contêiner + start tipado + definição nomeada em 1 undo, LINT-CLEAN', () => {
    let latest: BpmnDiagram | null = null;
    const { container } = render(
      <BpmnEditor
        diagram={createDiagram({ name: 'Vazio', id: 'v' })}
        messages={PT_BR}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    const button = container.querySelector('[data-palette-item="eventSubprocess"]')!;
    // i18n aditivo: o rótulo PT vem de palette.item.eventSubprocess.
    expect(button.textContent).toContain('Subprocesso de evento');
    fireEvent.click(button);
    const sub = Object.values(latest!.nodes).find((node) => node.type === 'subProcess')!;
    expect(sub.properties.triggeredByEvent).toBe(true);
    const start = Object.values(latest!.nodes).find((node) => node.type === 'startEvent')!;
    expect(start.properties.parentId).toBe(sub.id);
    expect(start.properties.eventDefinition).toBe('message');
    expect(start.properties.eventDefinitionRef).toBe('msg-1');
    expect(latest!.definitions?.messages).toEqual([{ id: 'msg-1', name: 'Nova mensagem' }]);
    // LINT-CLEAN por construção: zero EVT_REF_MISSING no drop novo.
    expect(lintFindings(latest!).filter((f) => f.code === 'EVT_REF_MISSING')).toEqual([]);
    // Critério 5: pontilhado é GEOMETRIA — sobrevive à serialização do SVG.
    const svg = container.querySelector('svg.bpmnr-canvas') as SVGSVGElement;
    expect(svgToString(svg)).toContain('stroke-dasharray="2,3"');
    // 1 undo reverte contêiner + start + definição.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(Object.keys(latest!.nodes)).toEqual([]);
    expect(latest!.definitions?.messages ?? []).toEqual([]);
  });

  it('reforço 8 — o ⌘K resolve o item pela MESMA fábrica (um comando, uma fonte)', () => {
    let latest: BpmnDiagram | null = null;
    const { container } = render(
      <BpmnEditor
        diagram={createDiagram({ name: 'Vazio', id: 'v2' })}
        messages={PT_BR}
        onChange={(next) => {
          latest = next;
        }}
      />,
    );
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = container.querySelector('.bpmnr-cmdk input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Subprocesso de evento' } });
    const row = container.querySelector('[data-cmdk-item="palette.insert.eventSubprocess"]')!;
    expect(row.textContent).toContain('Inserir: Subprocesso de evento');
    fireEvent.click(row);
    // O MESMO resultado do clique da paleta — a fábrica é uma só.
    const sub = Object.values(latest!.nodes).find((node) => node.type === 'subProcess')!;
    expect(sub.properties.triggeredByEvent).toBe(true);
    expect(latest!.definitions?.messages).toEqual([{ id: 'msg-1', name: 'Nova mensagem' }]);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(Object.keys(latest!.nodes)).toEqual([]);
  });
});
