import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { BpmnSimulator } from '../src/simulation/BpmnSimulator.js';
import { edgeGeometryFor, nodeCenter } from '../src/simulation/edgePath.js';

/** The three-path prototype fixture (happy / rejection / timeout). */
function threePaths(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Sim' });
  const node = (id: string, type: string, x: number, y: number) => {
    diagram.nodes[id] = createNode({ id, type, label: id, x, y });
  };
  node('s', 'startEvent', 0, 100);
  node('prod', 'task', 100, 90);
  node('x', 'exclusiveGateway', 260, 95);
  node('ship', 'task', 380, 40);
  node('fix', 'task', 380, 150);
  node('timer', 'boundaryEvent', 150, 140);
  node('done', 'endEvent', 540, 45);
  node('rejected', 'endEvent', 540, 155);
  node('timedout', 'endEvent', 200, 240);
  diagram.nodes.timer.properties.attachedToRef = 'prod';
  diagram.nodes.timer.label = '48h';
  const edges: [string, string, string?][] = [
    ['s', 'prod'],
    ['prod', 'x'],
    ['x', 'ship', 'approve'],
    ['x', 'fix', 'reject'],
    ['ship', 'done'],
    ['fix', 'rejected'],
    ['timer', 'timedout'],
  ];
  edges.forEach(([source, target, label], index) => {
    diagram.edges[`e${index}`] = createEdge({ id: `e${index}`, sourceId: source, targetId: target, ...(label ? { label } : {}) });
  });
  return diagram;
}

const coverageText = (c: HTMLElement) =>
  c.querySelector('[data-sim-panel] .bpmnr-sim-card-title')?.textContent ?? '';

function advanceUntilChoiceOrDone(container: HTMLElement) {
  for (let i = 0; i < 10; i++) {
    const btn = container.querySelector<HTMLButtonElement>('[data-sim-advance]');
    if (!btn || btn.disabled) break;
    fireEvent.click(btn);
  }
}

describe('BpmnSimulator', () => {
  it('renders the mode pill, panel and 3-path coverage checklist', () => {
    const { container } = render(<BpmnSimulator diagram={threePaths()} />);
    expect(container.querySelector('[data-sim-pill]')?.textContent).toContain('MODO SIMULAÇÃO');
    expect(container.querySelector('[data-sim-panel]')).toBeInTheDocument();
    expect(coverageText(container)).toContain('0/3');
    expect(container.querySelectorAll('[data-sim-coverage] li')).toHaveLength(3);
    cleanup();
  });

  it('closes 3/3 across the happy, rejection and timeout sessions', () => {
    const { container } = render(<BpmnSimulator diagram={threePaths()} />);

    // Happy path — advance to the gate, choose approve, finish.
    advanceUntilChoiceOrDone(container);
    const approve = container.querySelector<HTMLButtonElement>('[data-sim-choice-option="e2"]');
    expect(approve).toBeTruthy();
    // Touch target ≥44px (§8).
    expect(approve!.style.minHeight).toBe('44px');
    fireEvent.click(approve!);
    advanceUntilChoiceOrDone(container);
    expect(coverageText(container)).toContain('1/3');

    // Rejection path.
    fireEvent.click(container.querySelector('[data-sim-reset]')!);
    advanceUntilChoiceOrDone(container);
    fireEvent.click(container.querySelector('[data-sim-choice-option="e3"]')!);
    advanceUntilChoiceOrDone(container);
    expect(coverageText(container)).toContain('2/3');

    // Timeout path — fire the boundary while the token rests on its host.
    fireEvent.click(container.querySelector('[data-sim-reset]')!);
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // s → prod
    const boundary = container.querySelector<HTMLButtonElement>('[data-sim-boundary="timer"]');
    expect(boundary).toBeTruthy();
    fireEvent.click(boundary!);
    advanceUntilChoiceOrDone(container);

    expect(coverageText(container)).toContain('3/3');
    expect(container.querySelectorAll('[data-sim-coverage] li[data-covered]')).toHaveLength(3);
    cleanup();
  });

  it('paints exercised edges and the active-node highlight in the overlay', () => {
    const { container } = render(<BpmnSimulator diagram={threePaths()} />);
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // s → prod
    expect(container.querySelector('[data-sim-exercised-edge="e0"]')).toBeTruthy();
    expect(container.querySelector('[data-sim-active-node="prod"]')).toBeTruthy();
    cleanup();
  });

  it('builds a session and hands it to onRecord, then shows the SACM confirmation', async () => {
    const onRecord = vi.fn();
    const { container } = render(<BpmnSimulator diagram={threePaths()} author="ana" onRecord={onRecord} />);

    // Close the happy path so coverage > 0 and the record button appears.
    advanceUntilChoiceOrDone(container);
    fireEvent.click(container.querySelector('[data-sim-choice-option="e2"]')!);
    advanceUntilChoiceOrDone(container);

    const record = container.querySelector<HTMLButtonElement>('[data-sim-record]');
    expect(record).toBeTruthy();
    fireEvent.click(record!);

    await waitFor(() => expect(onRecord).toHaveBeenCalledTimes(1));
    const session = onRecord.mock.calls[0][0];
    expect(session).toMatchObject({
      author: 'ana',
      coverage: { covered: 1, total: 3 },
    });
    expect(session.scenarioHash).toMatch(/^[0-9a-f]{12}$/);
    expect(session.scenario.decisions).toEqual([{ kind: 'exclusive', gateway: 'x', edge: 'e2' }]);

    // Default confirmation surfaces the roteiro hash and the SACM evidence line.
    await waitFor(() =>
      expect(container.querySelector('[data-sim-recorded]')).toHaveTextContent('Sessão registrada'),
    );
    expect(container.querySelector('[data-sim-recorded]')).toHaveTextContent('1/3 caminhos exercitados');
    expect(container.querySelector('[data-sim-record]')).toBeNull(); // button hides after recording
    cleanup();
  });

  it('defaults to step mode when the user prefers reduced motion', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal('matchMedia', matchMedia);
    const { container } = render(<BpmnSimulator diagram={threePaths()} />);
    const checkbox = container.querySelector<HTMLInputElement>('[data-sim-stepmode]');
    expect(checkbox?.checked).toBe(true);
    vi.unstubAllGlobals();
    cleanup();
  });
});

/** threePaths + um event subprocess elegível com start `kind` (ES-5 §4e). */
function withEsub(
  kind: string,
  opts: { ref?: string; interrupting?: boolean } = {},
): BpmnDiagram {
  const diagram = threePaths();
  diagram.nodes.esub = createNode({
    id: 'esub',
    type: 'subProcess',
    label: 'Plantão',
    x: 100,
    y: 300,
    properties: { triggeredByEvent: true },
  });
  diagram.nodes.est = createNode({
    id: 'est',
    type: 'startEvent',
    label: 'est',
    x: 120,
    y: 340,
    properties: {
      parentId: 'esub',
      eventDefinition: kind,
      ...(opts.ref ? { eventDefinitionRef: opts.ref } : {}),
      ...(opts.interrupting === false ? { isInterrupting: false } : {}),
    },
  });
  if (opts.ref) {
    diagram.definitions = { messages: [], signals: [], errors: [{ id: opts.ref, name: 'Falha X' }] };
  }
  return diagram;
}

describe('event subprocess na simulação (ES-5 §4e)', () => {
  it('card manual do timer mostra o MODO (glifo+texto) e o fire nomeia a interrupção na trilha', () => {
    const { container } = render(<BpmnSimulator diagram={withEsub('timer')} />);
    const card = container.querySelector('[data-sim-esub-card="esub"]')!;
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('Event subprocess “Plantão”');
    // Reforço 10: modo declarado ANTES do disparo — glifo + texto.
    const mode = card.querySelector('[data-sim-esub-mode="interrupting"]')!;
    expect(mode.textContent).toContain('⛔');
    expect(mode.textContent).toContain('interrupting — cancels the tokens of this scope');
    fireEvent.click(container.querySelector('[data-sim-esub-fire="esub"]')!);
    const trail = container.querySelector('[data-sim-trail]')!.textContent!;
    expect(trail).toContain('manually fired (start est, timer never auto-fires in simulation, interrupting)');
    expect(trail).toContain('token(s) cancelled in scope');
    cleanup();
  });

  it('variante não-interrupting declara o modo paralelo no card', () => {
    const { container } = render(
      <BpmnSimulator diagram={withEsub('conditional', { interrupting: false })} />,
    );
    const mode = container.querySelector('[data-sim-esub-mode="non-interrupting"]')!;
    expect(mode.textContent).toContain('⇉');
    expect(mode.textContent).toContain('non-interrupting — the scope continues in parallel');
    cleanup();
  });

  it('card de lançar erro existe SEM boundary (esub de erro no escopo) e o throw nomeia a captura', () => {
    const { container } = render(<BpmnSimulator diagram={withEsub('error', { ref: 'err-x' })} />);
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // s → prod
    const card = container.querySelector('[data-sim-throw-card="prod"]')!;
    expect(card).toBeTruthy();
    fireEvent.click(card.querySelector('[data-sim-throw-error="err-x"]')!);
    const trail = container.querySelector('[data-sim-trail]')!.textContent!;
    expect(trail).toContain(
      'caught by event subprocess "Plantão" (start est, errorRef "err-x", interrupting)',
    );
    expect(trail).toContain('token(s) cancelled in scope');
    // Token no CONTÊINER (decisão 1): o overlay destaca a casca.
    expect(container.querySelector('[data-sim-active-node="esub"]')).toBeTruthy();
    cleanup();
  });
});

/** threePaths + uma boundary de escalação no host `prod` (Handoff 18 §5e). */
function withEscalationBoundary(opts: { interrupting?: boolean } = {}): BpmnDiagram {
  const diagram = threePaths();
  diagram.nodes.escb = createNode({
    id: 'escb',
    type: 'boundaryEvent',
    label: 'Alçada',
    x: 150,
    y: 40,
    properties: {
      attachedToRef: 'prod',
      eventDefinition: 'escalation',
      eventDefinitionRef: 'esc-1',
      ...(opts.interrupting === false ? { cancelActivity: false } : {}),
    },
  });
  diagram.nodes.rev = createNode({ id: 'rev', type: 'task', label: 'Revisar', x: 300, y: 20 });
  diagram.edges.esce = createEdge({ id: 'esce', sourceId: 'escb', targetId: 'rev' });
  diagram.definitions = {
    messages: [],
    signals: [],
    errors: [],
    escalations: [{ id: 'esc-1', name: 'Acima da alçada', escalationCode: 'OVER' }],
  };
  return diagram;
}

describe('escalação na simulação (Handoff 18 §5e)', () => {
  it('o card «Escalar» mostra o DESTINO PREVISTO por opção (glifo+texto, reforço 7)', () => {
    const { container } = render(
      <BpmnSimulator diagram={withEscalationBoundary({ interrupting: false })} />,
    );
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // s → prod
    const card = container.querySelector('[data-sim-escalate-card="prod"]')!;
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('Escalate on “prod”');
    // A opção catalogada prevê o boundary não-interrupting: glifo ↟ + texto.
    const opt = card.querySelector('[data-sim-throw-escalation="esc-1"]')!;
    expect(opt.getAttribute('data-sim-escalation-dest')).toBe('boundary');
    const dest = opt.querySelector('[data-sim-escalation-dest-text]')!;
    expect(dest.textContent).toContain('→ boundary “Alçada”');
    expect(dest.textContent).toContain('↟ non-interrupting');
    // A não catalogada prevê a dissolução (declarada ANTES do disparo).
    const uncat = card.querySelector('[data-sim-throw-escalation=""]')!;
    expect(uncat.getAttribute('data-sim-escalation-dest')).toBe('dissolve');
    cleanup();
  });

  it('disparar a escalação NI faz o host SEGUIR e um token PARALELO re-emergir no catch', () => {
    const { container } = render(
      <BpmnSimulator diagram={withEscalationBoundary({ interrupting: false })} />,
    );
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // s → prod
    const card = container.querySelector('[data-sim-escalate-card="prod"]')!;
    fireEvent.click(card.querySelector('[data-sim-throw-escalation="esc-1"]')!);
    const trail = container.querySelector('[data-sim-trail]')!.textContent!;
    expect(trail).toContain('caught by boundary "Alçada" (non-interrupting — host continues + parallel token)');
    // Dois tokens visíveis: o host e o catch.
    expect(container.querySelector('[data-sim-active-node="prod"]')).toBeTruthy();
    expect(container.querySelector('[data-sim-active-node="escb"]')).toBeTruthy();
    cleanup();
  });

  it('escalação SEM catch dissolve (no-op declarado) — a trilha nomeia, o host segue', () => {
    const diagram = threePaths();
    diagram.nodes.esci = createNode({
      id: 'esci',
      type: 'intermediateThrowEvent',
      label: 'Subir',
      x: 150,
      y: 40,
      properties: { eventDefinition: 'escalation' },
    });
    // Sem boundary/esub de escalação: o card não aparece (nada catalogado),
    // mas o motor dissolve por API se disparado — cobrimos o motor no pacote
    // simulation; aqui garantimos que o card SÓ existe quando há catch elegível.
    const { container } = render(<BpmnSimulator diagram={diagram} />);
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // s → prod
    expect(container.querySelector('[data-sim-escalate-card="prod"]')).toBeNull();
    cleanup();
  });
});

/** s → a1 → a2 → end, cada atividade compensável (⟲ boundary + handler). */
function compFlow(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Comp', id: 'comp' });
  const n = (id: string, type: string, x: number, y: number, props: Record<string, unknown> = {}) => {
    diagram.nodes[id] = createNode({ id, type, label: id, x, y, properties: props });
  };
  n('s', 'startEvent', 0, 100);
  n('a1', 'serviceTask', 100, 90);
  n('a2', 'serviceTask', 260, 90);
  n('e', 'endEvent', 420, 100);
  n('b_a1', 'boundaryEvent', 120, 130, { attachedToRef: 'a1', eventDefinition: 'compensate' });
  n('h_a1', 'serviceTask', 100, 220, { isForCompensation: true });
  diagram.nodes.h_a1.label = 'Estornar A1';
  const e = (id: string, s: string, t: string, type?: string) => {
    diagram.edges[id] = createEdge({ id, sourceId: s, targetId: t, ...(type ? { type } : {}) });
  };
  e('e1', 's', 'a1');
  e('e2', 'a1', 'a2');
  e('e3', 'a2', 'e');
  e('a_a1', 'b_a1', 'h_a1', 'association');
  return diagram;
}

describe('compensação na simulação (Handoff 19 §6d)', () => {
  it('o card «Compensar» mostra broadcast com a CONTAGEM + a específica; incompleta não aparece', () => {
    const { container } = render(<BpmnSimulator diagram={compFlow()} />);
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // s → a1
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // a1 → a2 (a1 completou)
    const card = container.querySelector('[data-sim-compensate-card]')!;
    expect(card).toBeTruthy();
    // Broadcast mostra a contagem (1 handler completado: a1).
    const broadcast = card.querySelector('[data-sim-compensate=""]')!;
    expect(broadcast.getAttribute('data-sim-compensate-dest')).toBe('broadcast');
    expect(broadcast.textContent).toContain('1 handler');
    // A específica de a1 é elegível (completou).
    const a1 = card.querySelector('[data-sim-compensate="a1"]')!;
    expect(a1.getAttribute('data-sim-compensate-dest')).toBe('activity');
    expect(a1.textContent).toContain('Estornar A1');
    cleanup();
  });

  it('disparar broadcast reverte na trilha e coloca token no handler', () => {
    const { container } = render(<BpmnSimulator diagram={compFlow()} />);
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // s → a1
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // a1 → a2
    fireEvent.click(container.querySelector('[data-sim-compensate-card] [data-sim-compensate=""]')!);
    const trail = container.querySelector('[data-sim-trail]')!.textContent!;
    expect(trail).toContain('Compensate "a1" → handler "Estornar A1"');
    expect(container.querySelector('[data-sim-active-node="h_a1"]')).toBeTruthy();
    cleanup();
  });

  it('nada completado → broadcast desabilitado (contagem 0)', () => {
    const { container } = render(<BpmnSimulator diagram={compFlow()} />);
    fireEvent.click(container.querySelector('[data-sim-advance]')!); // s → a1 (nada completou)
    const broadcast = container.querySelector('[data-sim-compensate-card] [data-sim-compensate=""]') as HTMLButtonElement;
    expect(broadcast.textContent).toContain('0 handlers');
    // A específica a1 (ainda não completou) fica não-elegível/desabilitada.
    const a1 = container.querySelector('[data-sim-compensate="a1"]') as HTMLButtonElement;
    expect(a1.getAttribute('data-sim-compensate-dest')).toBe('notEligible');
    expect(a1.disabled).toBe(true);
    cleanup();
  });
});

describe('edgeGeometryFor', () => {
  it('rounds explicit waypoints and computes a node center', () => {
    const diagram = threePaths();
    const edge = createEdge({
      id: 'w',
      sourceId: 's',
      targetId: 'prod',
      waypoints: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 40 },
      ],
    });
    const geometry = edgeGeometryFor(edge, diagram.nodes.s, diagram.nodes.prod, () => {
      throw new Error('router should not be called when waypoints exist');
    });
    expect(geometry?.path).toContain('M 0 0');
    expect(geometry?.path).toContain('Q');
    expect(nodeCenter(diagram.nodes.prod)).toEqual({ x: 160, y: 120 });
  });

  it('falls back to the edge router without waypoints', () => {
    const diagram = threePaths();
    const router = vi.fn().mockReturnValue({ path: 'M 0 0', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, midpoint: { x: 0.5, y: 0.5 } });
    const geometry = edgeGeometryFor(diagram.edges.e0, diagram.nodes.s, diagram.nodes.prod, router);
    expect(router).toHaveBeenCalledOnce();
    expect(geometry?.path).toBe('M 0 0');
  });

  it('returns null when an endpoint is missing', () => {
    const diagram = threePaths();
    expect(edgeGeometryFor(diagram.edges.e0, undefined, diagram.nodes.prod, () => {
      throw new Error('unused');
    })).toBeNull();
  });
});
