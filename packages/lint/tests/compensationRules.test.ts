import { describe, expect, it } from 'vitest';
import {
  BpmnXmlConverter,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import {
  compBoundaryNoHandlerRule,
  compCatchAttrsRule,
  compensationHandlerCommands,
  compHandlerFlowRule,
  compRefNotCompensableRule,
  compStartToplevelRule,
  ETIQUETTE_PROFILE,
  evtRefMissingRule,
  fixCommandFor,
  lintFindings,
} from '../src/index.js';

/**
 * Handoff 19 §6c — compensação entra nas regras vivas (perfis 1.4.0):
 * COMP_HANDLER_FLOW (os dois papéis, reforço 9), COMP_BOUNDARY_NO_HANDLER
 * (quick-fix = builder da paleta), COMP_REF_NOT_COMPENSABLE (via
 * compensableActivitiesOf, escopo), COMP_CATCH_ATTRS (warning + prova de
 * não-re-emissão), COMP_START_TOPLEVEL (molde do de escalação) e o negativo
 * vinculante do EVT_REF_MISSING (reforço 8: compensação nunca dispara).
 */
const node = (
  id: string,
  type: string,
  properties: Record<string, unknown> = {},
  label = id,
): ReturnType<typeof createNode> => createNode({ id, type, label, x: 0, y: 0, properties });

function graph(nodes: BpmnDiagram['nodes'], edges: Array<[string, string, string, string?]> = []): BpmnDiagram {
  const diagram = createDiagram({ name: 'Comp lint' });
  diagram.nodes = nodes;
  for (const [id, sourceId, targetId, type] of edges) {
    diagram.edges[id] = createEdge({ id, sourceId, targetId, ...(type ? { type } : {}) });
  }
  return diagram;
}

describe('COMP_HANDLER_FLOW (reforço 9 — os dois papéis, um finding por aresta)', () => {
  it('handler como TARGET e como SOURCE acusam; task comum flui; um por aresta', () => {
    const diagram = graph(
      {
        a: node('a', 'task'),
        handler: node('handler', 'serviceTask', { isForCompensation: true }, 'Cancelar'),
        b: node('b', 'task'),
        c: node('c', 'task'),
      },
      [
        ['in', 'a', 'handler'], // handler como TARGET → acusa
        ['out', 'handler', 'b'], // handler como SOURCE → acusa
        ['ok', 'b', 'c'], // task comum → nunca
      ],
    );
    const issues = compHandlerFlowRule(diagram);
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.code === 'COMP_HANDLER_FLOW' && i.severity === 'error')).toBe(true);
    expect(new Set(issues.map((i) => i.edgeId))).toEqual(new Set(['in', 'out']));
    expect(issues.find((i) => i.edgeId === 'in')!.message).toContain('"Cancelar"');
  });

  it('handler↔handler = UM finding nomeando as duas pontas (nunca dois)', () => {
    const diagram = graph(
      {
        h1: node('h1', 'serviceTask', { isForCompensation: true }, 'H1'),
        h2: node('h2', 'serviceTask', { isForCompensation: true }, 'H2'),
      },
      [['x', 'h1', 'h2']],
    );
    const issues = compHandlerFlowRule(diagram);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('"H1"');
    expect(issues[0].message).toContain('"H2"');
  });
});

describe('COMP_BOUNDARY_NO_HANDLER (erro + quick-fix = builder da paleta)', () => {
  const withBoundary = (withAssoc: boolean): BpmnDiagram =>
    graph(
      {
        hotel: node('hotel', 'serviceTask', {}, 'Reservar hotel'),
        bnd: node('bnd', 'boundaryEvent', { attachedToRef: 'hotel', eventDefinition: 'compensate' }, 'Compensar'),
        ...(withAssoc ? { cancel: node('cancel', 'serviceTask', { isForCompensation: true }, 'Cancelar') } : {}),
      },
      withAssoc ? [['a1', 'bnd', 'cancel', 'association']] : [],
    );

  it('boundary ⟲ sem associação = erro; com associação = sem finding', () => {
    expect(compBoundaryNoHandlerRule(withBoundary(false))).toHaveLength(1);
    expect(compBoundaryNoHandlerRule(withBoundary(false))[0].code).toBe('COMP_BOUNDARY_NO_HANDLER');
    expect(compBoundaryNoHandlerRule(withBoundary(true))).toHaveLength(0);
  });

  it('quick-fix cria handler (isForCompensation) ABAIXO do host + associação — a FORMA da paleta', () => {
    const diagram = withBoundary(false);
    const findings = lintFindings(diagram, [ETIQUETTE_PROFILE]);
    const finding = findings.find((f) => f.code === 'COMP_BOUNDARY_NO_HANDLER')!;
    expect(finding.fixable).toBe(true);
    const fixed = fixCommandFor(diagram, finding, [ETIQUETTE_PROFILE])!.execute(diagram);
    const handler = Object.values(fixed.nodes).find((n) => n.properties.isForCompensation === true)!;
    expect(handler).toBeTruthy();
    expect(handler.y).toBeGreaterThan(fixed.nodes.hotel.y + fixed.nodes.hotel.height);
    const assoc = Object.values(fixed.edges).find((e) => e.type === 'association')!;
    expect(assoc.sourceId).toBe('bnd');
    expect(assoc.targetId).toBe(handler.id);
    // O fix limpa o próprio finding (re-lint não acusa mais).
    expect(compBoundaryNoHandlerRule(fixed)).toHaveLength(0);
  });
});

describe('COMP_REF_NOT_COMPENSABLE (warning, scope-aware)', () => {
  it('throw apontando atividade compensável = ok; não-compensável = warning', () => {
    const base = (targetHasBoundary: boolean): BpmnDiagram =>
      graph({
        hotel: node('hotel', 'serviceTask', {}, 'Reservar hotel'),
        ...(targetHasBoundary
          ? { bnd: node('bnd', 'boundaryEvent', { attachedToRef: 'hotel', eventDefinition: 'compensate' }) }
          : {}),
        thr: node('thr', 'intermediateThrowEvent', { eventDefinition: 'compensate', compensateActivityRef: 'hotel' }),
      });
    expect(compRefNotCompensableRule(base(true))).toHaveLength(0);
    const warn = compRefNotCompensableRule(base(false));
    expect(warn).toHaveLength(1);
    expect(warn[0]).toMatchObject({ code: 'COMP_REF_NOT_COMPENSABLE', severity: 'warning' });
  });

  it('broadcast (sem activityRef) nunca acusa', () => {
    const diagram = graph({
      thr: node('thr', 'endEvent', { eventDefinition: 'compensate' }),
    });
    expect(compRefNotCompensableRule(diagram)).toHaveLength(0);
  });
});

describe('COMP_CATCH_ATTRS (warning + prova de não-re-emissão — as duas metades)', () => {
  it('boundary com activityRef/waitForCompletion acusa E o child NÃO os re-emite', () => {
    const diagram = graph({
      hotel: node('hotel', 'serviceTask', {}, 'Reservar hotel'),
      bnd: node('bnd', 'boundaryEvent', {
        attachedToRef: 'hotel',
        eventDefinition: 'compensate',
        compensateActivityRef: 'hotel', // não-OMG num CATCH
        waitForCompletion: false,
      }, 'Compensar'),
    });
    // Metade 1: a regra AVISA.
    const issues = compCatchAttrsRule(diagram);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'COMP_CATCH_ATTRS', severity: 'warning' });
    // Metade 2: o converter PRESERVA no soup e NUNCA re-emite no child OMG.
    const xml = new BpmnXmlConverter().toXml(diagram);
    const child = xml.slice(xml.indexOf('id="bnd"'));
    const childEnd = child.slice(0, child.indexOf('</bpmn:boundaryEvent>'));
    expect(childEnd).not.toContain('activityRef=');
    expect(childEnd).not.toContain('waitForCompletion=');
    // Preservado (round-trip byte-estável).
    expect(new BpmnXmlConverter().toXml(new BpmnXmlConverter().fromXml(xml).diagram)).toBe(xml);
  });
});

describe('COMP_START_TOPLEVEL (molde do de escalação)', () => {
  it('start de compensação fora de esub acusa; dentro de esub não', () => {
    const toplevel = graph({ s: node('s', 'startEvent', { eventDefinition: 'compensate' }, 'Comp') });
    expect(compStartToplevelRule(toplevel)).toHaveLength(1);
    expect(compStartToplevelRule(toplevel)[0].code).toBe('COMP_START_TOPLEVEL');
    const inEsub = graph({
      esub: node('esub', 'subProcess', { triggeredByEvent: true }, 'Reverter'),
      s: node('s', 'startEvent', { parentId: 'esub', eventDefinition: 'compensate' }),
    });
    expect(compStartToplevelRule(inEsub)).toHaveLength(0);
  });
});

describe('cobertura dos ramos declarados', () => {
  it('COMP_CATCH_ATTRS também acusa no esub-start; e com só um dos attrs', () => {
    // esub-start catch (não boundary) com só waitForCompletion.
    const esub = graph({
      shell: node('shell', 'subProcess', { triggeredByEvent: true }, 'Reverter'),
      st: node('st', 'startEvent', {
        parentId: 'shell',
        eventDefinition: 'compensate',
        waitForCompletion: true,
      }),
    });
    expect(compCatchAttrsRule(esub)).toHaveLength(1);
    // boundary com SÓ activityRef (sem waitForCompletion).
    const onlyRef = graph({
      hotel: node('hotel', 'serviceTask', {}, 'H'),
      bnd: node('bnd', 'boundaryEvent', { attachedToRef: 'hotel', eventDefinition: 'compensate', compensateActivityRef: 'hotel' }),
    });
    expect(compCatchAttrsRule(onlyRef)).toHaveLength(1);
    // Um start de compensação NO TOPO (não esub) com attrs NÃO é um catch → não acusa aqui.
    const topStart = graph({ s: node('s', 'startEvent', { eventDefinition: 'compensate', waitForCompletion: false }) });
    expect(compCatchAttrsRule(topStart)).toHaveLength(0);
  });

  it('COMP_REF_NOT_COMPENSABLE também cobre o end-throw com activityRef', () => {
    const diagram = graph({
      hotel: node('hotel', 'serviceTask', {}, 'H'),
      end: node('end', 'endEvent', { eventDefinition: 'compensate', compensateActivityRef: 'hotel' }),
    });
    expect(compRefNotCompensableRule(diagram)).toHaveLength(1);
  });

  it('o quick-fix é null fora do contrato (nó não-compensate; host ausente)', () => {
    // nodeId aponta um nó que não é boundary de compensação → o guard do fix devolve null.
    const notComp = graph({ t: node('t', 'task', {}, 'T') });
    const findingNotComp = {
      code: 'COMP_BOUNDARY_NO_HANDLER',
      severity: 'error' as const,
      nodeId: 't',
      ruleId: 'comp-boundary-no-handler',
      profileId: 'lint-etiquette',
      source: 'etiquette' as const,
      fixable: true,
      message: '',
    };
    expect(fixCommandFor(notComp, findingNotComp, [ETIQUETTE_PROFILE])).toBeNull();
    // boundary de compensação SEM host (attachedToRef inexistente) → null.
    const noHost = graph({ bnd: node('bnd', 'boundaryEvent', { attachedToRef: 'ghost', eventDefinition: 'compensate' }, 'B') });
    const finding = lintFindings(noHost, [ETIQUETTE_PROFILE]).find((f) => f.code === 'COMP_BOUNDARY_NO_HANDLER')!;
    expect(fixCommandFor(noHost, finding, [ETIQUETTE_PROFILE])).toBeNull();
  });

  it('compensationHandlerCommands aceita um nome de handler (forma da paleta)', () => {
    const diagram = graph({
      hotel: node('hotel', 'serviceTask', {}, 'H'),
      bnd: node('bnd', 'boundaryEvent', { attachedToRef: 'hotel', eventDefinition: 'compensate' }, 'B'),
    });
    const { commands, handlerId } = compensationHandlerCommands(diagram, {
      boundary: diagram.nodes.bnd,
      host: diagram.nodes.hotel,
      handlerName: 'Cancelar reserva',
    });
    const next = commands.reduce((d, c) => c.execute(d), diagram);
    expect(next.nodes[handlerId].label).toBe('Cancelar reserva');
    expect(next.nodes[handlerId].properties.isForCompensation).toBe(true);
  });
});

describe('reforço 8 — EVT_REF_MISSING NUNCA dispara para compensação', () => {
  it('um evento de compensação (sem eventDefinitionRef) não gera EVT_REF_MISSING', () => {
    // A "ref" da compensação é o activityRef (COMP_REF_NOT_COMPENSABLE), não uma
    // definição nomeada — então EVT_REF_MISSING (message/signal/error/escalation)
    // nunca o acusa, mesmo sem ref.
    const diagram = graph({
      thr: node('thr', 'intermediateThrowEvent', { eventDefinition: 'compensate' }),
      bnd: node('bnd', 'boundaryEvent', { attachedToRef: 'thr', eventDefinition: 'compensate' }),
    });
    expect(evtRefMissingRule(diagram).some((i) => i.code === 'EVT_REF_MISSING')).toBe(false);
  });
});
