import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnEditor, PT_BR, type BpmnPlugin } from '../src/index.js';

/**
 * Handoff 14 §1f — the "Execução" tab: only with an engine plugin registered;
 * progressive disclosure (job type + retries visible, the rest foldable);
 * deploy GATED — only an ACTIVE (VIGENTE) and signed version deploys, anything
 * else gets the "⚑ Deploy bloqueado → Ir para promoção" card.
 */

function diagramWith(status: 'draft' | 'candidate' | 'active' = 'draft'): BpmnDiagram {
  const diagram = createDiagram({ name: 'Engine flow' });
  diagram.version = { ...diagram.version, status };
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', x: 40, y: 40 }),
    svc: createNode({
      id: 'svc',
      type: 'serviceTask',
      label: 'Cobrar',
      x: 200,
      y: 40,
      properties: { 'zeebe:taskDefinitionType': 'verify-credit', 'zeebe:taskHeaders': 'a=1' },
    }),
  };
  diagram.edges = { e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'svc' }) };
  return diagram;
}

function enginePlugin(overrides: Partial<NonNullable<BpmnPlugin['engine']>> = {}): BpmnPlugin {
  return {
    id: 'zeebe-bridge',
    engine: { id: 'zeebe', name: 'Camunda 8 (Zeebe)', ...overrides },
  };
}

function selectNode(container: HTMLElement, id: string) {
  fireEvent.pointerDown(container.querySelector(`[data-node-id="${id}"]`)!, { button: 0 });
  fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
}

describe('execution tab (spec 1f)', () => {
  it('WITHOUT an engine plugin there is no tab bar at all', () => {
    const { container } = render(<BpmnEditor diagram={diagramWith()} messages={PT_BR} />);
    selectNode(container, 'svc');
    expect(container.querySelector('.bpmnr-inspector-tabs')).toBeNull();
    expect(container.querySelector('[data-inspector-node="svc"]')).not.toBeNull();
  });

  it('with an engine plugin, executable activities gain the Execução tab (essential visible)', () => {
    const { container } = render(
      <BpmnEditor diagram={diagramWith()} plugins={[enginePlugin()]} messages={PT_BR} />,
    );
    selectNode(container, 'svc');
    fireEvent.click(container.querySelector('[data-inspector-tab="execution"]')!);
    const tab = container.querySelector('[data-inspector-execution="svc"]')!;
    expect(tab.textContent).toContain('Camunda 8 (Zeebe)');
    expect(tab.textContent).toContain('ESSENCIAL');
    // Essential fields carry the engine binding values.
    const jobType = screen.getByLabelText('Job type') as HTMLInputElement;
    expect(jobType.value).toBe('verify-credit');
    // Progressive disclosure: the advanced block is a FOLDED <details>.
    const advanced = screen.getByTestId('execution-advanced') as HTMLDetailsElement;
    expect(advanced.open).toBe(false);
    expect(advanced.textContent).toContain('zeebe:taskHeaders');
  });

  it('editing the job type commits ONE undoable command', () => {
    const { container } = render(
      <BpmnEditor diagram={diagramWith()} plugins={[enginePlugin()]} messages={PT_BR} />,
    );
    selectNode(container, 'svc');
    fireEvent.click(container.querySelector('[data-inspector-tab="execution"]')!);
    const jobType = screen.getByLabelText('Job type') as HTMLInputElement;
    fireEvent.change(jobType, { target: { value: 'charge-card' } });
    fireEvent.blur(jobType);
    expect((screen.getByLabelText('Job type') as HTMLInputElement).value).toBe('charge-card');
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect((screen.getByLabelText('Job type') as HTMLInputElement).value).toBe('verify-credit');
  });

  it('non-executable elements (events) never show the tab bar', () => {
    const { container } = render(
      <BpmnEditor diagram={diagramWith()} plugins={[enginePlugin()]} messages={PT_BR} />,
    );
    selectNode(container, 'start');
    expect(container.querySelector('.bpmnr-inspector-tabs')).toBeNull();
  });

  it('CANDIDATA → "⚑ Deploy bloqueado" card with "Ir para promoção"; deploy never callable', () => {
    const deploy = vi.fn();
    const onRequestPromotion = vi.fn();
    const { container } = render(
      <BpmnEditor
        diagram={diagramWith('candidate')}
        plugins={[enginePlugin({ deploy, onRequestPromotion, isSigned: () => true })]}
        messages={PT_BR}
      />,
    );
    selectNode(container, 'svc');
    fireEvent.click(container.querySelector('[data-inspector-tab="execution"]')!);
    expect(screen.queryByTestId('engine-deploy')).toBeNull();
    const blocked = screen.getByTestId('engine-blocked');
    expect(blocked.textContent).toContain('Deploy bloqueado');
    expect(blocked.textContent).toContain('CANDIDATA');
    fireEvent.click(screen.getByTestId('engine-go-promote'));
    expect(onRequestPromotion).toHaveBeenCalledTimes(1);
    expect(deploy).not.toHaveBeenCalled();
  });

  it('ACTIVE but NOT signed stays blocked — the gate needs both', () => {
    const { container } = render(
      <BpmnEditor
        diagram={diagramWith('active')}
        plugins={[enginePlugin({ isSigned: () => false })]}
        messages={PT_BR}
      />,
    );
    selectNode(container, 'svc');
    fireEvent.click(container.querySelector('[data-inspector-tab="execution"]')!);
    expect(screen.queryByTestId('engine-deploy')).toBeNull();
    expect(screen.getByTestId('engine-blocked').textContent).toContain('ATIVA');
  });

  it('ACTIVE + signed → deploy enabled and invoked with the diagram', () => {
    const deploy = vi.fn();
    const { container } = render(
      <BpmnEditor
        diagram={diagramWith('active')}
        plugins={[enginePlugin({ deploy, isSigned: () => true })]}
        messages={PT_BR}
      />,
    );
    selectNode(container, 'svc');
    fireEvent.click(container.querySelector('[data-inspector-tab="execution"]')!);
    expect(screen.queryByTestId('engine-blocked')).toBeNull();
    fireEvent.click(screen.getByTestId('engine-deploy'));
    expect(deploy).toHaveBeenCalledTimes(1);
    expect(deploy.mock.calls[0][0].nodes.svc).toBeDefined();
  });
});
