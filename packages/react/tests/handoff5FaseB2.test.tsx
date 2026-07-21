import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { createDiagram, createNode, type BpmnDiagram, type BpmnNode } from '@buildtovalue/core';
import { BpmnDesigner, PropertiesPanel, useDismissal } from '../src/index.js';

function twoTasksDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Esc stack' });
  diagram.nodes = {
    sub: createNode({
      type: 'subProcess',
      id: 'sub',
      label: 'Outer',
      x: 60,
      y: 60,
      width: 320,
      height: 160,
      properties: { isExpanded: true },
    }),
    inner: createNode({
      type: 'task',
      id: 'inner',
      label: 'Inner',
      x: 90,
      y: 120,
      properties: { parentId: 'sub' },
    }),
  };
  return diagram;
}

/** Two stacked overlays driven by useDismissal — the §11.1 harness. */
function Overlays({ log }: { log: string[] }) {
  const [peekOpen, setPeekOpen] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(true);
  const [, bump] = useState(0);
  useDismissal('test-peek', peekOpen, () => {
    log.push('peek');
    setPeekOpen(false);
  });
  useDismissal('test-popover', popoverOpen, () => {
    log.push('popover');
    setPopoverOpen(false);
  });
  return (
    <div>
      {peekOpen && <div data-overlay="peek" />}
      {popoverOpen && <div data-overlay="popover" />}
      <button type="button" data-rerender onClick={() => bump((n) => n + 1)}>
        re-render
      </button>
    </div>
  );
}

describe('Esc dismissal stack (Handoff 5 §11.1)', () => {
  it('pops popover → peek → selection → drills up one level, in that order', () => {
    const log: string[] = [];
    const { container } = render(
      <BpmnDesigner diagram={twoTasksDiagram()}>
        <Overlays log={log} />
      </BpmnDesigner>,
    );
    // Drill into the sub-process and select the child.
    fireEvent.doubleClick(container.querySelector('[data-node-id="sub"]')!, {
      clientX: 200,
      clientY: 75,
    });
    fireEvent.pointerDown(container.querySelector('[data-node-id="inner"]')!, { button: 0 });
    expect(container.querySelector('[data-node-id="inner"][data-selected]')).not.toBeNull();

    // 1º Esc: the LAST-opened overlay (popover, registered after peek).
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(log).toEqual(['popover']);
    expect(container.querySelector('[data-overlay="popover"]')).toBeNull();
    // 2º Esc: the peek. Selection untouched so far.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(log).toEqual(['popover', 'peek']);
    expect(container.querySelector('[data-node-id="inner"][data-selected]')).not.toBeNull();
    // 3º Esc: clears the selection, stays at the drilled level.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-selected]')).toBeNull();
    expect(container.querySelector('[data-node-id="sub"]')).toBeNull(); // still inside
    // 4º Esc: climbs the breadcrumb one level.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-node-id="sub"]')).not.toBeNull();
  });

  it('keeps stack order across re-renders (inline close identities)', () => {
    const log: string[] = [];
    const { container } = render(
      <BpmnDesigner diagram={twoTasksDiagram()}>
        <Overlays log={log} />
      </BpmnDesigner>,
    );
    // A re-render re-creates every close closure; the peek (bottom) must NOT
    // jump above the popover because of it.
    fireEvent.click(container.querySelector('[data-rerender]')!);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(log).toEqual(['popover']);
  });
});

describe('plugin inspectorSections (wireframe 2d plumbing)', () => {
  it('renders matching sections after the built-in inspector', () => {
    const section = {
      id: 'test-section',
      appliesTo: (node: BpmnNode) => node.type === 'task',
      component: ({ node }: { node: BpmnNode }) => (
        <p data-test-section>seção de {node.label}</p>
      ),
    };
    const { container } = render(
      <BpmnDesigner
        diagram={twoTasksDiagram()}
        plugins={[{ id: 'test/inspector', inspectorSections: [section] }]}
      >
        <PropertiesPanel />
      </BpmnDesigner>,
    );
    fireEvent.pointerDown(container.querySelector('[data-node-id="inner"]')!, { button: 0 });
    expect(container.querySelector('[data-test-section]')?.textContent).toBe('seção de Inner');

    // Non-matching type: section stays out.
    fireEvent.pointerDown(container.querySelector('[data-node-id="sub"]')!, { button: 0 });
    expect(container.querySelector('[data-test-section]')).toBeNull();
  });

  it('SL-5: a section that declares a `tab` renders as a registered tab, not inline', () => {
    const section = {
      id: 'contracts-section',
      appliesTo: (node: BpmnNode) => node.type === 'task',
      component: ({ node }: { node: BpmnNode }) => <p data-test-tab-section>contrato de {node.label}</p>,
      tab: { id: 'contracts', label: 'Contratos' },
    };
    const { container } = render(
      <BpmnDesigner
        diagram={twoTasksDiagram()}
        plugins={[{ id: 'test/tab', inspectorSections: [section] }]}
      >
        <PropertiesPanel />
      </BpmnDesigner>,
    );
    fireEvent.pointerDown(container.querySelector('[data-node-id="inner"]')!, { button: 0 });
    // a tab strip appears (General + the registered plugin tab); the section is NOT inline
    expect(container.querySelector('[data-inspector-tab="general"]')).not.toBeNull();
    expect(container.querySelector('[data-inspector-tab="contracts"]')).not.toBeNull();
    expect(container.querySelector('[data-test-tab-section]')).toBeNull();
    // activating the tab renders the section; returning to General hides it again
    fireEvent.click(container.querySelector('[data-inspector-tab="contracts"]')!);
    expect(container.querySelector('[data-test-tab-section]')?.textContent).toBe('contrato de Inner');
    fireEvent.click(container.querySelector('[data-inspector-tab="general"]')!);
    expect(container.querySelector('[data-test-tab-section]')).toBeNull();
  });
});
