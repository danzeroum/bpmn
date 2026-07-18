import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  computeDiagramHash,
  createDefaultRuleEngine,
  createDiagram,
  createEdge,
  createNode,
  isEventSubprocess,
  startIsInterrupting,
  unreachableNodeRule,
  type BpmnDiagram,
} from '../src/index.js';

/**
 * Handoff 17 ES-1 (§4a) — event subprocess no core: helpers fonte-única
 * (reforço 9), atributos OMG no converter com regra de emissão DECLARADA
 * (reforço 8 — o converter preserva, nunca julga), veto de conexão na casca,
 * isenção do unreachable e a fixture congelada de neutralidade (cerca §1.4).
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const FROZEN = JSON.parse(readFileSync(join(HERE, 'eventSubprocFrozen.json'), 'utf8')) as {
  xml: string;
  hash: string;
};

/** The exact diagram the frozen fixture was generated from (pre-ES-1 build). */
function frozenDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Event subproc frozen', id: 'esubfrozen' });
  diagram.version = {
    ...diagram.version,
    id: 'v-esub',
    semanticVersion: '1.0.0',
    status: 'candidate',
    changeSummary: 'Fixture congelada pré-ES-1.',
    createdBy: 'freeze',
    createdAt: '2026-07-18T00:00:00.000Z',
    snapshotHash: '',
  };
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Início', x: 40, y: 100 }),
    sub: createNode({ id: 'sub', type: 'subProcess', label: 'Tratamento', x: 200, y: 60, properties: { isExpanded: true } }),
    inner: createNode({ id: 'inner', type: 'startEvent', label: 'Começo interno', x: 220, y: 100, properties: { parentId: 'sub', eventDefinition: 'message' } }),
    work: createNode({ id: 'work', type: 'task', label: 'Trabalhar', x: 320, y: 100, properties: { parentId: 'sub' } }),
    end: createNode({ id: 'end', type: 'endEvent', label: 'Fim', x: 560, y: 100 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'sub' }),
    e2: createEdge({ id: 'e2', sourceId: 'inner', targetId: 'work' }),
    e3: createEdge({ id: 'e3', sourceId: 'sub', targetId: 'end' }),
  };
  return diagram;
}

/** Frozen diagram promoted to an event subprocess (edges into the shell cut). */
function eventSubDiagram(): BpmnDiagram {
  const diagram = frozenDiagram();
  diagram.nodes.sub = {
    ...diagram.nodes.sub,
    properties: { ...diagram.nodes.sub.properties, triggeredByEvent: true },
  };
  diagram.nodes.inner = {
    ...diagram.nodes.inner,
    properties: { ...diagram.nodes.inner.properties, isInterrupting: false },
  };
  delete diagram.edges.e1;
  delete diagram.edges.e3;
  return diagram;
}

describe('helpers fonte-única (critério 1, reforço 9)', () => {
  it('isEventSubprocess: SÓ subProcess com triggeredByEvent === true', () => {
    const diagram = eventSubDiagram();
    expect(isEventSubprocess(diagram.nodes.sub)).toBe(true);
    expect(isEventSubprocess(frozenDiagram().nodes.sub)).toBe(false); // comum
    expect(
      isEventSubprocess(
        createNode({ id: 't', type: 'task', properties: { triggeredByEvent: true } }),
      ),
    ).toBe(false); // tipo errado nunca conta
  });

  it('startIsInterrupting: default OMG true; false só explícito e só em startEvent', () => {
    const diagram = eventSubDiagram();
    expect(startIsInterrupting(diagram.nodes.inner)).toBe(false);
    expect(startIsInterrupting(frozenDiagram().nodes.inner)).toBe(true); // ausente = default
    expect(
      startIsInterrupting(
        createNode({ id: 't', type: 'task', properties: { isInterrupting: false } }),
      ),
    ).toBe(true); // não-start ignora a prop
  });
});

describe('converter (critérios 2–3, reforço 8)', () => {
  const converter = new BpmnXmlConverter();

  it('exporta os DOIS atributos OMG, omite o default true e round-tripa byte-estável', () => {
    const xml = converter.toXml(eventSubDiagram());
    expect(xml).toContain('triggeredByEvent="true"');
    expect(xml).toContain('isInterrupting="false"');
    // Default OMG omitido: nenhum true explícito de isInterrupting.
    expect(xml).not.toContain('isInterrupting="true"');
    // Nunca no soup quando emitido como atributo.
    expect(xml).not.toContain('bpmnr:property name="triggeredByEvent"');
    expect(xml).not.toContain('bpmnr:property name="isInterrupting"');
    const reimported = converter.fromXml(xml).diagram;
    expect(isEventSubprocess(reimported.nodes.sub)).toBe(true);
    expect(startIsInterrupting(reimported.nodes.inner)).toBe(false);
    expect(converter.toXml(reimported)).toBe(xml);
  });

  it('reforço 8 — isInterrupting="false" em start COMUM round-tripa byte-estável (o converter não julga)', () => {
    // Arquivo "externo" schema-valid: start de topo com isInterrupting=false,
    // SEM event subprocess nenhum — a semântica é assunto do lint 4d. A
    // byte-estabilidade é entre os NOSSOS exports (fixpoint após o primeiro
    // import — a ordem de inserção de arestas aninhadas normaliza lá, como em
    // todo diagrama com subProcess).
    const diagram = frozenDiagram();
    diagram.nodes.start = {
      ...diagram.nodes.start,
      properties: { isInterrupting: false },
    };
    const first = converter.toXml(diagram);
    expect(first).toContain('isInterrupting="false"');
    const once = converter.fromXml(first).diagram;
    expect(once.nodes.start.properties.isInterrupting).toBe(false);
    const second = converter.toXml(once);
    expect(second).toContain('isInterrupting="false"');
    expect(converter.toXml(converter.fromXml(second).diagram)).toBe(second);
  });

  it('cerca §1.4 — fixture congelada: sem triggeredByEvent, toXml e hash byte-idênticos aos de antes', async () => {
    const diagram = frozenDiagram();
    expect(new BpmnXmlConverter().toXml(diagram)).toBe(FROZEN.xml);
    expect(await computeDiagramHash(diagram)).toBe(FROZEN.hash);
  });
});

describe('veto de conexão na casca (critério 4)', () => {
  const engine = createDefaultRuleEngine();

  it('veta DE e PARA a casca com a mensagem nomeando a regra OMG; filhos e subProcess comum passam', () => {
    const diagram = eventSubDiagram();
    const into = engine.evaluate('edge.connect.pre', { sourceId: 'start', targetId: 'sub' }, diagram);
    expect(into.allowed).toBe(false);
    expect(into.reason).toContain('não recebe fluxo de sequência');
    expect(into.reason).toContain('dispara pelo evento do start (OMG)');
    expect(into.reason).toContain('Tratamento');
    const outOf = engine.evaluate('edge.connect.pre', { sourceId: 'sub', targetId: 'end' }, diagram);
    expect(outOf.allowed).toBe(false);
    // Filhos conectam entre si normalmente.
    expect(
      engine.evaluate('edge.connect.pre', { sourceId: 'inner', targetId: 'work' }, diagram).allowed,
    ).toBe(true);
    // subProcess COMUM segue conectável (o veto é só do event subprocess).
    expect(
      engine.evaluate(
        'edge.connect.pre',
        { sourceId: 'start', targetId: 'sub' },
        frozenDiagram(),
      ).allowed,
    ).toBe(true);
  });
});

describe('isenção do unreachable (critério 5)', () => {
  it('event subprocess sem fluxo de entrada é isento; subProcess comum CONTINUA acusando', () => {
    const eventSub = eventSubDiagram(); // casca sem arestas por construção
    expect(unreachableNodeRule(eventSub).filter((issue) => issue.nodeId === 'sub')).toEqual([]);
    const common = frozenDiagram();
    delete common.edges.e1; // subProcess comum sem entrada
    const issues = unreachableNodeRule(common).filter((issue) => issue.nodeId === 'sub');
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('UNREACHABLE_NODE');
  });
});
