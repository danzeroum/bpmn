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
  eventDefinitionUsages,
  findEventDefinition,
  JsonSerializer,
  nextEventDefinitionId,
  normalizeForDiff,
  removeEventDefinitionCommand,
  updateEventDefinitionCommand,
  type BpmnDiagram,
} from '../src/index.js';

/**
 * Handoff 16 E-1 — definições nomeadas de primeira classe (§3a headless):
 * modelo aditivo, comandos undoáveis (rename cascata = 1 undo, remoção vetada
 * listando usos), converter com root elements OMG + messageRef/signalRef/
 * errorRef, ref órfã sintetizada COM warning (decisão 2 da E-0) e a
 * neutralidade de hash congelada (cerca §1.3, critério da #119).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const FROZEN = JSON.parse(readFileSync(join(HERE, 'eventDefsFrozen.json'), 'utf8')) as {
  xml: string;
  hash: string;
};

/** The exact diagram the frozen fixture was generated from (pre-E-1 build). */
function frozenDiagram(): BpmnDiagram {
  const diagram = createDiagram({ name: 'Event defs frozen', id: 'evfrozen' });
  diagram.version = {
    ...diagram.version,
    id: 'v-ev',
    semanticVersion: '1.0.0',
    status: 'candidate',
    changeSummary: 'Fixture congelada pré-E-1.',
    createdBy: 'freeze',
    createdAt: '2026-07-18T00:00:00.000Z',
    snapshotHash: '',
  };
  diagram.nodes = {
    start: createNode({ id: 'start', type: 'startEvent', label: 'Início', x: 40, y: 100 }),
    wait: createNode({ id: 'wait', type: 'intermediateCatchEvent', label: 'Aguardar OK', x: 200, y: 100, properties: { eventDefinition: 'message' } }),
    fire: createNode({ id: 'fire', type: 'intermediateThrowEvent', label: 'Sinalizar', x: 360, y: 100, properties: { eventDefinition: 'signal' } }),
    end: createNode({ id: 'end', type: 'endEvent', label: 'Fim', x: 520, y: 100, properties: { eventDefinition: 'error' } }),
  };
  diagram.edges = {
    e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'wait' }),
    e2: createEdge({ id: 'e2', sourceId: 'wait', targetId: 'fire' }),
    e3: createEdge({ id: 'e3', sourceId: 'fire', targetId: 'end' }),
  };
  return diagram;
}

/** Frozen diagram + named definitions + two events referencing msg-1. */
function definedDiagram(): BpmnDiagram {
  const diagram = frozenDiagram();
  diagram.definitions = {
    messages: [{ id: 'msg-1', name: 'Pedido aprovado' }],
    signals: [{ id: 'sig-1', name: 'Estoque baixo' }],
    errors: [{ id: 'err-1', name: 'Falha de cobrança', errorCode: 'PAY-42' }],
  };
  diagram.nodes.wait = {
    ...diagram.nodes.wait,
    properties: { ...diagram.nodes.wait.properties, eventDefinitionRef: 'msg-1' },
  };
  diagram.nodes.start = {
    ...diagram.nodes.start,
    properties: { eventDefinition: 'message', eventDefinitionRef: 'msg-1' },
  };
  diagram.nodes.fire = {
    ...diagram.nodes.fire,
    properties: { ...diagram.nodes.fire.properties, eventDefinitionRef: 'sig-1' },
  };
  diagram.nodes.end = {
    ...diagram.nodes.end,
    properties: { ...diagram.nodes.end.properties, eventDefinitionRef: 'err-1' },
  };
  return diagram;
}

describe('critério 1 — neutralidade congelada (cerca §1.3)', () => {
  it('sem definições nomeadas, toXml e hash são byte-idênticos aos pré-E-1', async () => {
    const diagram = frozenDiagram();
    expect(new BpmnXmlConverter().toXml(diagram)).toBe(FROZEN.xml);
    expect(await computeDiagramHash(diagram)).toBe(FROZEN.hash);
  });

  it('com definições o hash muda (conteúdo real)', async () => {
    expect(await computeDiagramHash(definedDiagram())).not.toBe(FROZEN.hash);
  });
});

describe('critério 2 — comandos undoáveis', () => {
  it('id auto é estável e colisão-safe; undo do primeiro add remove o campo inteiro', async () => {
    const diagram = frozenDiagram();
    expect(nextEventDefinitionId(diagram, 'message')).toBe('msg-1');
    const command = addEventDefinitionCommand('message', { id: 'msg-1', name: 'Pedido' });
    const withDef = command.execute(diagram);
    expect(findEventDefinition(withDef, 'message', 'msg-1')?.name).toBe('Pedido');
    expect(nextEventDefinitionId(withDef, 'message')).toBe('msg-2');
    // Ids importados arbitrários nunca colidem: o contador pula os tomados.
    const odd = addEventDefinitionCommand('message', { id: 'msg-2', name: 'X' }).execute(withDef);
    expect(nextEventDefinitionId(odd, 'message')).toBe('msg-3');
    // Undo do PRIMEIRO add: o campo `definitions` volta a NÃO existir —
    // neutralidade de hash sobrevive ao ciclo (cerca §1.3).
    const undone = command.undo(withDef);
    expect(undone.definitions).toBeUndefined();
    expect(await computeDiagramHash(undone)).toBe(FROZEN.hash);
  });

  it('rename CASCATA = 1 undo: 2 eventos refletem o novo nome, nós intactos (decisão 5)', () => {
    const diagram = definedDiagram();
    // 2 eventos referenciam msg-1 (start e wait).
    expect(eventDefinitionUsages(diagram, 'message', 'msg-1').map((u) => u.nodeId).sort()).toEqual([
      'start',
      'wait',
    ]);
    const rename = updateEventDefinitionCommand('message', 'msg-1', { name: 'Pedido REPROVADO' });
    const renamed = rename.execute(diagram);
    // A cascata é por construção: ambos os eventos resolvem o nome novo…
    expect(findEventDefinition(renamed, 'message', 'msg-1')?.name).toBe('Pedido REPROVADO');
    // …e NENHUM nó foi tocado (mesmas referências de objeto).
    expect(renamed.nodes.start).toBe(diagram.nodes.start);
    expect(renamed.nodes.wait).toBe(diagram.nodes.wait);
    // 1 undo restaura tudo.
    const undone = rename.undo(renamed);
    expect(findEventDefinition(undone, 'message', 'msg-1')?.name).toBe('Pedido aprovado');
    expect(undone.nodes.start).toBe(diagram.nodes.start);
  });

  it('remoção REFERENCIADA é vetada pela regra padrão listando os usos', () => {
    const engine = createDefaultRuleEngine();
    const diagram = definedDiagram();
    const remove = removeEventDefinitionCommand('message', 'msg-1');
    const verdict = engine.evaluateCommand(remove, diagram);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('2 evento(s)');
    expect(verdict.reason).toContain('Início (start)');
    expect(verdict.reason).toContain('Aguardar OK (wait)');
    // Órfã (sig-1 sem uso após limpar a ref) remove livre; undo restaura.
    const removeSignal = removeEventDefinitionCommand('signal', 'sig-1');
    const cleared: BpmnDiagram = {
      ...diagram,
      nodes: {
        ...diagram.nodes,
        fire: { ...diagram.nodes.fire, properties: { eventDefinition: 'signal' } },
      },
    };
    expect(engine.evaluateCommand(removeSignal, cleared).allowed).toBe(true);
    const removed = removeSignal.execute(cleared);
    expect(findEventDefinition(removed, 'signal', 'sig-1')).toBeUndefined();
    expect(findEventDefinition(removeSignal.undo(removed), 'signal', 'sig-1')?.name).toBe(
      'Estoque baixo',
    );
  });
});

describe('critérios 3/4 — converter OMG', () => {
  it('exporta roots antes do process, refs nos childs; round-trip byte-estável', () => {
    const converter = new BpmnXmlConverter();
    const diagram = definedDiagram();
    const xml = converter.toXml(diagram);
    for (const marker of [
      '<bpmn:message id="msg-1" name="Pedido aprovado" />',
      '<bpmn:signal id="sig-1" name="Estoque baixo" />',
      '<bpmn:error id="err-1" name="Falha de cobrança" errorCode="PAY-42" />',
      'messageRef="msg-1"',
      'signalRef="sig-1"',
      'errorRef="err-1"',
    ]) {
      expect(xml).toContain(marker);
    }
    // Roots ANTES de collaboration/process (ordem OMG).
    expect(xml.indexOf('<bpmn:message')).toBeLessThan(xml.indexOf('<bpmn:process'));

    const { diagram: imported, warnings } = converter.fromXml(xml);
    expect(warnings).toEqual([]);
    expect(imported.definitions).toEqual(diagram.definitions);
    expect(imported.nodes.wait.properties.eventDefinitionRef).toBe('msg-1');
    expect(imported.nodes.end.properties.eventDefinitionRef).toBe('err-1');
    // Byte-estabilidade entre os NOSSOS exports + estabilidade estrutural.
    expect(converter.toXml(imported)).toBe(xml);
    expect(normalizeForDiff(imported)).toEqual(normalizeForDiff(diagram));
  });

  it('ref órfã: sintetiza COM warning nomeando o evento; 2º passe limpo e estável', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D1" targetNamespace="http://x">
  <bpmn:process id="p1" name="Órfã">
    <bpmn:startEvent id="s1" name="Começo"/>
    <bpmn:intermediateCatchEvent id="c1" name="Aguardar pagamento">
      <bpmn:messageEventDefinition messageRef="ghost-msg"/>
    </bpmn:intermediateCatchEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="s1" targetRef="c1"/>
  </bpmn:process>
</bpmn:definitions>`;
    const converter = new BpmnXmlConverter();
    const first = converter.fromXml(xml);
    // (o outro warning é o de DI ausente da fixture mínima — irrelevante aqui)
    const orphan = first.warnings.filter((w) => w.includes('synthesized'));
    expect(orphan).toHaveLength(1);
    expect(orphan[0]).toContain('ghost-msg');
    expect(orphan[0]).toContain('Aguardar pagamento');
    expect(first.diagram.definitions?.messages).toEqual([{ id: 'ghost-msg', name: 'ghost-msg' }]);
    expect(first.diagram.nodes.c1.properties.eventDefinitionRef).toBe('ghost-msg');
    // Re-export declara o root → o 2º import é LIMPO e byte-estável.
    const exported = converter.toXml(first.diagram);
    expect(exported).toContain('<bpmn:message id="ghost-msg" name="ghost-msg" />');
    const second = converter.fromXml(exported);
    expect(second.warnings).toEqual([]);
    expect(converter.toXml(second.diagram)).toBe(exported);
  });

  it('ref órfã COMPARTILHADA: warning UMA vez por definição sintetizada, não por evento', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D2" targetNamespace="http://x">
  <bpmn:process id="p2" name="Órfã compartilhada">
    <bpmn:startEvent id="s1" name="Começo">
      <bpmn:messageEventDefinition messageRef="shared-msg"/>
    </bpmn:startEvent>
    <bpmn:intermediateCatchEvent id="c1" name="Aguardar de novo">
      <bpmn:messageEventDefinition messageRef="shared-msg"/>
    </bpmn:intermediateCatchEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="s1" targetRef="c1"/>
  </bpmn:process>
</bpmn:definitions>`;
    const converter = new BpmnXmlConverter();
    const { diagram, warnings } = converter.fromXml(xml);
    // UMA definição sintetizada, UM warning — mesmo com 2 eventos usando a ref.
    expect(diagram.definitions?.messages).toEqual([{ id: 'shared-msg', name: 'shared-msg' }]);
    expect(warnings.filter((w) => w.includes('synthesized'))).toHaveLength(1);
    // Ambos os eventos ligados; 2º passe limpo e byte-estável.
    expect(diagram.nodes.s1.properties.eventDefinitionRef).toBe('shared-msg');
    expect(diagram.nodes.c1.properties.eventDefinitionRef).toBe('shared-msg');
    const exported = converter.toXml(diagram);
    const second = converter.fromXml(exported);
    expect(second.warnings).toEqual([]);
    expect(converter.toXml(second.diagram)).toBe(exported);
  });

  it('critério 5 — JSON serializer preserva as definições', () => {
    const serializer = new JsonSerializer();
    const diagram = definedDiagram();
    expect(serializer.deserialize(serializer.serialize(diagram)).definitions).toEqual(
      diagram.definitions,
    );
  });
});
