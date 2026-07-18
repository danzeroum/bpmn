import { describe, expect, it } from 'vitest';
import {
  createDiagram,
  createNode,
  eligibleEscalationCatches,
  findEventDefinition,
  type BpmnDiagram,
} from '@buildtovalue/core';
import {
  escNoCatchRule,
  evtEscalationCatchIllegalRule,
  evtEscalationStartToplevelRule,
  evtRefMissingRule,
  fixCommandFor,
  lintFindings,
} from '../src/index.js';

/**
 * Handoff 18 §5d — escalação entra nas regras vivas (perfis 1.3.0): quick-fix
 * por kind, EVT_ESCALATION_START_TOPLEVEL (molde do de erro), ESC_NO_CATCH
 * (WARNING — dissolve é legal na OMG) e o catch ilegal em intermediate (reforço
 * 8). O predicado de catch é a fonte única do core (`eligibleEscalationCatches`).
 */
const node = (
  id: string,
  type: string,
  properties: Record<string, unknown> = {},
  label = id,
): ReturnType<typeof createNode> => createNode({ id, type, label, x: 0, y: 0, properties });

function graph(nodes: BpmnDiagram['nodes']): BpmnDiagram {
  const diagram = createDiagram({ name: 'Esc lint' });
  diagram.nodes = nodes;
  return diagram;
}

describe('EVT_REF_MISSING ganha o kind (§5d ponto 1)', () => {
  it('escalação sem ref acusa; com ref não; o quick-fix cria bpmn:escalation no bucket', () => {
    const diagram = graph({
      e: node('e', 'endEvent', { eventDefinition: 'escalation' }, 'Escalar'),
    });
    const missing = evtRefMissingRule(diagram);
    expect(missing).toHaveLength(1);
    expect(missing[0].code).toBe('EVT_REF_MISSING');
    // Quick-fix: cria uma definição de escalação e referencia (nunca genérica).
    const finding = lintFindings(diagram).find((f) => f.code === 'EVT_REF_MISSING' && f.nodeId === 'e')!;
    expect(finding.fixable).toBe(true);
    const command = fixCommandFor(diagram, finding)!;
    const after = command.execute(diagram);
    const ref = after.nodes.e.properties.eventDefinitionRef as string;
    expect(ref).toBe('esc-1');
    expect(findEventDefinition(after, 'escalation', 'esc-1')?.name).toBe('New escalation');
    // Com ref, some.
    expect(evtRefMissingRule(after)).toHaveLength(0);
  });
});

describe('EVT_ESCALATION_START_TOPLEVEL (§5d ponto 2, molde do de erro)', () => {
  it('start de escalação FORA de esub acusa; DENTRO não', () => {
    const outside = graph({
      s: node('s', 'startEvent', { eventDefinition: 'escalation' }, 'Início escala'),
    });
    expect(evtEscalationStartToplevelRule(outside)).toHaveLength(1);
    expect(evtEscalationStartToplevelRule(outside)[0].code).toBe('EVT_ESCALATION_START_TOPLEVEL');
    const inside = graph({
      esub: node('esub', 'subProcess', { triggeredByEvent: true }, 'Tratar'),
      s: node('s', 'startEvent', { parentId: 'esub', eventDefinition: 'escalation' }),
    });
    expect(evtEscalationStartToplevelRule(inside)).toHaveLength(0);
  });
});

describe('ESC_NO_CATCH (§5d ponto 3 — WARNING, fonte única do core)', () => {
  it('throw sem catch elegível avisa; com boundary de escalação (mesmo ref) some', () => {
    const noCatch = graph({
      e: node('e', 'endEvent', { eventDefinition: 'escalation', eventDefinitionRef: 'esc-1' }, 'Escalar'),
    });
    const warn = escNoCatchRule(noCatch);
    expect(warn).toHaveLength(1);
    expect(warn[0]).toMatchObject({ code: 'ESC_NO_CATCH', severity: 'warning' });
    expect(warn[0].message).toContain('dissolve');
    // Adiciona um boundary de escalação com o MESMO ref → o aviso some.
    const withCatch = graph({
      t: node('t', 'task', {}, 'Tarefa'),
      b: node('b', 'boundaryEvent', {
        attachedToRef: 't',
        eventDefinition: 'escalation',
        eventDefinitionRef: 'esc-1',
      }),
      e: node('e', 'endEvent', { eventDefinition: 'escalation', eventDefinitionRef: 'esc-1' }, 'Escalar'),
    });
    expect(escNoCatchRule(withCatch)).toHaveLength(0);
  });

  it('catch-all e kind-puro: um catch sem ref pega qualquer throw; ref diferente não', () => {
    // catch-all (boundary sem ref) pega um throw com ref.
    const catchAll = graph({
      t: node('t', 'task'),
      b: node('b', 'boundaryEvent', { attachedToRef: 't', eventDefinition: 'escalation' }),
      e: node('e', 'endEvent', { eventDefinition: 'escalation', eventDefinitionRef: 'esc-9' }),
    });
    expect(escNoCatchRule(catchAll)).toHaveLength(0);
    // kind-puro: throw sem ref + catch sem ref → pega.
    const puro = graph({
      t: node('t', 'task'),
      b: node('b', 'boundaryEvent', { attachedToRef: 't', eventDefinition: 'escalation' }),
      e: node('e', 'endEvent', { eventDefinition: 'escalation' }),
    });
    expect(escNoCatchRule(puro)).toHaveLength(0);
    // ref DIFERENTE (não catch-all) não pega → avisa.
    const mismatch = graph({
      t: node('t', 'task'),
      b: node('b', 'boundaryEvent', {
        attachedToRef: 't',
        eventDefinition: 'escalation',
        eventDefinitionRef: 'esc-OUTRO',
      }),
      e: node('e', 'endEvent', { eventDefinition: 'escalation', eventDefinitionRef: 'esc-1' }),
    });
    expect(escNoCatchRule(mismatch)).toHaveLength(1);
  });
});

describe('EVT_ESCALATION_CATCH_ILLEGAL (§5d reforço 8)', () => {
  it('intermediateCatchEvent de escalação é ilegal; boundary/esub-start não', () => {
    const illegal = graph({
      c: node('c', 'intermediateCatchEvent', { eventDefinition: 'escalation' }, 'Pegar'),
    });
    expect(evtEscalationCatchIllegalRule(illegal)).toHaveLength(1);
    expect(evtEscalationCatchIllegalRule(illegal)[0].code).toBe('EVT_ESCALATION_CATCH_ILLEGAL');
    // Boundary de escalação é catch legal → nenhum finding desta regra.
    const legal = graph({
      t: node('t', 'task'),
      b: node('b', 'boundaryEvent', { attachedToRef: 't', eventDefinition: 'escalation' }),
    });
    expect(evtEscalationCatchIllegalRule(legal)).toHaveLength(0);
  });
});

describe('eligibleEscalationCatches — shape do retorno (reforço 7, fonte da EC-5)', () => {
  it('enumera boundary + esub-start com catchKind e matchType estruturados', () => {
    const diagram = graph({
      t: node('t', 'task'),
      b: node('b', 'boundaryEvent', {
        attachedToRef: 't',
        eventDefinition: 'escalation',
        eventDefinitionRef: 'esc-1',
      }),
      esub: node('esub', 'subProcess', { triggeredByEvent: true }),
      s: node('s', 'startEvent', { parentId: 'esub', eventDefinition: 'escalation' }), // catch-all
    });
    const exact = eligibleEscalationCatches(diagram, 'esc-1');
    // boundary (exact, mesmo ref) + esub-start (catchAll, sem ref).
    expect(exact).toHaveLength(2);
    expect(exact.find((c) => c.node.id === 'b')).toMatchObject({ catchKind: 'boundary', matchType: 'exact' });
    expect(exact.find((c) => c.node.id === 's')).toMatchObject({ catchKind: 'esubStart', matchType: 'catchAll' });
    // Um ref diferente só casa o catch-all.
    const other = eligibleEscalationCatches(diagram, 'esc-OUTRO');
    expect(other.map((c) => c.node.id)).toEqual(['s']);
  });
});
