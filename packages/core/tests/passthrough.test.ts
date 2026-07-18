import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  computeDiagramHash,
  computeDiff,
  createDiagram,
  createEdge,
  createNode,
  diffDiagrams,
  JsonSerializer,
  normalizeForDiff,
  type BpmnDiagram,
} from '../src/index.js';

/**
 * Passthrough de extensões estrangeiras (`zeebe:*`/`camunda:*`) — a PR
 * dedicada da pendência registrada. Garantia: lossless SEMÂNTICO na
 * importação + byte-estável entre os NOSSOS exports (nunca byte-idêntico ao
 * arquivo de terceiros — trim de whitespace e CDATA→texto escapado são
 * contrato documentado no format-spec).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const FROZEN = JSON.parse(readFileSync(join(HERE, 'passthroughFrozen.json'), 'utf8')) as {
  xml: string;
  hash: string;
};

/** The exact diagram the frozen fixture was generated from (pre-PR build). */
function frozenDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Frozen fixture', id: 'frozen' });
  diagram.version = {
    ...diagram.version,
    id: 'v-frozen',
    semanticVersion: '1.2.3',
    status: 'candidate',
    changeSummary: 'Fixture congelada pré-passthrough.',
    createdBy: 'freeze',
    createdAt: '2026-07-18T00:00:00.000Z',
    snapshotHash: '',
  };
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Início', x: 40, y: 100 }),
    work: createNode({ id: 'work', type: 'serviceTask', label: 'Trabalhar', x: 200, y: 90, properties: { retries: 3 } }),
    end: createNode({ id: 'end', type: 'endEvent', label: 'Fim', x: 420, y: 100 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'work' }),
    e2: createEdge({
      id: 'e2',
      sourceId: 'work',
      targetId: 'end',
      waypoints: [
        { x: 320, y: 120 },
        { x: 420, y: 120 },
      ],
      properties: { routeMode: 'manual' },
    }),
  };
  return diagram;
}

const ZEEBE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
  id="Definitions_zx" targetNamespace="http://example.com/zx">
  <bpmn:process id="zx" name="Zeebe interop" isExecutable="true">
    <bpmn:extensionElements>
      <zeebe:userTaskForm id="form-1">{"components":[{"key":"aprovacao","type":"checkbox"}]}</zeebe:userTaskForm>
    </bpmn:extensionElements>
    <bpmn:startEvent id="start" name="Início"/>
    <bpmn:serviceTask id="work" name="Cobrar" zeebe:modelerTemplate="tmpl-payment" camunda:asyncBefore="true">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="payment-service" retries="3"/>
        <zeebe:ioMapping>
          <zeebe:input source="=valor" target="amount"/>
          <zeebe:output source="=resultado" target="status"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end" name="Fim"/>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="work"/>
    <bpmn:sequenceFlow id="f2" sourceRef="work" targetRef="end">
      <bpmn:extensionElements>
        <camunda:executionListener event="take" class="com.acme.Listener"/>
      </bpmn:extensionElements>
    </bpmn:sequenceFlow>
  </bpmn:process>
</bpmn:definitions>`;

describe('critério 2 — neutralidade absoluta sem extensões estrangeiras', () => {
  it('toXml e computeDiagramHash são byte-idênticos aos congelados pré-PR', async () => {
    const diagram = frozenDiagram();
    expect(new BpmnXmlConverter().toXml(diagram)).toBe(FROZEN.xml);
    expect(await computeDiagramHash(diagram)).toBe(FROZEN.hash);
  });
});

describe('critério 1 — round-trip lossless de zeebe:*/camunda:*', () => {
  it('importa, preserva no modelo e re-exporta tudo; 2º export byte-idêntico ao 1º', () => {
    const converter = new BpmnXmlConverter();
    const { diagram } = converter.fromXml(ZEEBE_XML);

    // Modelo: campos preservados exatamente onde o plano especifica.
    expect(diagram.processForeignExtensions?.[0]?.tag).toBe('zeebe:userTaskForm');
    expect(diagram.processForeignExtensions?.[0]?.text).toContain('"aprovacao"');
    expect(diagram.foreignNamespaces).toEqual({
      zeebe: 'http://camunda.org/schema/zeebe/1.0',
      camunda: 'http://camunda.org/schema/1.0/bpmn',
    });
    const work = diagram.nodes.work;
    expect(work.foreignAttributes).toEqual({
      'zeebe:modelerTemplate': 'tmpl-payment',
      'camunda:asyncBefore': 'true',
    });
    expect(work.foreignExtensions?.map((s) => s.tag)).toEqual([
      'zeebe:taskDefinition',
      'zeebe:ioMapping',
    ]);
    expect(work.foreignExtensions?.[1]?.children.map((c) => c.tag)).toEqual([
      'zeebe:input',
      'zeebe:output',
    ]);
    expect(diagram.edges.f2.foreignExtensions?.[0]?.tag).toBe('camunda:executionListener');

    // Export: tudo re-emitido + xmlns declarados.
    const exported = converter.toXml(diagram);
    for (const marker of [
      'xmlns:camunda="http://camunda.org/schema/1.0/bpmn"',
      'xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"',
      '<zeebe:userTaskForm id="form-1">',
      '<zeebe:taskDefinition type="payment-service" retries="3" />',
      '<zeebe:input source="=valor" target="amount" />',
      '<zeebe:output source="=resultado" target="status" />',
      'zeebe:modelerTemplate="tmpl-payment"',
      'camunda:asyncBefore="true"',
      '<camunda:executionListener event="take" class="com.acme.Listener" />',
    ]) {
      expect(exported).toContain(marker);
    }

    // Byte-estabilidade entre OS NOSSOS exports.
    const second = converter.fromXml(exported);
    expect(converter.toXml(second.diagram)).toBe(exported);
    // Estabilidade estrutural (a régua do corpus) inclui os campos novos.
    expect(normalizeForDiff(second.diagram)).toEqual(normalizeForDiff(diagram));
  });

  it('hash muda quando há extensões (conteúdo real) e o JSON serializer as preserva', async () => {
    const converter = new BpmnXmlConverter();
    const { diagram } = converter.fromXml(ZEEBE_XML);
    const stripped: BpmnDiagram = {
      ...diagram,
      nodes: Object.fromEntries(
        Object.entries(diagram.nodes).map(([id, n]) => [
          id,
          { ...n, foreignExtensions: undefined, foreignAttributes: undefined },
        ]),
      ),
      edges: Object.fromEntries(
        Object.entries(diagram.edges).map(([id, e]) => [
          id,
          { ...e, foreignExtensions: undefined, foreignAttributes: undefined },
        ]),
      ),
      processForeignExtensions: undefined,
      foreignNamespaces: undefined,
    };
    expect(await computeDiagramHash(diagram)).not.toBe(await computeDiagramHash(stripped));

    const serializer = new JsonSerializer();
    const restored = serializer.deserialize(serializer.serialize(diagram));
    expect(restored.nodes.work.foreignExtensions).toEqual(diagram.nodes.work.foreignExtensions);
    expect(restored.nodes.work.foreignAttributes).toEqual(diagram.nodes.work.foreignAttributes);
    expect(restored.processForeignExtensions).toEqual(diagram.processForeignExtensions);
    expect(restored.foreignNamespaces).toEqual(diagram.foreignNamespaces);
  });
});

describe('critério 6 + reforço 1 — Δ NOMEADO por campo estrangeiro, nunca blob', () => {
  it('mudar/remover extensões gera chaves nomeadas no computeDiff e no diffDiagrams', () => {
    const converter = new BpmnXmlConverter();
    const { diagram: base } = converter.fromXml(ZEEBE_XML);
    const target = structuredClone(base);
    // retries 3 → 5 na taskDefinition; template trocado; listener removido.
    target.nodes.work = {
      ...target.nodes.work,
      foreignExtensions: target.nodes.work.foreignExtensions!.map((s) =>
        s.tag === 'zeebe:taskDefinition' ? { ...s, attributes: { ...s.attributes, retries: '5' } } : s,
      ),
      foreignAttributes: {
        ...target.nodes.work.foreignAttributes,
        'zeebe:modelerTemplate': 'tmpl-v2',
      },
    };
    target.edges.f2 = { ...target.edges.f2, foreignExtensions: undefined };

    const raw = computeDiff(base, target);
    const workUpdate = raw.nodes.find((op) => op.op === 'update' && op.nodeId === 'work');
    expect(workUpdate && 'changes' in workUpdate ? Object.keys(workUpdate.changes).sort() : []).toEqual(
      ['@zeebe:modelerTemplate', 'zeebe:taskDefinition'],
    );
    const f2Update = raw.edges.find((op) => op.op === 'update' && 'edgeId' in op && op.edgeId === 'f2');
    expect(f2Update && 'changes' in f2Update ? Object.keys(f2Update.changes) : []).toEqual([
      'camunda:executionListener',
    ]);
    expect(
      f2Update && 'changes' in f2Update ? f2Update.changes['camunda:executionListener'].to : 'x',
    ).toBeNull();

    // diffDiagrams (o review do H15) carrega as mesmas chaves nomeadas.
    const entries = diffDiagrams(base, target);
    const workChanged = entries.find((e) => e.elementId === 'work' && e.kind === 'changed');
    expect(Object.keys(workChanged?.changes ?? {}).sort()).toEqual([
      '@zeebe:modelerTemplate',
      'zeebe:taskDefinition',
    ]);
    const f2Changed = entries.find((e) => e.elementId === 'f2' && e.kind === 'changed');
    expect(Object.keys(f2Changed?.changes ?? {})).toEqual(['camunda:executionListener']);
  });
});

describe('contrato documentado — trim e CDATA (format-spec §passthrough)', () => {
  it('whitespace de borda é normalizado e CDATA vira texto escapado, estáveis no 2º passe', () => {
    const xml = ZEEBE_XML.replace(
      '<zeebe:userTaskForm id="form-1">{"components":[{"key":"aprovacao","type":"checkbox"}]}</zeebe:userTaskForm>',
      '<zeebe:userTaskForm id="form-1"><![CDATA[  {"a":"<b>"}  ]]></zeebe:userTaskForm>',
    );
    const converter = new BpmnXmlConverter();
    const { diagram } = converter.fromXml(xml);
    // CDATA lido cru; trim só nas bordas do texto do elemento.
    expect(diagram.processForeignExtensions?.[0]?.text).toBe('{"a":"<b>"}');
    const exported = converter.toXml(diagram);
    expect(exported).toContain('{"a":"&lt;b&gt;"}'); // re-emitido escapado, não CDATA
    const second = converter.fromXml(exported);
    expect(converter.toXml(second.diagram)).toBe(exported);
  });
});
