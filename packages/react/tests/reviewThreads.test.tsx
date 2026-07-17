import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  BpmnXmlConverter,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import {
  BpmnDiffViewer,
  createInMemoryReviewStore,
  PT_BR,
  svgToString,
  type BpmnPlugin,
} from '../src/index.js';

/**
 * Handoff 15 V-4 — comentários ancorados (§2c). Réguas: degradação declarada
 * sem ReviewStore (§1.5); XML byte-idêntico com threads abertas (§1.2 — o
 * teste central); pins gold por elementId (contagem, glifo+número); abrir/
 * responder/resolver com eventos N-3; selo ✦ para ia.copilot@; órfãs nunca
 * somem, com última âncora navegável; export mid-thread limpo.
 */

function baseDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Threads', id: 'threads' });
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Início', x: 40, y: 100 }),
    limit: createNode({ id: 'limit', type: 'serviceTask', label: 'Validar limite', x: 200, y: 100 }),
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
  const { fax: _fax, ...nodes } = { ...diagram.nodes };
  const { e2: _e2, ...edges } = { ...diagram.edges };
  return { ...diagram, nodes, edges };
}

function seededStore() {
  const store = createInMemoryReviewStore('v-1.3');
  const t1 = store.open('limit', { author: 'ana.ruiz', text: 'Retries 4 não estoura o SLA?' });
  store.reply(t1.id, { author: 'ia.copilot@claude', text: 'Timeout de 30s cobre.' });
  const orphanThread = store.open('fax', { author: 'ana.ruiz', text: 'Fax ainda é usado?' });
  return { store, t1, orphanThread };
}

describe('review threads (spec 2c)', () => {
  it('§1.5 degradação declarada: sem ReviewStore a superfície NÃO existe', () => {
    const { container } = render(
      <BpmnDiffViewer base={baseDiagram()} target={targetDiagram()} messages={PT_BR} />,
    );
    expect(container.querySelector('[data-review-pins]')).toBeNull();
    expect(container.querySelector('[data-review-pin]')).toBeNull();
    expect(screen.queryByTestId('review-orphans')).toBeNull();
    // O diff continua inteiro.
    expect(screen.getByTestId('diff-nav')).toBeInTheDocument();
  });

  it('pin gold ancorado por elementId com glifo+contagem; segue o elemento', () => {
    const { store } = seededStore();
    const { container } = render(
      <BpmnDiffViewer
        base={baseDiagram()}
        target={targetDiagram()}
        messages={PT_BR}
        reviewStore={store}
      />,
    );
    const pin = container.querySelector('[data-review-pin="limit"]')!;
    expect(pin.getAttribute('data-review-pin-state')).toBe('open');
    // Glifo+número, nunca só cor: 💬 + contagem de mensagens (2).
    expect(pin.querySelector('.bpmnr-review-pin-text')!.textContent).toBe('💬2');
    // Âncora por id: o pin lê a geometria ATUAL do nó (borda direita superior).
    const face = pin.querySelector('.bpmnr-review-pin-face')!;
    expect(face.getAttribute('cx')).toBe('320'); // limit.x 200 + width 120
    expect(face.getAttribute('cy')).toBe('100');
    // Hit generoso: r=22 → diâmetro 44.
    expect(pin.querySelector('.bpmnr-review-pin-hit')!.getAttribute('r')).toBe('22');
  });

  it('abrir → responder → resolver, com eventos N-3 e selo ✦ para ia.copilot@', () => {
    const events: Array<{ type: string; meta?: unknown }> = [];
    const spy: BpmnPlugin = {
      id: 'spy',
      onEditorEvent: (event) => events.push({ type: event.type, meta: event.meta }),
    };
    const store = createInMemoryReviewStore('v-1.3');
    const { container } = render(
      <BpmnDiffViewer
        base={baseDiagram()}
        target={targetDiagram()}
        messages={PT_BR}
        reviewStore={store}
        author="bruno.lima"
        plugins={[spy]}
      />,
    );
    // Abrir: dblclick no elemento → composer → Comentar.
    fireEvent.doubleClick(container.querySelector('[data-review-hit="limit"]')!);
    const popover = screen.getByTestId('review-thread');
    fireEvent.change(popover.querySelector('textarea')!, {
      target: { value: 'SLA do gate de crédito?' },
    });
    fireEvent.click(screen.getByTestId('review-send'));
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0].messages[0]).toMatchObject({
      author: 'bruno.lima',
      text: 'SLA do gate de crédito?',
    });
    const opened = events.find((e) => e.type === 'review.thread.opened');
    expect(opened?.meta).toMatchObject({ elementId: 'limit', threadId: store.list()[0].id });

    // Responder como copiloto (via store — o selo ✦ vem da autoria).
    act(() => {
      store.reply(store.list()[0].id, { author: 'ia.copilot@claude', text: 'Cobre com folga.' });
    });
    expect(screen.getByTestId('review-thread').querySelector('[data-review-ai]')).not.toBeNull();

    // Resolver → evento + pin vira ✓ vazado.
    fireEvent.click(
      screen.getByTestId('review-thread').querySelector('[data-review-resolve]')!,
    );
    expect(store.list()[0].resolved).toBe(true);
    expect(events.some((e) => e.type === 'review.thread.resolved')).toBe(true);
    expect(
      container.querySelector('[data-review-pin="limit"]')!.getAttribute('data-review-pin-state'),
    ).toBe('resolved');
    expect(
      container.querySelector('[data-review-pin="limit"] .bpmnr-review-pin-text')!.textContent,
    ).toBe('✓');
    expect(screen.getByTestId('review-resolved').textContent).toContain('Resolvida');
  });

  it('órfãs: elemento removido → aviso listado, nunca some, navegável ao fantasma', () => {
    const { store } = seededStore();
    const { container } = render(
      <BpmnDiffViewer
        base={baseDiagram()}
        target={targetDiagram()}
        messages={PT_BR}
        reviewStore={store}
      />,
    );
    // fax saiu do alvo → pin ausente, mas a thread NUNCA é apagada.
    expect(container.querySelector('[data-review-pin="fax"]')).toBeNull();
    expect(store.list().some((thread) => thread.elementId === 'fax')).toBe(true);
    const notice = screen.getByTestId('review-orphans');
    expect(notice.textContent).toContain('1 thread órfã');
    expect(notice.textContent).toContain('Notificar fax');
    // Navegável: clique → pan até a última âncora conhecida (v-base 700,400 →
    // centro 760,430 → viewport 160,30). reduced-motion p/ asserção direta.
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
      fireEvent.click(notice.querySelector('[data-review-orphan]')!);
      const [x, y] = container
        .querySelector('svg.bpmnr-canvas')!
        .getAttribute('viewBox')!
        .split(' ')
        .map(Number);
      expect(Math.abs(x - 160)).toBeLessThan(1);
      expect(Math.abs(y - 30)).toBeLessThan(1);
    } finally {
      window.matchMedia = original;
    }
  });

  it('§1.2 CENTRAL: XML round-trip byte-idêntico com threads abertas', () => {
    const converter = new BpmnXmlConverter();
    const target = targetDiagram();
    const before = converter.toXml(target);
    const { store } = seededStore();
    const { container } = render(
      <BpmnDiffViewer base={baseDiagram()} target={target} reviewStore={store} messages={PT_BR} />,
    );
    // Interage com TODA a superfície de review…
    fireEvent.click(container.querySelector('[data-review-pin="limit"]')!);
    const popover = screen.getByTestId('review-thread');
    fireEvent.change(popover.querySelector('textarea')!, { target: { value: 'mais um' } });
    fireEvent.click(screen.getByTestId('review-send'));
    fireEvent.click(popover.querySelector('[data-review-resolve]')!);
    fireEvent.keyDown(window, { key: 'Escape' });
    // …e NADA entra no modelo/XML.
    const after = converter.toXml(target);
    expect(after).toBe(before);
    const { diagram: reimported } = converter.fromXml(after);
    expect(converter.toXml(reimported)).toBe(before);
  });

  it('pins e threads nunca vazam no export (mid-thread)', () => {
    const { store } = seededStore();
    const { container } = render(
      <BpmnDiffViewer base={baseDiagram()} target={targetDiagram()} reviewStore={store} messages={PT_BR} />,
    );
    fireEvent.click(container.querySelector('[data-review-pin="limit"]')!);
    expect(screen.getByTestId('review-thread')).toBeInTheDocument();
    const svg = container.querySelector('svg.bpmnr-canvas') as SVGSVGElement;
    expect(svg.querySelector('[data-review-pins]')).not.toBeNull();
    const exported = svgToString(svg);
    expect(exported).not.toContain('data-review');
    expect(exported).not.toContain('bpmnr-review-pin');
  });
});
