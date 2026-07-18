import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  createDiagram,
  createEdge,
  createNode,
  LifecycleEngine,
  type BpmnDiagram,
} from '@buildtovalue/core';
import {
  BpmnDiffViewer,
  createInMemoryReviewStore,
  reviewThreadsRule,
  PT_BR,
} from '../src/index.js';

/**
 * Handoff 15 V-5 — o painel de review (§2d) do lado react: pilha de Esc
 * única (a dívida das V-2/3/4 fecha aqui), abas Threads/Mudanças, banner de
 * gate com "ver no canvas", dispensa justificada e o reviewThreadsRule no
 * molde exato do soundnessPromotionRule.
 */

function baseDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Gate', id: 'gate' });
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Início', x: 40, y: 100 }),
    limit: createNode({ id: 'limit', type: 'serviceTask', label: 'Validar limite', x: 200, y: 100, properties: { retries: 2 } }),
    fax: createNode({ id: 'fax', type: 'sendTask', label: 'Notificar fax', x: 700, y: 400 }),
    end: createNode({ id: 'end', type: 'endEvent', label: 'Fim', x: 600, y: 100 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'limit' }),
    e2: createEdge({ id: 'e2', sourceId: 'limit', targetId: 'fax' }),
    e3: createEdge({ id: 'e3', sourceId: 'limit', targetId: 'end' }),
  };
  return diagram;
}

function targetDiagram(): BpmnDiagram {
  const diagram = baseDiagram();
  const nodes = { ...diagram.nodes };
  nodes.limit = { ...nodes.limit, properties: { retries: 4 } };
  const { fax: _fax, ...withoutFax } = nodes;
  const { e2: _e2, ...edges } = { ...diagram.edges };
  return { ...diagram, nodes: withoutFax, edges };
}

const renderEmbed = (store = createInMemoryReviewStore('v-1.3'), onClose?: () => void) => {
  const utils = render(
    <BpmnDiffViewer
      base={baseDiagram()}
      target={targetDiagram()}
      messages={PT_BR}
      reviewStore={store}
      threadsTab
      author="ana.ruiz"
      onClose={onClose}
    />,
  );
  return { ...utils, store };
};

describe('review panel embed (spec 2d — react side)', () => {
  it('Esc pela pilha ÚNICA na ordem completa: thread → ΔN → modo diff', () => {
    const onClose = vi.fn();
    const { container, store } = renderEmbed(createInMemoryReviewStore('v-1.3'), onClose);
    act(() => {
      store.open('limit', { author: 'ana.ruiz', text: 'SLA?' });
    });
    // Abre ΔN popover, DEPOIS thread popover (topo da pilha).
    fireEvent.click(container.querySelector('[data-diff-badge="limit"]')!);
    fireEvent.click(container.querySelector('[data-review-pin="limit"]')!);
    expect(screen.getByTestId('review-thread')).toBeInTheDocument();
    expect(screen.getByTestId('diff-popover')).toBeInTheDocument();
    // Esc 1 → thread (topo). Esc 2 → ΔN. Esc 3 → modo diff (onClose).
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('review-thread')).toBeNull();
    expect(screen.getByTestId('diff-popover')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('diff-popover')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('abas Threads/Mudanças sincronizadas: contadores consistentes, clique navega', () => {
    const store = createInMemoryReviewStore('v-1.3');
    store.open('limit', { author: 'ana.ruiz', text: 'SLA?' });
    const { container } = renderEmbed(store);
    const tabs = container.querySelector('.bpmnr-diff-side-tabs')!;
    expect(tabs.querySelector('[data-review-tab="threads"]')!.textContent).toContain('Threads (1)');
    // Mudanças (M) = o mesmo M do contador da barra (ordem da V-1).
    const changesTab = tabs.querySelector('[data-review-tab="changes"]')!;
    const counter = screen.getByTestId('diff-nav-counter').textContent!;
    const total = Number(counter.match(/de (\d+)/)![1]);
    expect(changesTab.textContent).toContain(`Mudanças (${total})`);
    // A aba Mudanças É a lista da V-3 (mesma fonte topológica).
    expect(screen.getByTestId('diff-list')).toBeInTheDocument();
    // Troca para Threads e navega pela linha (reduced-motion p/ asserção).
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      fireEvent.click(tabs.querySelector('[data-review-tab="threads"]')!);
      const row = screen.getByTestId('review-threads-list').querySelector('[data-review-thread-item]')!;
      expect(row.getAttribute('data-review-thread-state')).toBe('open');
      fireEvent.click(row.querySelector('.bpmnr-diff-list-row')!);
      // limit em 200,100 (120×60 → centro 260,130) → viewport -340,-270.
      const [x, y] = container
        .querySelector('svg.bpmnr-canvas')!
        .getAttribute('viewBox')!
        .split(' ')
        .map(Number);
      expect(Math.abs(x - -340)).toBeLessThan(1);
      expect(Math.abs(y - -270)).toBeLessThan(1);
      // O popover da thread abriu junto.
      expect(screen.getByTestId('review-thread')).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it('banner ⚑ com contagem e "ver no canvas"; some quando o gate libera', () => {
    const store = createInMemoryReviewStore('v-1.3');
    const thread = store.open('limit', { author: 'ana.ruiz', text: 'SLA?' });
    store.open('fax', { author: 'ana.ruiz', text: 'Órfã — não conta.' }); // órfã no alvo
    renderEmbed(store);
    const banner = screen.getByTestId('review-gate-banner');
    expect(banner.textContent).toContain('Aprovação bloqueada');
    expect(banner.textContent).toContain('1 thread aberta'); // órfã NÃO conta
    fireEvent.click(screen.getByTestId('review-gate-goto'));
    expect(screen.getByTestId('review-thread')).toBeInTheDocument();
    // Resolver libera o banner.
    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => {
      store.resolve(thread.id);
    });
    expect(screen.queryByTestId('review-gate-banner')).toBeNull();
  });

  it('dispensa: justificativa mínima obrigatória, store atualiza e o host audita', () => {
    const store = createInMemoryReviewStore('v-1.3');
    store.open('limit', { author: 'ana.ruiz', text: 'SLA?' });
    const onDismissThread = vi.fn();
    const { container } = render(
      <BpmnDiffViewer
        base={baseDiagram()}
        target={targetDiagram()}
        messages={PT_BR}
        reviewStore={store}
        threadsTab
        author="rev.carla"
        onDismissThread={onDismissThread}
      />,
    );
    fireEvent.click(container.querySelector('[data-review-tab="threads"]')!);
    fireEvent.click(screen.getByTestId('review-threads-list').querySelector('[data-review-dismiss-toggle]')!);
    const confirmBtn = () =>
      screen.getByTestId('review-threads-list').querySelector('[data-review-dismiss-confirm]')! as HTMLButtonElement;
    const textarea = screen
      .getByTestId('review-threads-list')
      .querySelector('[data-review-dismiss] textarea')!;
    // < 10 caracteres → botão desabilitado (nunca silenciosa).
    fireEvent.change(textarea, { target: { value: 'curta' } });
    expect(confirmBtn().disabled).toBe(true);
    fireEvent.change(textarea, { target: { value: 'risco aceito pelo comitê' } });
    expect(confirmBtn().disabled).toBe(false);
    fireEvent.click(confirmBtn());
    expect(store.list()[0].dismissed).toMatchObject({
      by: 'rev.carla',
      justification: 'risco aceito pelo comitê',
    });
    expect(onDismissThread).toHaveBeenCalledTimes(1);
    // Gate liberado: banner some; estado DISPENSADA na lista.
    expect(screen.queryByTestId('review-gate-banner')).toBeNull();
    expect(
      screen
        .getByTestId('review-threads-list')
        .querySelector('[data-review-thread-item]')!
        .getAttribute('data-review-thread-state'),
    ).toBe('dismissed');
  });
});

describe('reviewThreadsRule (molde soundnessPromotionRule)', () => {
  const promoteInput = (diagram: BpmnDiagram) => ({
    diagram,
    target: 'active' as const,
    actor: { id: 'ana', role: 'aprovadora' },
    reason: 'promover',
  });

  it('thread aberta bloqueia (erro); resolvida e dispensada liberam; órfã nunca bloqueia', () => {
    const store = createInMemoryReviewStore('v-1.3');
    const open = store.open('limit', { author: 'ana', text: 'SLA?' });
    store.open('fax', { author: 'ana', text: 'órfã' }); // fax não existe no alvo
    const rule = reviewThreadsRule(() => store.list());
    const diagram = targetDiagram();

    const blocked = rule(promoteInput(diagram));
    expect(blocked).toMatchObject({ allowed: false });
    expect((blocked as { reason?: string }).reason).toContain('1 thread');

    store.resolve(open.id);
    expect(rule(promoteInput(diagram))).toEqual({ allowed: true });

    const another = store.open('limit', { author: 'ana', text: 'de novo' });
    expect(rule(promoteInput(diagram))).toMatchObject({ allowed: false });
    store.dismiss!(another.id, 'ana', 'risco aceito pelo comitê');
    expect(rule(promoteInput(diagram))).toEqual({ allowed: true });
  });

  it('aparece como gate rule:N no evaluateGates e bloqueia promote()', async () => {
    const store = createInMemoryReviewStore('v-1.3');
    store.open('limit', { author: 'ana', text: 'SLA?' });
    const engine = new LifecycleEngine({
      minApprovalRoles: 0,
      minChangeSummaryLength: 0,
      promotionRules: [reviewThreadsRule(() => store.list())],
    });
    const diagram = targetDiagram();
    diagram.version = { ...diagram.version, status: 'candidate', changeSummary: 'x' };
    const gates = await engine.evaluateGates({
      diagram,
      target: 'active',
      actor: { id: 'ana', role: 'aprovadora' },
      reason: 'promover',
    });
    const ruleGate = gates.find((gate) => gate.id.startsWith('rule:'))!;
    expect(ruleGate.satisfied).toBe(false);
    expect(ruleGate.detail).toContain('thread');
  });

  it('dispensa curta é rejeitada pelo store de referência', () => {
    const store = createInMemoryReviewStore('v-1.3');
    const thread = store.open('limit', { author: 'ana', text: 'SLA?' });
    expect(() => store.dismiss!(thread.id, 'ana', 'curta')).toThrow(/10/);
  });
});
