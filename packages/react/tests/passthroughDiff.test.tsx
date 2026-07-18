import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
  type XmlSubtree,
} from '@buildtovalue/core';
import { BpmnDiffViewer, PT_BR } from '../src/index.js';

/**
 * Passthrough × review (reforço 1 do plano validado): uma extensão
 * estrangeira alterada aparece no popover ΔN do BpmnDiffViewer como CAMPO
 * NOMEADO (`zeebe:taskDefinition`, `@zeebe:modelerTemplate`) — nunca um blob
 * `foreignExtensions` opaco. É o que conecta o passthrough ao review do H15.
 */
function taskDefinition(retries: string): XmlSubtree {
  return {
    tag: 'zeebe:taskDefinition',
    attributes: { type: 'payment-service', retries },
    children: [],
    text: '',
  };
}

function diagramWith(retries: string, template: string): BpmnDiagram {
  const diagram = createDiagram({ name: 'Zeebe', id: 'zx' });
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Início', x: 40, y: 100 }),
    work: {
      ...createNode({ id: 'work', type: 'serviceTask', label: 'Cobrar', x: 200, y: 90 }),
      foreignExtensions: [taskDefinition(retries)],
      foreignAttributes: { 'zeebe:modelerTemplate': template },
    },
  };
  diagram.edges = { e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'work' }) };
  return diagram;
}

describe('Δ nomeado de extensão estrangeira no popover ΔN', () => {
  it('mostra zeebe:taskDefinition e @zeebe:modelerTemplate como campos próprios', () => {
    const { container } = render(
      <BpmnDiffViewer
        base={diagramWith('3', 'tmpl-v1')}
        target={diagramWith('5', 'tmpl-v2')}
        messages={PT_BR}
      />,
    );
    fireEvent.click(container.querySelector('[data-diff-badge="work"]')!);
    const popover = screen.getByTestId('diff-popover');
    const fields = [...popover.querySelectorAll('[data-diff-field]')].map((el) =>
      el.getAttribute('data-diff-field'),
    );
    expect(fields.sort()).toEqual(['@zeebe:modelerTemplate', 'zeebe:taskDefinition']);
    // Nunca o blob opaco.
    expect(fields).not.toContain('foreignExtensions');
    expect(fields).not.toContain('foreignAttributes');
    // Antes → depois legíveis por campo.
    const named = popover.querySelector('[data-diff-field="zeebe:taskDefinition"]')!;
    expect(named.textContent).toContain('"retries":"3"');
    expect(named.textContent).toContain('"retries":"5"');
    const attr = popover.querySelector('[data-diff-field="@zeebe:modelerTemplate"]')!;
    expect(attr.textContent).toContain('tmpl-v1');
    expect(attr.textContent).toContain('tmpl-v2');
  });
});
