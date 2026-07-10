import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  createDiagram,
  createNode,
  type BpmnDiagram,
  type ValidationRule,
} from '@buildtovalue/core';
import { BpmnDesigner, GovernanceBreadcrumb, Toolbar, PT_BR, I18nProvider } from '../src/index.js';

/** Expanded sub-process with children + a businessRuleTask, for F-A checks. */
function faseADiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Fase A' });
  diagram.nodes = {
    sub: createNode({
      type: 'subProcess',
      id: 'sub',
      label: 'Fulfil order',
      x: 100,
      y: 100,
      width: 320,
      height: 160,
      properties: { isExpanded: true },
    }),
    childA: createNode({
      type: 'task',
      id: 'childA',
      label: 'Pick',
      x: 120,
      y: 150,
      properties: { parentId: 'sub' },
    }),
    decide: createNode({
      type: 'businessRuleTask',
      id: 'decide',
      label: 'Score risk',
      x: 520,
      y: 100,
      properties: { decisionRef: 'decision-risk' },
    }),
    call: createNode({
      type: 'callActivity',
      id: 'call',
      label: 'Charge',
      x: 520,
      y: 220,
      properties: { calledElement: 'billing' },
    }),
  };
  return diagram;
}

describe('businessRuleTask decision-link badge (F-A)', () => {
  it('renders the gold badge with a tooltip and NO click handler until F-B2', () => {
    const { container } = render(<BpmnDesigner diagram={faseADiagram()} />);
    const badge = container.querySelector('[data-decision-link]')!;
    expect(badge).toBeInTheDocument();
    expect(badge.querySelector('title')?.textContent).toBe('Decisão vinculada: decision-risk');
    // No dead click: default cursor, no interactive role/handler.
    expect((badge as SVGGElement).style.cursor).toBe('default');
    expect(badge.getAttribute('role')).toBeNull();
  });

  it('renders the expanded sub-process title strip with the type tag', () => {
    const { container } = render(<BpmnDesigner diagram={faseADiagram()} />);
    const strip = container.querySelector('[data-node-id="sub"] [data-subprocess-title]')!;
    expect(strip).toBeInTheDocument();
    expect(strip.textContent).toContain('Fulfil order');
    expect(strip.textContent).toContain('subProcess');
    expect(strip.querySelector('line')).toBeInTheDocument();
  });
});

describe('double-click gesture split (F-A, aprovado 08/07)', () => {
  it('drills on the title strip and edits the label on the body', () => {
    const { container } = render(
      <BpmnDesigner diagram={faseADiagram()}>
        <Toolbar />
      </BpmnDesigner>,
    );
    const sub = container.querySelector('[data-node-id="sub"]')!;
    // jsdom: screenToWorld falls back to client coordinates = world coords.
    // Title strip: y within 30px of the container top (node at y=100).
    fireEvent.doubleClick(sub, { clientX: 200, clientY: 115 });
    expect(container.querySelector('[data-node-id="childA"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-id="sub"]')).not.toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Sub-process navigation' }),
    ).toHaveTextContent('Fulfil order');

    // Back up, then double-click the BODY: inline label editor, no drill.
    fireEvent.click(screen.getByRole('button', { name: 'Back to process' }));
    const subAgain = container.querySelector('[data-node-id="sub"]')!;
    fireEvent.doubleClick(subAgain, { clientX: 200, clientY: 180 });
    expect(container.querySelector('[data-node-id="sub"]')).toBeInTheDocument();
    expect(container.querySelector('input, textarea')).toBeInTheDocument();
  });

  it('keeps the selection when navigating UP through the breadcrumb (aceite 10.5.3)', () => {
    const { container } = render(
      <BpmnDesigner diagram={faseADiagram()}>
        <Toolbar />
      </BpmnDesigner>,
    );
    const sub = container.querySelector('[data-node-id="sub"]')!;
    fireEvent.doubleClick(sub, { clientX: 200, clientY: 110 });
    // Select the child inside the drill view.
    fireEvent.pointerDown(container.querySelector('[data-node-id="childA"]')!, { button: 0 });
    fireEvent.pointerUp(container.querySelector('svg.bpmnr-canvas')!, { button: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Back to process' }));
    // Selection survived the upward navigation.
    expect(container.querySelector('[data-node-id="childA"][data-selected]')).toBeInTheDocument();
  });
});

describe('GovernanceBreadcrumb (F-A §10.3)', () => {
  it('shows semver + vigência seal per level in the toolbar trail', () => {
    const diagram = faseADiagram();
    diagram.version.semanticVersion = '2.3.0';
    diagram.version.status = 'candidate';
    const { container } = render(
      <BpmnDesigner diagram={diagram} messages={PT_BR}>
        <Toolbar />
      </BpmnDesigner>,
    );
    fireEvent.doubleClick(container.querySelector('[data-node-id="sub"]')!, {
      clientX: 200,
      clientY: 110,
    });
    const nav = screen.getByRole('navigation', { name: 'Navegação de subprocessos' });
    // Both levels (root + sub-process) carry the identity.
    expect(nav.querySelectorAll('.bpmnr-breadcrumb-semver')).toHaveLength(2);
    expect(nav.querySelectorAll('.bpmnr-breadcrumb-seal[data-status="candidate"]')).toHaveLength(2);
    expect(nav).toHaveTextContent('v2.3.0');
    expect(nav).toHaveTextContent('CANDIDATA');
  });

  it('is one shared component: renders standalone with arbitrary levels', () => {
    const onNavigate = vi_fn();
    render(
      <I18nProvider messages={PT_BR}>
        <GovernanceBreadcrumb
          levels={[
            { id: null, label: 'Fluxo', semanticVersion: '1.0.0', status: 'active' },
            { id: 'table-1', label: 'Tabela de decisão', semanticVersion: '0.2.0', status: 'draft' },
          ]}
          onNavigate={onNavigate.fn}
        />
      </I18nProvider>,
    );
    const nav = screen.getByRole('navigation', { name: 'Trilha de governança' });
    expect(nav).toHaveTextContent('ATIVA');
    expect(nav).toHaveTextContent('RASCUNHO');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao processo' }));
    expect(onNavigate.calls).toEqual([[null, 0]]);
  });
});

/** Minimal spy (avoids importing vi just for one callback). */
function vi_fn() {
  const calls: unknown[][] = [];
  return { calls, fn: (...args: unknown[]) => calls.push(args) };
}

describe('CALL_REF_MISSING visual state (F-A §3.2)', () => {
  const brokenRefRule: ValidationRule = (diagram) =>
    Object.values(diagram.nodes)
      .filter((n) => n.type === 'callActivity')
      .map((n) => ({
        code: 'CALL_REF_MISSING',
        severity: 'error' as const,
        message: `unresolved: ${n.id}`,
        nodeId: n.id,
      }));

  it('marks the node with the error state, badge and the stable code', () => {
    const { container } = render(
      <BpmnDesigner
        diagram={faseADiagram()}
        plugins={[{ id: 'refs', validationRules: [brokenRefRule] }]}
      >
        <Toolbar />
      </BpmnDesigner>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Validate diagram' }));
    const node = container.querySelector('[data-node-id="call"]')!;
    expect(node.getAttribute('data-node-issue-state')).toBe('error');
    expect(node.querySelector('[data-node-issue="error"]')).toBeInTheDocument();
    expect(node.querySelector('[data-node-issue-code]')?.textContent).toBe('CALL_REF_MISSING');
  });

  it('shows the resolved binding footer when the host provides it', () => {
    const diagram = faseADiagram();
    diagram.nodes.call.properties.calledElementLabel = 'Billing@4.2.0';
    const { container } = render(<BpmnDesigner diagram={diagram} />);
    expect(container.querySelector('[data-node-id="call"]')?.textContent).toContain(
      '→ Billing@4.2.0',
    );
  });
});
