import { describe, expect, it } from 'vitest';
import { createDiagram, createNode, type BpmnDiagram } from '@buildtovalue/core';
import {
  ETIQUETTE_PROFILE,
  EXECUTABILITY_PROFILE,
  evtEndCatchRule,
  evtErrorStartToplevelRule,
  evtRefMissingRule,
  evtStartThrowRule,
  fixCommandFor,
  lintFindings,
  timerMalformedRule,
} from '../src/index.js';

/**
 * Handoff 16 E-5 — regras EVT_* e TIMER_* (§3d, critérios 3–5) + reforço 9
 * (quick-fix cria definição do KIND do evento, nunca genérica).
 */
function withNodes(nodes: BpmnDiagram['nodes']): BpmnDiagram {
  const diagram = createDiagram({ name: 'Eventos' });
  diagram.nodes = nodes;
  return diagram;
}

const node = (
  id: string,
  type: string,
  properties: Record<string, unknown>,
  label = id,
): ReturnType<typeof createNode> => createNode({ id, type, label, x: 0, y: 0, properties });

describe('EVT_* etiquette rules (critério 3)', () => {
  it('EVT_START_THROW: start com kind terminate/link; kinds de captura passam', () => {
    const diagram = withNodes({
      bad1: node('bad1', 'startEvent', { eventDefinition: 'terminate' }),
      bad2: node('bad2', 'startEvent', { eventDefinition: 'link' }),
      ok: node('ok', 'startEvent', { eventDefinition: 'message' }),
      plain: node('plain', 'startEvent', {}),
    });
    const issues = evtStartThrowRule(diagram);
    expect(issues.map((issue) => issue.nodeId).sort()).toEqual(['bad1', 'bad2']);
    expect(issues[0].code).toBe('EVT_START_THROW');
    expect(issues[0].severity).toBe('error');
  });

  it('EVT_END_CATCH: end com kind timer/conditional/link; message/signal/error/terminate passam', () => {
    const diagram = withNodes({
      bad1: node('bad1', 'endEvent', { eventDefinition: 'timer' }),
      bad2: node('bad2', 'endEvent', { eventDefinition: 'conditional' }),
      bad3: node('bad3', 'endEvent', { eventDefinition: 'link' }),
      ok1: node('ok1', 'endEvent', { eventDefinition: 'message' }),
      ok2: node('ok2', 'endEvent', { eventDefinition: 'terminate' }),
    });
    const issues = evtEndCatchRule(diagram);
    expect(issues.map((issue) => issue.nodeId).sort()).toEqual(['bad1', 'bad2', 'bad3']);
    expect(issues[0].code).toBe('EVT_END_CATCH');
  });

  it('EVT_ERROR_START_TOPLEVEL APERTADO (ES-4): só EVENT subprocess legitima; comum e topo acusam', () => {
    // Migração da E-5 (decisão 2 da ES-0): o caso `nested` que aceitava
    // subProcess COMUM virou o POSITIVO do aperto; o event subprocess passa.
    const diagram = withNodes({
      top: node('top', 'startEvent', { eventDefinition: 'error' }),
      sub: node('sub', 'subProcess', { triggeredByEvent: true }),
      inEventSub: node('inEventSub', 'startEvent', { eventDefinition: 'error', parentId: 'sub' }),
      common: node('common', 'subProcess', {}),
      nested: node('nested', 'startEvent', { eventDefinition: 'error', parentId: 'common' }),
    });
    const issues = evtErrorStartToplevelRule(diagram);
    expect(issues.map((issue) => issue.nodeId).sort()).toEqual(['nested', 'top']);
    expect(issues[0].code).toBe('EVT_ERROR_START_TOPLEVEL');
    expect(issues[0].message).toContain('outside an event subprocess');
  });
});

describe('EVT_REF_MISSING + quick-fix por kind (critério 4, reforço 9)', () => {
  it('warning para message/signal/error de EVENTO sem ref; com ref passa', () => {
    const diagram = withNodes({
      m: node('m', 'intermediateCatchEvent', { eventDefinition: 'message' }),
      ok: node('ok', 'intermediateCatchEvent', {
        eventDefinition: 'message',
        eventDefinitionRef: 'msg-9',
      }),
      timer: node('timer', 'intermediateCatchEvent', { eventDefinition: 'timer' }),
      task: node('task', 'task', { eventDefinition: 'message' }), // não é evento
    });
    const issues = evtRefMissingRule(diagram);
    expect(issues.map((issue) => issue.nodeId)).toEqual(['m']);
    expect(issues[0]).toMatchObject({ code: 'EVT_REF_MISSING', severity: 'warning' });
  });

  it('reforço 9 — o fix cria a definição do KIND do evento (nunca genérica) e referencia em 1 composto', () => {
    for (const [kind, bucket, name] of [
      ['message', 'messages', 'New message'],
      ['signal', 'signals', 'New signal'],
      ['error', 'errors', 'New error'],
    ] as const) {
      const diagram = withNodes({
        ev: node('ev', 'intermediateCatchEvent', { eventDefinition: kind }),
      });
      const findings = lintFindings(diagram, [EXECUTABILITY_PROFILE]);
      const finding = findings.find((candidate) => candidate.code === 'EVT_REF_MISSING')!;
      expect(finding.fixable).toBe(true);
      const command = fixCommandFor(diagram, finding, [EXECUTABILITY_PROFILE])!;
      const fixed = command.execute(diagram);
      // Definição no BUCKET do kind, com errorCode vazio (ausente) no erro.
      const prefix = kind === 'message' ? 'msg' : kind === 'signal' ? 'sig' : 'err';
      expect(fixed.definitions?.[bucket]).toEqual([{ id: `${prefix}-1`, name }]);
      for (const other of ['messages', 'signals', 'errors'].filter((b) => b !== bucket)) {
        expect(fixed.definitions?.[other as 'messages'] ?? []).toEqual([]);
      }
      expect(fixed.nodes.ev.properties.eventDefinitionRef).toBe(`${prefix}-1`);
      // 1 undo (composto) reverte definição E referência.
      const undone = command.undo!(fixed);
      expect(undone.nodes.ev.properties.eventDefinitionRef).toBeUndefined();
      expect(undone.definitions?.[bucket] ?? []).toEqual([]);
    }
  });
});

describe('TIMER_MALFORMED via o parser (critério 5)', () => {
  it('expressão inválida para o kind é erro nomeando a expressão; ausente/válida passam', () => {
    const diagram = withNodes({
      bad: node('bad', 'intermediateCatchEvent', {
        eventDefinition: 'timer',
        timer: { kind: 'duration', expression: 'P1H' },
      }),
      ok: node('ok', 'intermediateCatchEvent', {
        eventDefinition: 'timer',
        timer: { kind: 'duration', expression: 'PT1H' },
      }),
      abstract: node('abstract', 'intermediateCatchEvent', { eventDefinition: 'timer' }),
    });
    const issues = timerMalformedRule(diagram);
    expect(issues.map((issue) => issue.nodeId)).toEqual(['bad']);
    expect(issues[0].code).toBe('TIMER_MALFORMED');
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('"P1H"');
    expect(timerMalformedRule(diagram).find((issue) => issue.nodeId === 'bad')).toBeDefined();
  });

  it('sem quick-fix: adivinhar a intenção não é mecânico', () => {
    const diagram = withNodes({
      bad: node('bad', 'intermediateCatchEvent', {
        eventDefinition: 'timer',
        timer: { kind: 'duration', expression: 'P1H' },
      }),
    });
    const finding = lintFindings(diagram, [EXECUTABILITY_PROFILE]).find(
      (candidate) => candidate.code === 'TIMER_MALFORMED',
    )!;
    expect(finding.fixable).toBe(false);
    expect(fixCommandFor(diagram, finding, [EXECUTABILITY_PROFILE])).toBeNull();
  });
});

describe('política versionada (critério 7)', () => {
  it('regras novas = versão nova dos perfis (1.1.0), refletida na MESMA fonte', () => {
    expect(ETIQUETTE_PROFILE.version).toBe('1.4.0'); // Handoff 18 §5d (escalation)
    expect(EXECUTABILITY_PROFILE.version).toBe('1.4.0');
    expect(ETIQUETTE_PROFILE.rules.map((rule) => rule.id)).toContain('evt-start-throw');
    expect(EXECUTABILITY_PROFILE.rules.map((rule) => rule.id)).toContain('timer-malformed');
  });
});
