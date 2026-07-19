import { describe, expect, it } from 'vitest';
import { createNode, type BpmnDiagram } from '@buildtovalue/core';
import { canonicalizeScenario, SimulationEngine } from '../src/index.js';
import { flow } from './fixtures.js';

/**
 * Handoff 19 §6d — compensate(scope|activityRef): SÓ atividades COMPLETADAS (da
 * trilha), ordem REVERSA nomeada; completada sem handler = linha declarada; nada
 * completado = sem ação; específica não-compensável/incompleta = parada
 * declarada; waitForCompletion declarado; esub ⟲ só no broadcast (reforço 9);
 * card com a CONTAGEM (reforço 10); replay bit a bit; compat.
 */

/** Attaches a ⟲ boundary on `activityId` + a handler + the association. */
function addComp(d: BpmnDiagram, activityId: string, handlerLabel: string): void {
  const bId = `b_${activityId}`;
  const hId = `h_${activityId}`;
  d.nodes[bId] = createNode({
    id: bId,
    type: 'boundaryEvent',
    label: `⟲ ${activityId}`,
    x: 0,
    y: 0,
    properties: { attachedToRef: activityId, eventDefinition: 'compensate' },
  });
  d.nodes[hId] = createNode({
    id: hId,
    type: 'serviceTask',
    label: handlerLabel,
    x: 0,
    y: 0,
    properties: { isForCompensation: true },
  });
  d.edges[`a_${activityId}`] = {
    id: `a_${activityId}`,
    type: 'association',
    sourceId: bId,
    targetId: hId,
    properties: {},
    createdInVersion: '0',
    audit: { createdAt: '2026-07-19T00:00:00.000Z', createdBy: 'test', history: [] },
  } as BpmnDiagram['edges'][string];
}

/** Advances the engine N free steps. */
function step(engine: SimulationEngine, n: number): void {
  for (let i = 0; i < n && engine.canAdvance; i++) engine.advance();
}

const trailText = (engine: SimulationEngine) => engine.state.trail.map((t) => t.message).join('\n');

/** 4 activities in a line, each compensable; token advanced so 3 completed. */
function fourInLine(extra?: (d: BpmnDiagram) => void): BpmnDiagram {
  return flow(
    ['s:startEvent', 'a1:task', 'a2:task', 'a3:task', 'a4:task', 'e:endEvent'],
    ['s->a1', 'a1->a2', 'a2->a3', 'a3->a4', 'a4->e'],
    (d) => {
      addComp(d, 'a1', 'Estornar 1');
      addComp(d, 'a2', 'Estornar 2');
      addComp(d, 'a3', 'Estornar 3');
      // a4 has NO handler → declared, not compensated.
      extra?.(d);
    },
  );
}

describe('broadcast — reverso, pós-conclusão, honesto (§6d pontos 1–2)', () => {
  it('só as COMPLETADAS, em ordem REVERSA nomeada; a4 sem handler = declarada', () => {
    const engine = new SimulationEngine(fourInLine());
    step(engine, 4); // s→a1→a2→a3→a4: a1,a2,a3 completaram; a4 tem o token (incompleta)
    engine.compensate();
    const trail = trailText(engine);
    // Ordem reversa: a3, a2, a1 (as completadas), cada linha nomeando handler.
    expect(trail).toContain('1. Compensate "a3" → handler "Estornar 3" (reverse order)');
    expect(trail).toContain('2. Compensate "a2" → handler "Estornar 2" (reverse order)');
    expect(trail).toContain('3. Compensate "a1" → handler "Estornar 1" (reverse order)');
    // a4 não completou → nem aparece como compensada.
    expect(trail).not.toContain('Estornar 4');
    // Os handlers ganham token (a reversão é visível).
    const ids = engine.state.tokens.map((t) => t.nodeId);
    expect(ids).toEqual(expect.arrayContaining(['h_a1', 'h_a2', 'h_a3']));
  });

  it('completada SEM handler = linha declarada, nunca silêncio', () => {
    const diagram = flow(
      ['s:startEvent', 'a1:task', 'a2:task', 'e:endEvent'],
      ['s->a1', 'a1->a2', 'a2->e'],
      (d) => addComp(d, 'a1', 'Estornar 1'), // a2 sem handler
    );
    const engine = new SimulationEngine(diagram);
    step(engine, 3); // a1, a2 completaram
    engine.compensate();
    const trail = trailText(engine);
    expect(trail).toContain('Compensate "a1" → handler "Estornar 1"');
    expect(trail).toContain('"a2" completed, no handler ⟲ — not compensated (declared)');
  });

  it('nada completado = card desabilitado (handlerCount 0) e compensate não reverte', () => {
    const engine = new SimulationEngine(fourInLine());
    engine.advance(); // s→a1: a1 tem o token, nada completou ainda
    const card = engine.state.compensateCard!;
    const broadcast = card.options[0].destination;
    expect(broadcast).toMatchObject({ kind: 'broadcast', handlerCount: 0 });
    engine.compensate();
    expect(trailText(engine)).toContain('no completed compensable activity — nothing to compensate');
  });
});

describe('específica ⇄ broadcast (§6d ponto 2 + reforço 9)', () => {
  it('compensate(activityRef) dispara SÓ aquele handler; esub-start NÃO participa', () => {
    const engine = new SimulationEngine(
      fourInLine((d) => {
        // Um event subprocess de compensação no escopo.
        d.nodes.esub = createNode({ id: 'esub', type: 'subProcess', label: 'Reverter tudo', x: 0, y: 0, properties: { triggeredByEvent: true } });
        d.nodes.est = createNode({ id: 'est', type: 'startEvent', label: 'est', x: 0, y: 0, properties: { parentId: 'esub', eventDefinition: 'compensate' } });
      }),
    );
    step(engine, 4);
    engine.compensate(undefined, 'a2'); // específica
    const ids = engine.state.tokens.map((t) => t.nodeId);
    expect(ids).toContain('h_a2'); // só o handler de a2
    expect(ids).not.toContain('h_a1');
    expect(ids).not.toContain('esub'); // reforço 9: esub-start NÃO participa da específica
  });

  it('broadcast dispara os handlers E o esub-start do escopo (juntos, sem tiers)', () => {
    const engine = new SimulationEngine(
      fourInLine((d) => {
        d.nodes.esub = createNode({ id: 'esub', type: 'subProcess', label: 'Reverter tudo', x: 0, y: 0, properties: { triggeredByEvent: true } });
        d.nodes.est = createNode({ id: 'est', type: 'startEvent', label: 'est', x: 0, y: 0, properties: { parentId: 'esub', eventDefinition: 'compensate' } });
      }),
    );
    step(engine, 4);
    engine.compensate();
    const ids = engine.state.tokens.map((t) => t.nodeId);
    expect(ids).toEqual(expect.arrayContaining(['h_a1', 'h_a2', 'h_a3', 'esub']));
  });

  it('específica não-compensável / não-completada = parada declarada', () => {
    const engine = new SimulationEngine(fourInLine());
    step(engine, 4);
    // a4 completou? não (token nele). E não tem handler → parada.
    engine.compensate(undefined, 'a4');
    expect(engine.state.blockedDecision?.reason).toMatch(/no compensation handler/);
  });
});

describe('waitForCompletion declarado na trilha (§6d ponto 3)', () => {
  it('true (default) e false geram a linha declarada correspondente', () => {
    const t = new SimulationEngine(fourInLine());
    step(t, 4);
    t.compensate(undefined, undefined, true);
    expect(trailText(t)).toContain('waitForCompletion: true — the throw advances only after the handlers complete');
    const f = new SimulationEngine(fourInLine());
    step(f, 4);
    f.compensate(undefined, undefined, false);
    expect(trailText(f)).toContain('waitForCompletion: false — the throw advances immediately');
  });
});

describe('card «Compensar» — contagem + não-elegíveis (§6d ponto 6 + reforço 10)', () => {
  it('broadcast mostra a CONTAGEM; incompletas listadas como não-elegíveis com razão', () => {
    const engine = new SimulationEngine(fourInLine());
    step(engine, 4); // a1,a2,a3 completas; a4 incompleta (e sem handler)
    const card = engine.state.compensateCard!;
    expect(card.options[0].destination).toMatchObject({ kind: 'broadcast', handlerCount: 3 });
    const a1 = card.options.find((o) => o.activityRef === 'a1')!;
    expect(a1.destination).toMatchObject({ kind: 'activity', handlerLabel: 'Estornar 1' });
    // a4 não tem boundary ⟲ → nem é compensável → não está no card.
    expect(card.options.some((o) => o.activityRef === 'a4')).toBe(false);
  });

  it('atividade compensável mas INCOMPLETA aparece como notEligible', () => {
    const engine = new SimulationEngine(fourInLine());
    engine.advance(); // s→a1: nada completou
    const card = engine.state.compensateCard!;
    const a1 = card.options.find((o) => o.activityRef === 'a1')!;
    expect(a1.destination).toMatchObject({ kind: 'notEligible', reason: 'not yet completed' });
  });
});

describe('compensationPlan — read-only + forma (§6e reforço 7)', () => {
  it('chamá-lo N vezes NÃO muda estado nem trilha; só compensate() grava', () => {
    const engine = new SimulationEngine(fourInLine());
    step(engine, 4);
    const trailBefore = trailText(engine);
    const tokensBefore = engine.state.tokens.map((t) => t.nodeId).sort();
    const p1 = engine.compensationPlan();
    const p2 = engine.compensationPlan();
    expect(p1).toEqual(p2); // determinístico
    // Nada mudou.
    expect(trailText(engine)).toBe(trailBefore);
    expect(engine.state.tokens.map((t) => t.nodeId).sort()).toEqual(tokensBefore);
    // O plano bate com o que o compensate() executa (compensated/uncompensated).
    expect(p1.compensated.map((c) => c.activity)).toEqual(['a3', 'a2', 'a1']);
  });

  it('específica não-compensável = blocked no plano (nenhum step)', () => {
    const engine = new SimulationEngine(fourInLine());
    step(engine, 4);
    const plan = engine.compensationPlan('a4'); // a4 sem handler
    expect(plan.blocked).toMatchObject({ kind: 'no-handler' });
    expect(plan.steps).toHaveLength(0);
    expect(plan.compensated).toHaveLength(0);
  });
});

describe('cobertura dos ramos declarados', () => {
  it('específica compensável mas NÃO completada = parada declarada (ramo distinto)', () => {
    const engine = new SimulationEngine(fourInLine());
    engine.advance(); // s→a1: a1 tem handler mas ainda NÃO completou
    engine.compensate(undefined, 'a1');
    expect(engine.state.blockedDecision?.reason).toMatch(/has not completed/);
  });

  it('boundary ⟲ SEM associação = sem handler: card notEligible e específica bloqueia', () => {
    const diagram = flow(
      ['s:startEvent', 'a1:task', 'e:endEvent'],
      ['s->a1', 'a1->e'],
      (d) => {
        // ⟲ boundary mas NENHUMA associação → handler não resolve.
        d.nodes.b1 = createNode({ id: 'b1', type: 'boundaryEvent', label: '⟲ a1', x: 0, y: 0, properties: { attachedToRef: 'a1', eventDefinition: 'compensate' } });
      },
    );
    const engine = new SimulationEngine(diagram);
    step(engine, 2); // a1 completou
    const opt = engine.state.compensateCard!.options.find((o) => o.activityRef === 'a1')!;
    expect(opt.destination).toMatchObject({ kind: 'notEligible', reason: 'no handler' });
    engine.compensate(undefined, 'a1');
    expect(engine.state.blockedDecision?.reason).toMatch(/no compensation handler/);
  });

  it('canonicalize da compensate com scope + activityRef + waitForCompletion false', () => {
    const engine = new SimulationEngine(fourInLine());
    step(engine, 4);
    engine.compensate('top', 'a2', false);
    const canonical = canonicalizeScenario(engine.scenario);
    expect(canonical).toContain('"scope":"top"');
    expect(canonical).toContain('"activityRef":"a2"');
    expect(canonical).toContain('"waitForCompletion":false');
  });
});

describe('replay bit a bit + compat (§6d ponto 5)', () => {
  it('a decisão compensate serializa (com atStep) e replaya idêntico', () => {
    const build = () => fourInLine();
    const engine = new SimulationEngine(build());
    step(engine, 4);
    engine.compensate();
    let guard = 0;
    while (engine.canAdvance && guard++ < 100) engine.advance();
    const canonical = canonicalizeScenario(engine.scenario);
    expect(canonical).toContain('"kind":"compensate"');
    expect(canonical).toContain('"atStep":4');
    const replayed = SimulationEngine.replay(build(), engine.scenario);
    expect(replayed.transitions).toEqual(engine.transitions);
    expect(replayed.complete).toBe(engine.complete);
  });
});
