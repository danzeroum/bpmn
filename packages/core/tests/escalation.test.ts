import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  addEventDefinitionCommand,
  BpmnXmlConverter,
  computeDiagramHash,
  createDefaultRuleEngine,
  createDiagram,
  createEdge,
  createNode,
  emptyEventDefinitions,
  EVENT_DEFINITION_BUCKETS,
  EVENT_DEFINITION_REF_KINDS,
  eventDefinitionsOf,
  eventDefinitionUsages,
  findEventDefinition,
  nextEventDefinitionId,
  normalizeForDiff,
  removeEventDefinitionCommand,
  updateEventDefinitionCommand,
  type BpmnDiagram,
} from '../src/index.js';

/**
 * Handoff 18 EC-1 (§5a) — escalation como o 4º bucket nomeado, ENTRANDO nas
 * mesmas fontes únicas da E-1/E-3 (zero fork): `escalationCode` no molde do
 * `errorCode` (ausente quando indefinido), root OMG + `escalationRef` nos 4
 * hosts (throw intermediate/end, catch boundary/esub-start), órfã sintetizada
 * com warning, neutralidade congelada (cerca §1.4) e o round-trip do ref
 * derivado no start do event subprocess (reforço 8).
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const FROZEN = JSON.parse(readFileSync(join(HERE, 'escalationFrozen.json'), 'utf8')) as {
  xml: string;
  hash: string;
};

/** The exact diagram the frozen fixture was generated from (pre-EC-1 build). */
function frozenDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Escalation frozen', id: 'escfrozen' });
  diagram.version = {
    ...diagram.version,
    id: 'v-esc',
    semanticVersion: '1.0.0',
    status: 'candidate',
    changeSummary: 'Fixture congelada pré-EC-1.',
    createdBy: 'freeze',
    createdAt: '2026-07-18T00:00:00.000Z',
    snapshotHash: '',
  };
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Início', x: 40, y: 100 }),
    approve: createNode({ id: 'approve', type: 'userTask', label: 'Aprovar despesa', x: 160, y: 78 }),
    end: createNode({ id: 'end', type: 'endEvent', label: 'Fim', x: 360, y: 100 }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'approve' }),
    e2: createEdge({ id: 'e2', sourceId: 'approve', targetId: 'end' }),
  };
  return diagram;
}

/**
 * Frozen diagram + escalation definitions + escalationRef on all four hosts:
 * catch (non-interrupting boundary), throw (intermediate + end) and — for the
 * reforço 8 — a typed escalation START inside an event subprocess.
 */
function escalationDiagram(): BpmnDiagram {
  const diagram = frozenDiagram();
  diagram.definitions = {
    messages: [],
    signals: [],
    errors: [],
    escalations: [
      { id: 'esc-1', name: 'Acima da alçada', escalationCode: 'OVER_BUDGET' },
      { id: 'esc-2', name: 'Sem código' },
    ],
  };
  diagram.nodes = {
    ...diagram.nodes,
    // catch — non-interrupting boundary (a personalidade da escalação)
    bnd: createNode({
      id: 'bnd',
      type: 'boundaryEvent',
      label: 'Acima da alçada',
      x: 220,
      y: 120,
      properties: {
        attachedToRef: 'approve',
        cancelActivity: false,
        eventDefinition: 'escalation',
        eventDefinitionRef: 'esc-1',
      },
    }),
    review: createNode({ id: 'review', type: 'task', label: 'Rever alçada', x: 340, y: 200 }),
    // throw — intermediate
    throwInt: createNode({
      id: 'throwInt',
      type: 'intermediateThrowEvent',
      label: 'Sinalizar alçada',
      x: 500,
      y: 200,
      properties: { eventDefinition: 'escalation', eventDefinitionRef: 'esc-1' },
    }),
    // throw — end (references esc-2, which carries NO code)
    endEsc: createNode({
      id: 'endEsc',
      type: 'endEvent',
      label: 'Escalar',
      x: 640,
      y: 200,
      properties: { eventDefinition: 'escalation', eventDefinitionRef: 'esc-2' },
    }),
  };
  diagram.edges = {
    ...diagram.edges,
    e3: createEdge({ id: 'e3', sourceId: 'bnd', targetId: 'review' }),
    e4: createEdge({ id: 'e4', sourceId: 'review', targetId: 'throwInt' }),
    e5: createEdge({ id: 'e5', sourceId: 'throwInt', targetId: 'endEsc' }),
  };
  return diagram;
}

describe('critério 1 — escalation na fonte única (zero fork)', () => {
  it('é o 4º ref-kind com bucket e prefixo de id próprios', () => {
    expect(EVENT_DEFINITION_REF_KINDS).toEqual(['message', 'signal', 'error', 'escalation']);
    expect(EVENT_DEFINITION_BUCKETS.escalation).toBe('escalations');
    expect(emptyEventDefinitions().escalations).toEqual([]);
    expect(nextEventDefinitionId(frozenDiagram(), 'escalation')).toBe('esc-1');
  });

  it('eventDefinitionsOf preenche o bucket ausente de um literal antigo', () => {
    const legacy = frozenDiagram();
    // Um literal pré-EC-1 sem o campo escalations…
    legacy.definitions = { messages: [], signals: [], errors: [] } as BpmnDiagram['definitions'];
    expect(eventDefinitionsOf(legacy).escalations).toEqual([]);
  });
});

describe('critério 2 — comandos parametrizados ganham o kind', () => {
  it('add com escalationCode; nextId colisão-safe', () => {
    const add = addEventDefinitionCommand('escalation', {
      id: nextEventDefinitionId(frozenDiagram(), 'escalation'),
      name: 'Acima da alçada',
      escalationCode: 'OVER_BUDGET',
    });
    const after = add.execute(frozenDiagram());
    expect(findEventDefinition(after, 'escalation', 'esc-1')).toEqual({
      id: 'esc-1',
      name: 'Acima da alçada',
      escalationCode: 'OVER_BUDGET',
    });
    expect(nextEventDefinitionId(after, 'escalation')).toBe('esc-2');
  });

  it('update do escalationCode (molde do errorCode)', () => {
    const diagram = escalationDiagram();
    const patch = updateEventDefinitionCommand('escalation', 'esc-1', {
      escalationCode: 'WAY_OVER',
    });
    const updated = patch.execute(diagram);
    expect(
      (findEventDefinition(updated, 'escalation', 'esc-1') as { escalationCode?: string })
        .escalationCode,
    ).toBe('WAY_OVER');
    // 1 undo restaura o código anterior.
    expect(
      (
        findEventDefinition(patch.undo(updated), 'escalation', 'esc-1') as {
          escalationCode?: string;
        }
      ).escalationCode,
    ).toBe('OVER_BUDGET');
  });

  it('rename CASCATA = 1 undo: 2 eventos refletem o nome, nós intactos', () => {
    const diagram = escalationDiagram();
    // bnd e throwInt referenciam esc-1.
    expect(
      eventDefinitionUsages(diagram, 'escalation', 'esc-1')
        .map((u) => u.nodeId)
        .sort(),
    ).toEqual(['bnd', 'throwInt']);
    const rename = updateEventDefinitionCommand('escalation', 'esc-1', { name: 'Fora da alçada' });
    const renamed = rename.execute(diagram);
    expect(findEventDefinition(renamed, 'escalation', 'esc-1')?.name).toBe('Fora da alçada');
    expect(renamed.nodes.bnd).toBe(diagram.nodes.bnd);
    expect(renamed.nodes.throwInt).toBe(diagram.nodes.throwInt);
    expect(findEventDefinition(rename.undo(renamed), 'escalation', 'esc-1')?.name).toBe(
      'Acima da alçada',
    );
  });

  it('remoção REFERENCIADA é vetada listando os usos', () => {
    const engine = createDefaultRuleEngine();
    const verdict = engine.evaluateCommand(
      removeEventDefinitionCommand('escalation', 'esc-1'),
      escalationDiagram(),
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('2 evento(s)');
    expect(verdict.reason).toContain('Acima da alçada (bnd)');
    expect(verdict.reason).toContain('Sinalizar alçada (throwInt)');
  });
});

describe('critérios 3/4 — converter OMG', () => {
  const converter = new BpmnXmlConverter();

  it('root com escalationCode omitido quando ausente; escalationRef nos hosts; round-trip byte-estável', () => {
    const diagram = escalationDiagram();
    const xml = converter.toXml(diagram);
    // Root COM código e root SEM código (omitido, nunca escalationCode="").
    expect(xml).toContain('<bpmn:escalation id="esc-1" name="Acima da alçada" escalationCode="OVER_BUDGET" />');
    expect(xml).toContain('<bpmn:escalation id="esc-2" name="Sem código" />');
    expect(xml).not.toContain('escalationCode=""');
    // Ordem OMG: roots antes do process.
    expect(xml.indexOf('<bpmn:escalation')).toBeLessThan(xml.indexOf('<bpmn:process'));
    // escalationRef no child de cada host (boundary catch, intermediate/end throw).
    expect(xml).toContain('escalationRef="esc-1"');
    expect(xml).toContain('escalationRef="esc-2"');
    // Boundary não-interrupting preservado.
    expect(xml).toContain('cancelActivity="false"');

    const { diagram: imported, warnings } = converter.fromXml(xml);
    expect(warnings).toEqual([]);
    expect(imported.definitions?.escalations).toEqual(diagram.definitions?.escalations);
    expect(imported.nodes.bnd.properties.eventDefinitionRef).toBe('esc-1');
    expect(imported.nodes.throwInt.properties.eventDefinitionRef).toBe('esc-1');
    expect(imported.nodes.endEsc.properties.eventDefinitionRef).toBe('esc-2');
    // Byte-estabilidade dos NOSSOS exports + idempotência estrutural do
    // round-trip (o anchor de boundary N-1 é re-derivado do DI no import, então
    // a comparação honesta é import⇄import, não contra o literal cru).
    expect(converter.toXml(imported)).toBe(xml);
    const reimported = converter.fromXml(xml).diagram;
    expect(normalizeForDiff(reimported)).toEqual(normalizeForDiff(imported));
  });

  it('ref órfã: escalationRef sem root sintetiza COM warning; 2º passe limpo e estável', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D1" targetNamespace="http://x">
  <bpmn:process id="p1" name="Órfã">
    <bpmn:startEvent id="s1" name="Começo"/>
    <bpmn:endEvent id="e1" name="Escalar sem alçada">
      <bpmn:escalationEventDefinition escalationRef="ghost-esc"/>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="s1" targetRef="e1"/>
  </bpmn:process>
</bpmn:definitions>`;
    const first = converter.fromXml(xml);
    const orphan = first.warnings.filter((w) => w.includes('synthesized'));
    expect(orphan).toHaveLength(1);
    expect(orphan[0]).toContain('ghost-esc');
    expect(orphan[0]).toContain('Escalar sem alçada');
    expect(first.diagram.definitions?.escalations).toEqual([
      { id: 'ghost-esc', name: 'ghost-esc' },
    ]);
    expect(first.diagram.nodes.e1.properties.eventDefinitionRef).toBe('ghost-esc');
    const exported = converter.toXml(first.diagram);
    expect(exported).toContain('<bpmn:escalation id="ghost-esc" name="ghost-esc" />');
    const second = converter.fromXml(exported);
    expect(second.warnings).toEqual([]);
    expect(converter.toXml(second.diagram)).toBe(exported);
  });

  it('reforço 8 — esub + start TIPADO de escalação: o import re-deriva o escalationRef, byte-estável', () => {
    const diagram = frozenDiagram();
    diagram.definitions = {
      messages: [],
      signals: [],
      errors: [],
      escalations: [{ id: 'esc-1', name: 'Acima da alçada', escalationCode: 'OVER_BUDGET' }],
    };
    diagram.nodes = {
      ...diagram.nodes,
      sub: createNode({
        id: 'sub',
        type: 'subProcess',
        label: 'Tratar alçada',
        x: 200,
        y: 240,
        properties: { triggeredByEvent: true, isExpanded: true },
      }),
      subStart: createNode({
        id: 'subStart',
        type: 'startEvent',
        label: 'Alçada',
        x: 220,
        y: 280,
        properties: {
          parentId: 'sub',
          eventDefinition: 'escalation',
          eventDefinitionRef: 'esc-1',
        },
      }),
      subWork: createNode({
        id: 'subWork',
        type: 'task',
        label: 'Rever',
        x: 340,
        y: 280,
        properties: { parentId: 'sub' },
      }),
    };
    diagram.edges = {
      ...diagram.edges,
      se: createEdge({ id: 'se', sourceId: 'subStart', targetId: 'subWork' }),
    };
    const converter = new BpmnXmlConverter();
    const xml = converter.toXml(diagram);
    expect(xml).toContain('triggeredByEvent="true"');
    expect(xml).toContain('escalationRef="esc-1"');
    // O import re-deriva o ref do start tipado (caminho da ES-1: side/t e agora
    // o ref do start) — fixpoint após o primeiro import (arestas aninhadas).
    const once = converter.fromXml(xml).diagram;
    expect(once.nodes.subStart.properties.eventDefinition).toBe('escalation');
    expect(once.nodes.subStart.properties.eventDefinitionRef).toBe('esc-1');
    const second = converter.toXml(once);
    expect(converter.toXml(converter.fromXml(second).diagram)).toBe(second);
  });
});

describe('critério 6 — neutralidade congelada (cerca §1.4)', () => {
  it('sem escalations: toXml e hash byte-idênticos aos de antes', async () => {
    const diagram = frozenDiagram();
    expect(new BpmnXmlConverter().toXml(diagram)).toBe(FROZEN.xml);
    expect(await computeDiagramHash(diagram)).toBe(FROZEN.hash);
  });

  it('bucket escalations VAZIO não emite root nenhum (aditivo puro)', () => {
    const diagram = frozenDiagram();
    diagram.definitions = emptyEventDefinitions();
    expect(new BpmnXmlConverter().toXml(diagram)).not.toContain('<bpmn:escalation');
  });
});
