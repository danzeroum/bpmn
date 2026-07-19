import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  compensableActivitiesOf,
  computeDiagramHash,
  createDefaultRuleEngine,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '../src/index.js';

/**
 * Handoff 19 CO-1 (§6a) — compensação como a semântica que FECHA a família OMG,
 * SEM bucket nem root nomeado: o kind interno `compensate` (== prefixo OMG),
 * `isForCompensation` no handler (default false omitido), `activityRef`/
 * `waitForCompletion` SÓ no throw (default true omitido), o boundary ⟲ SEM
 * `cancelActivity`, a associação (aresta de primeira classe já existente) ligando
 * boundary→handler, e o veto estrutural dos dois lados. `compensationFrozen`
 * trava os bytes; as 4 fixtures anteriores seguem intactas (cerca §1.4).
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const FROZEN = JSON.parse(readFileSync(join(HERE, 'compensationFrozen.json'), 'utf8')) as {
  xml: string;
  hash: string;
};

/** The exact compensation trio the frozen fixture was generated from. */
function frozenDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Compensation frozen', id: 'compfrozen' });
  diagram.version = {
    ...diagram.version,
    id: 'v-comp',
    semanticVersion: '1.0.0',
    status: 'candidate',
    changeSummary: 'Fixture congelada CO-1.',
    createdBy: 'freeze',
    createdAt: '2026-07-19T00:00:00.000Z',
    snapshotHash: '',
  };
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Início', x: 40, y: 100 }),
    hotel: createNode({ id: 'hotel', type: 'serviceTask', label: 'Reservar hotel', x: 160, y: 78 }),
    end: createNode({ id: 'end', type: 'endEvent', label: 'Fim', x: 520, y: 100 }),
    // Compensation boundary ⟲ on the completed activity — no cancelActivity.
    b1: createNode({
      id: 'b1',
      type: 'boundaryEvent',
      label: 'Acima da alçada',
      x: 200,
      y: 120,
      properties: { attachedToRef: 'hotel', eventDefinition: 'compensate' },
    }),
    // Handler reached by association — isForCompensation, no sequence flow.
    cancel: createNode({
      id: 'cancel',
      type: 'serviceTask',
      label: 'Cancelar reserva',
      x: 300,
      y: 200,
      properties: { isForCompensation: true },
    }),
    // Throw targeting the activity (activityRef); waitForCompletion default true.
    t1: createNode({
      id: 't1',
      type: 'intermediateThrowEvent',
      label: 'Compensar',
      x: 360,
      y: 82,
      properties: { eventDefinition: 'compensate', compensateActivityRef: 'hotel' },
    }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'hotel' }),
    e2: createEdge({ id: 'e2', sourceId: 'hotel', targetId: 't1' }),
    e3: createEdge({ id: 'e3', sourceId: 't1', targetId: 'end' }),
    // The boundary→handler link is an ASSOCIATION, never sequence flow.
    a1: createEdge({ id: 'a1', type: 'association', sourceId: 'b1', targetId: 'cancel' }),
  };
  return diagram;
}

describe('CO-1 §6a — o trio OMG da compensação (round-trip byte-estável)', () => {
  it('boundary ⟲ + associação + isForCompensation + throw com activityRef round-trippam', () => {
    const converter = new BpmnXmlConverter();
    const xml = converter.toXml(frozenDiagram());
    // compensateEventDefinition no boundary (catch) e no throw.
    expect(xml).toContain('<bpmn:compensateEventDefinition');
    // O boundary NÃO emite cancelActivity (não se aplica — dispara pós-conclusão).
    expect(xml).not.toContain('cancelActivity');
    // O handler carrega isForCompensation; a associação é bpmn:association.
    expect(xml).toContain('isForCompensation="true"');
    expect(xml).toContain('<bpmn:association id="a1" sourceRef="b1" targetRef="cancel" />');
    // O throw carrega activityRef; waitForCompletion default true é OMITIDO.
    expect(xml).toContain('activityRef="hotel"');
    expect(xml).not.toContain('waitForCompletion');
    // Round-trip byte-estável.
    const { diagram: back, warnings } = converter.fromXml(xml);
    expect(warnings).toEqual([]);
    expect(converter.toXml(back)).toBe(xml);
    expect(back.nodes.b1.properties.eventDefinition).toBe('compensate');
    expect(back.nodes.cancel.properties.isForCompensation).toBe(true);
    expect(back.nodes.t1.properties.compensateActivityRef).toBe('hotel');
    expect(back.edges.a1.type).toBe('association');
  });

  it('throw SEM activityRef = broadcast (nenhum activityRef emitido)', () => {
    const diagram = frozenDiagram();
    delete diagram.nodes.t1.properties.compensateActivityRef;
    const converter = new BpmnXmlConverter();
    const xml = converter.toXml(diagram);
    expect(xml).not.toContain('activityRef=');
    expect(converter.toXml(converter.fromXml(xml).diagram)).toBe(xml);
  });

  it('waitForCompletion false no throw round-trippa; default true nunca é escrito', () => {
    const diagram = frozenDiagram();
    diagram.nodes.t1.properties.waitForCompletion = false;
    const converter = new BpmnXmlConverter();
    const xml = converter.toXml(diagram);
    expect(xml).toContain('waitForCompletion="false"');
    const back = converter.fromXml(xml).diagram;
    expect(back.nodes.t1.properties.waitForCompletion).toBe(false);
    expect(converter.toXml(back)).toBe(xml);
  });

  it('catch (boundary) NUNCA emite activityRef/waitForCompletion mesmo se presentes na property', () => {
    const diagram = frozenDiagram();
    // Um catch com attrs de throw é não-OMG — o serializer NÃO os emite no child
    // (CO-3: lint avisa + preserva). Aqui garantimos que o boundary fica limpo.
    diagram.nodes.b1.properties.compensateActivityRef = 'hotel';
    diagram.nodes.b1.properties.waitForCompletion = false;
    const xml = new BpmnXmlConverter().toXml(diagram);
    const boundaryDef = xml.slice(xml.indexOf('id="b1"'));
    const boundaryDefEnd = boundaryDef.slice(0, boundaryDef.indexOf('</bpmn:boundaryEvent>'));
    expect(boundaryDefEnd).not.toContain('activityRef=');
    expect(boundaryDefEnd).not.toContain('waitForCompletion=');
  });
});

describe('CO-1 §6c — veto estrutural (os DOIS lados; canal ES-3)', () => {
  const rules = createDefaultRuleEngine();
  const diagram = frozenDiagram();

  it('handler (isForCompensation) NÃO recebe fluxo de sequência', () => {
    const v = rules.evaluate('edge.connect.pre', { sourceId: 'hotel', targetId: 'cancel' }, diagram);
    expect(v.allowed).toBe(false);
    expect(v.reason).toMatch(/Handler de compensação/);
  });

  it('handler (isForCompensation) NÃO emite fluxo de sequência', () => {
    const v = rules.evaluate('edge.connect.pre', { sourceId: 'cancel', targetId: 'end' }, diagram);
    expect(v.allowed).toBe(false);
    expect(v.reason).toMatch(/Handler de compensação/);
  });

  it('boundary ⟲ NÃO emite fluxo de sequência de saída (só associação)', () => {
    const v = rules.evaluate('edge.connect.pre', { sourceId: 'b1', targetId: 'end' }, diagram);
    expect(v.allowed).toBe(false);
    expect(v.reason).toMatch(/só por associação/);
  });

  it('a associação boundary ⟲ → handler é PERMITIDA (edgeType association)', () => {
    const v = rules.evaluate(
      'edge.connect.pre',
      { sourceId: 'b1', targetId: 'cancel', edgeType: 'association' },
      diagram,
    );
    expect(v.allowed).toBe(true);
  });

  it('NEGATIVO: boundary de ERRO continua emitindo fluxo normal', () => {
    const d = frozenDiagram();
    d.nodes.b1.properties.eventDefinition = 'error';
    delete d.nodes.cancel.properties.isForCompensation; // handler comum
    const v = rules.evaluate('edge.connect.pre', { sourceId: 'b1', targetId: 'cancel' }, d);
    expect(v.allowed).toBe(true);
  });
});

describe('CO-1 §1.4 — compensationFrozen trava os bytes', () => {
  it('o trio congelado emite toXml e hash byte-idênticos ao fixture', async () => {
    const diagram = frozenDiagram();
    expect(new BpmnXmlConverter().toXml(diagram)).toBe(FROZEN.xml);
    expect(await computeDiagramHash(diagram)).toBe(FROZEN.hash);
  });
});

describe('CO-2 §6b — compensableActivitiesOf (fonte única, scope-aware)', () => {
  it('lista a atividade compensável do escopo com o boundary que a faz compensável', () => {
    const list = compensableActivitiesOf(frozenDiagram());
    expect(list).toEqual([{ activityId: 'hotel', label: 'Reservar hotel', boundaryId: 'b1' }]);
  });

  it('atividade com 2 boundaries ⟲ é listada UMA vez', () => {
    const d = frozenDiagram();
    d.nodes.b2 = createNode({
      id: 'b2',
      type: 'boundaryEvent',
      label: 'Outra',
      x: 220,
      y: 120,
      properties: { attachedToRef: 'hotel', eventDefinition: 'compensate' },
    });
    expect(compensableActivitiesOf(d).map((c) => c.activityId)).toEqual(['hotel']);
  });

  it('reforço 8: SÓ o mesmo escopo — atividade compensável dentro de subProcess NÃO é listada no topo, e vice-versa', () => {
    const d = frozenDiagram();
    // Um subProcess comum com uma atividade compensável DENTRO dele.
    d.nodes.sub = createNode({ id: 'sub', type: 'subProcess', label: 'Bloco', x: 40, y: 320 });
    d.nodes.inner = createNode({
      id: 'inner',
      type: 'serviceTask',
      label: 'Emitir voucher',
      x: 60,
      y: 360,
      properties: { parentId: 'sub' },
    });
    d.nodes.bInner = createNode({
      id: 'bInner',
      type: 'boundaryEvent',
      label: 'Compensar voucher',
      x: 100,
      y: 400,
      properties: { attachedToRef: 'inner', eventDefinition: 'compensate' },
    });
    // No TOPO (scope undefined): só hotel; inner NÃO aparece.
    expect(compensableActivitiesOf(d, undefined).map((c) => c.activityId)).toEqual(['hotel']);
    // No escopo do subProcess: só inner; hotel NÃO aparece.
    expect(compensableActivitiesOf(d, 'sub').map((c) => c.activityId)).toEqual(['inner']);
  });

  it('boundary de ERRO não conta como compensável (kind-gated)', () => {
    const d = frozenDiagram();
    d.nodes.b1.properties.eventDefinition = 'error';
    expect(compensableActivitiesOf(d)).toEqual([]);
  });
})
