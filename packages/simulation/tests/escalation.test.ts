import { describe, expect, it } from 'vitest';
import { createNode, type BpmnDiagram } from '@buildtovalue/core';
import { canonicalizeScenario, SimulationEngine } from '../src/index.js';
import { flow } from './fixtures.js';

/**
 * Handoff 18 §5e — throwEscalation com a ordem total da ES-5 (construída SOBRE
 * eligibleEscalationCatches do core), o CONTRASTE vinculante (dissolve ≠ parada
 * do erro), a matriz de combinações do catch (reforço 8: catchKind × modo) e o
 * destino previsto no card (reforço 7). gov-* idêntico; replay bit a bit; compat.
 */

/** Binds a boundary escalation catch on `host`. NI = cancelActivity:false. */
function bindBoundary(
  d: BpmnDiagram,
  id: string,
  opts: { ref?: string; interrupting?: boolean } = {},
): void {
  d.nodes[id] = {
    ...d.nodes[id],
    properties: {
      ...d.nodes[id].properties,
      attachedToRef: 'host',
      eventDefinition: 'escalation',
      ...(opts.ref ? { eventDefinitionRef: opts.ref } : {}),
      ...(opts.interrupting === false ? { cancelActivity: false } : {}),
    },
  };
}

function addEscEsub(
  d: BpmnDiagram,
  id: string,
  startId: string,
  opts: { ref?: string; interrupting?: boolean } = {},
): void {
  d.nodes[id] = createNode({ id, type: 'subProcess', label: id, x: 0, y: 0, properties: { triggeredByEvent: true } });
  d.nodes[startId] = createNode({
    id: startId,
    type: 'startEvent',
    label: startId,
    x: 0,
    y: 0,
    properties: {
      parentId: id,
      eventDefinition: 'escalation',
      ...(opts.ref ? { eventDefinitionRef: opts.ref } : {}),
      ...(opts.interrupting === false ? { isInterrupting: false } : {}),
    },
  });
}

const escDefs = (d: BpmnDiagram, extra: string[] = []) => {
  d.definitions = {
    messages: [],
    signals: [],
    errors: [],
    escalations: [
      { id: 'esc-1', name: 'Acima da alçada', escalationCode: 'OVER' },
      { id: 'esc-2', name: 'Outra', escalationCode: 'X' },
      ...extra.map((id) => ({ id, name: id })),
    ],
  };
};

const atHost = (engine: SimulationEngine) => engine.advance(); // s -> host
const tokenIds = (engine: SimulationEngine) => engine.state.tokens.map((t) => t.nodeId).sort();

describe('ordem total (§5e ponto 1)', () => {
  it('exact ref → o boundary de esc-1; esub-exact VENCE boundary-exact do mesmo ref', () => {
    const diagram = flow(
      ['s:startEvent', 'host:task', 'e:endEvent', 'b1:boundaryEvent', 'r1:task', 'f1:endEvent'],
      ['s->host', 'host->e', 'b1->r1', 'r1->f1'],
      (d) => {
        escDefs(d);
        bindBoundary(d, 'b1', { ref: 'esc-1', interrupting: false });
        addEscEsub(d, 'esub', 'st', { ref: 'esc-1' }); // mesmo ref → esub VENCE
      },
    );
    const engine = new SimulationEngine(diagram);
    atHost(engine);
    const r = engine.throwEscalation('host', 'esc-1');
    // O esub (tier 1) vence o boundary (tier 2): a trilha nomeia o event subprocess.
    expect(r.transitions.some((t) => /event subprocess "esub"/.test(t.message))).toBe(true);
    expect(engine.state.blockedDecision).toBeNull();
  });

  it('duplicata no tier vencedor = BlockedDecision nomeando candidatos', () => {
    const diagram = flow(
      ['s:startEvent', 'host:task', 'e:endEvent', 'b1:boundaryEvent', 'b2:boundaryEvent', 'r1:task', 'r2:task', 'f1:endEvent', 'f2:endEvent'],
      ['s->host', 'host->e', 'b1->r1', 'b2->r2', 'r1->f1', 'r2->f2'],
      (d) => {
        escDefs(d);
        bindBoundary(d, 'b1', { ref: 'esc-1', interrupting: false });
        bindBoundary(d, 'b2', { ref: 'esc-1', interrupting: false }); // MESMO ref → ambíguo
      },
    );
    const engine = new SimulationEngine(diagram);
    atHost(engine);
    engine.throwEscalation('host', 'esc-1');
    expect(engine.state.blockedDecision?.reason).toMatch(/ambiguous catch/);
    expect(engine.state.blockedDecision?.reason).toContain('b1');
    expect(engine.state.blockedDecision?.reason).toContain('b2');
  });
});

describe('CONTRASTE vinculante dissolve ≠ parada (§5e ponto 2, cerca §5)', () => {
  it('escalação SEM destino = dissolve DECLARADO; o token do host SEGUE (nunca bloqueia)', () => {
    const diagram = flow(['s:startEvent', 'host:task', 'e:endEvent'], ['s->host', 'host->e'], escDefs);
    const engine = new SimulationEngine(diagram);
    atHost(engine);
    const r = engine.throwEscalation('host', 'esc-1');
    expect(r.transitions.some((t) => /escalation dissolves \(OMG\)/.test(t.message))).toBe(true);
    expect(engine.state.blockedDecision).toBeNull(); // NÃO é parada
    expect(tokenIds(engine)).toContain('host'); // o token do host segue
  });

  it('LADO A LADO: erro sem destino = parada declarada (o token para)', () => {
    const diagram = flow(['s:startEvent', 'host:task', 'e:endEvent'], ['s->host', 'host->e'], (d) => {
      d.definitions = { messages: [], signals: [], errors: [{ id: 'err-x', name: 'X' }], escalations: [] };
    });
    const engine = new SimulationEngine(diagram);
    atHost(engine);
    engine.throwError('host', 'err-x');
    expect(engine.state.blockedDecision?.reason).toMatch(/parent-scope propagation is not simulated/);
  });
});

describe('matriz do catch: catchKind × modo (§5e reforço 8)', () => {
  it('boundary NÃO-interrupting: host SEGUE + token paralelo no catch', () => {
    const diagram = flow(
      ['s:startEvent', 'host:task', 'e:endEvent', 'b1:boundaryEvent', 'r1:task', 'f1:endEvent'],
      ['s->host', 'host->e', 'b1->r1', 'r1->f1'],
      (d) => { escDefs(d); bindBoundary(d, 'b1', { ref: 'esc-1', interrupting: false }); },
    );
    const engine = new SimulationEngine(diagram);
    atHost(engine);
    engine.throwEscalation('host', 'esc-1');
    const ids = tokenIds(engine);
    expect(ids).toContain('host'); // host SEGUE
    expect(ids).toContain('b1'); // token PARALELO re-emerge no catch
  });

  it('boundary INTERRUPTING: cancela o host; o token re-emerge no catch', () => {
    const diagram = flow(
      ['s:startEvent', 'host:task', 'e:endEvent', 'b1:boundaryEvent', 'r1:task', 'f1:endEvent'],
      ['s->host', 'host->e', 'b1->r1', 'r1->f1'],
      (d) => { escDefs(d); bindBoundary(d, 'b1', { ref: 'esc-1' }); }, // interrupting (default)
    );
    const engine = new SimulationEngine(diagram);
    atHost(engine);
    engine.throwEscalation('host', 'esc-1');
    expect(tokenIds(engine)).not.toContain('host'); // host cancelado
    expect(tokenIds(engine)).toContain('b1'); // re-emerge no catch
  });

  it('esub-start NÃO-interrupting: token paralelo no contêiner; o escopo (host) SEGUE', () => {
    const diagram = flow(
      ['s:startEvent', 'host:task', 'e:endEvent'],
      ['s->host', 'host->e'],
      (d) => { escDefs(d); addEscEsub(d, 'esub', 'st', { ref: 'esc-1', interrupting: false }); },
    );
    const engine = new SimulationEngine(diagram);
    atHost(engine);
    engine.throwEscalation('host', 'esc-1');
    const ids = tokenIds(engine);
    expect(ids).toContain('host'); // escopo segue
    expect(ids).toContain('esub'); // token paralelo no contêiner
  });

  it('esub-start INTERRUPTING: cancela nomeando contagem + escopo (caminho ES-5)', () => {
    const diagram = flow(
      ['s:startEvent', 'host:task', 'e:endEvent'],
      ['s->host', 'host->e'],
      (d) => { escDefs(d); addEscEsub(d, 'esub', 'st', { ref: 'esc-1' }); }, // interrupting default
    );
    const engine = new SimulationEngine(diagram);
    atHost(engine);
    const r = engine.throwEscalation('host', 'esc-1');
    expect(r.transitions.some((t) => /interrupting: \d+ token/.test(t.message))).toBe(true);
    expect(tokenIds(engine)).toContain('esub');
    expect(tokenIds(engine)).not.toContain('host');
  });
});

describe('card «Escalar» — destino previsto (§5e reforço 7)', () => {
  it('cada opção mostra o catch e o modo; ambíguo é declarado ANTES do disparo', () => {
    const diagram = flow(
      ['s:startEvent', 'host:task', 'e:endEvent', 'b1:boundaryEvent', 'r1:task', 'f1:endEvent'],
      ['s->host', 'host->e', 'b1->r1', 'r1->f1'],
      (d) => { escDefs(d); bindBoundary(d, 'b1', { ref: 'esc-1', interrupting: false }); },
    );
    const engine = new SimulationEngine(diagram);
    atHost(engine);
    const card = engine.state.escalationThrowOptions.find((c) => c.host === 'host')!;
    const opt = card.options.find((o) => o.escalationRef === 'esc-1')!;
    expect(opt.destination).toMatchObject({ kind: 'boundary', label: 'b1', interrupting: false });
    // A opção não catalogada: sem destino → dissolve previsto.
    const uncat = card.options.find((o) => o.escalationRef === undefined)!;
    expect(uncat.destination.kind).toBe('dissolve');
  });
});

describe('gov-* + replay + compat (§5e ponto 4)', () => {
  it('espelho gov-* resolve idêntico à definição comum', () => {
    const diagram = flow(
      ['s:startEvent', 'host:task', 'e:endEvent', 'b1:boundaryEvent', 'r1:task', 'f1:endEvent'],
      ['s->host', 'host->e', 'b1->r1', 'r1->f1'],
      (d) => {
        d.definitions = { messages: [], signals: [], errors: [], escalations: [{ id: 'gov-alcada', name: 'Alçada' }] };
        bindBoundary(d, 'b1', { ref: 'gov-alcada', interrupting: false });
      },
    );
    const engine = new SimulationEngine(diagram);
    atHost(engine);
    engine.throwEscalation('host', 'gov-alcada');
    expect(tokenIds(engine)).toContain('b1');
  });

  it('replay bit a bit: a decisão de escalação serializa e replaya idêntico', () => {
    const build = () =>
      flow(
        ['s:startEvent', 'host:task', 'e:endEvent', 'b1:boundaryEvent', 'r1:task', 'f1:endEvent'],
        ['s->host', 'host->e', 'b1->r1', 'r1->f1'],
        (d) => { escDefs(d); bindBoundary(d, 'b1', { ref: 'esc-1', interrupting: false }); },
      );
    const engine = new SimulationEngine(build());
    atHost(engine);
    engine.throwEscalation('host', 'esc-1');
    let guard = 0;
    while (engine.canAdvance && guard++ < 100) engine.advance();
    const canonical = canonicalizeScenario(engine.scenario);
    expect(canonical).toContain('{"kind":"escalation","host":"host","escalationRef":"esc-1"}');
    // Replay do MESMO cenário → mesma trilha final, bit a bit.
    const replayed = SimulationEngine.replay(build(), engine.scenario);
    expect(replayed.transitions).toEqual(engine.transitions);
    expect(replayed.complete).toBe(engine.complete);
  });
});
