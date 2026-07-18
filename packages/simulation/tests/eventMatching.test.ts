import { describe, expect, it } from 'vitest';
import type { BpmnDiagram } from '@buildtovalue/core';
import { canonicalizeScenario, SimulationEngine, SimulationError } from '../src/index.js';
import { flow } from './fixtures.js';

/**
 * Handoff 16 E-6 — matching honesto (§3e): errorRef exato vs catch-all
 * DECLARADO com precedência documentada (critérios 1–2), broadcast de sinal e
 * destino único de mensagem com correlação >1 = parada honesta (critério 3),
 * espelho gov-* com matching idêntico (reforço 9), cenário/replay (critério 6)
 * e compat do fireBoundary com cenários antigos (critério 4).
 */

/** host com boundaries de erro: b1→err-x, b2→err-y, ball = catch-all. */
function errorFixture(extra?: (d: BpmnDiagram) => void): BpmnDiagram {
  return flow(
    [
      's:startEvent', 'host:task', 'e:endEvent',
      'b1:boundaryEvent', 'b2:boundaryEvent', 'ball:boundaryEvent',
      'r1:task', 'r2:task', 'r3:task', 'f1:endEvent', 'f2:endEvent', 'f3:endEvent',
    ],
    ['s->host', 'host->e', 'b1->r1', 'b2->r2', 'ball->r3', 'r1->f1', 'r2->f2', 'r3->f3'],
    (d) => {
      d.definitions = {
        messages: [],
        signals: [],
        errors: [
          { id: 'err-x', name: 'Falha X' },
          { id: 'err-y', name: 'Falha Y' },
        ],
      };
      const bind = (id: string, ref?: string) => {
        d.nodes[id] = {
          ...d.nodes[id],
          properties: {
            ...d.nodes[id].properties,
            attachedToRef: 'host',
            eventDefinition: 'error',
            ...(ref ? { eventDefinitionRef: ref } : {}),
          },
        };
      };
      bind('b1', 'err-x');
      bind('b2', 'err-y');
      bind('ball');
      extra?.(d);
    },
  );
}

const advanceToHost = (engine: SimulationEngine) => {
  engine.advance(); // s -> host
};

describe('error matching (critérios 1–2)', () => {
  it('critério 1 — erro X dispara SÓ o boundary de X; a trilha nomeia o match', () => {
    const engine = new SimulationEngine(errorFixture());
    advanceToHost(engine);
    const result = engine.throwError('host', 'err-x');
    expect(result.transitions[0].type).toBe('event');
    expect(result.transitions[0].message).toContain('caught by boundary "b1"');
    expect(result.transitions[0].message).toContain('errorRef match "err-x"');
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['b1']);
    expect(engine.state.blockedDecision).toBeNull();
  });

  it('critério 1b — erro SEM específico cai no catch-all, NOMEADO na trilha (nunca silencioso)', () => {
    const engine = new SimulationEngine(errorFixture());
    advanceToHost(engine);
    const result = engine.throwError('host', 'err-z');
    expect(result.transitions[0].message).toContain('caught by boundary "ball"');
    expect(result.transitions[0].message).toContain('DECLARED catch-all');
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['ball']);
    // Erro não catalogado (reforço 10 — o caminho do card) idem.
    const engine2 = new SimulationEngine(errorFixture());
    advanceToHost(engine2);
    const result2 = engine2.throwError('host');
    expect(result2.transitions[0].message).toContain('uncatalogued error');
    expect(result2.transitions[0].message).toContain('caught by boundary "ball"');
  });

  it('critério 2 — específico VENCE catch-all (precedência: NÃO é ambiguidade)', () => {
    const engine = new SimulationEngine(errorFixture());
    advanceToHost(engine);
    engine.throwError('host', 'err-y');
    // b2 (específico) e ball (catch-all) eram elegíveis — específico venceu.
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['b2']);
    expect(engine.state.blockedDecision).toBeNull();
  });

  it('critério 2b — dois específicos do MESMO erro = BlockedDecision nomeando nó + candidatos', () => {
    const engine = new SimulationEngine(
      errorFixture((d) => {
        // b2 passa a apontar TAMBÉM para err-x (duplicata genuína).
        d.nodes.b2 = {
          ...d.nodes.b2,
          properties: { ...d.nodes.b2.properties, eventDefinitionRef: 'err-x' },
        };
      }),
    );
    advanceToHost(engine);
    const result = engine.throwError('host', 'err-x');
    const blocked = engine.state.blockedDecision!;
    expect(blocked.nodeId).toBe('host');
    expect(blocked.reason).toContain('ambiguous');
    expect(blocked.reason).toContain('b1 ("b1")');
    expect(blocked.reason).toContain('b2 ("b2")');
    expect(result.transitions[0].type).toBe('decision-blocked');
    // Nada disparou — o token segue no host, parado (honesto).
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['host']);
    expect(engine.canAdvance).toBe(false);
  });

  it('critério 2c — não capturado (zero elegíveis) = parada declarada, nunca palpite', () => {
    const engine = new SimulationEngine(
      errorFixture((d) => {
        // Remove o catch-all: só específicos X e Y sobram.
        delete d.nodes.ball;
        delete d.nodes.r3;
        delete d.nodes.f3;
        for (const [id, edge] of Object.entries(d.edges)) {
          if (edge.sourceId === 'ball' || edge.sourceId === 'r3') delete d.edges[id];
        }
      }),
    );
    advanceToHost(engine);
    engine.throwError('host', 'err-z');
    const blocked = engine.state.blockedDecision!;
    expect(blocked.nodeId).toBe('host');
    expect(blocked.reason).toContain('caught by NO boundary');
    expect(blocked.reason).toContain('parent-scope propagation is not simulated');
  });
});

describe('reforço 9 — espelho gov-* (E-3) faz matching idêntico ao local', () => {
  it('boundary com errorRef para definição espelhada dispara pelo MESMO caminho', () => {
    const engine = new SimulationEngine(
      errorFixture((d) => {
        // A definição vem da Biblioteca: espelho gov-* (E-3) no bucket errors.
        d.definitions!.errors.push({ id: 'gov-pagamento.recusado', name: 'Pagamento recusado' });
        d.nodes.b1 = {
          ...d.nodes.b1,
          properties: { ...d.nodes.b1.properties, eventDefinitionRef: 'gov-pagamento.recusado' },
        };
      }),
    );
    advanceToHost(engine);
    const result = engine.throwError('host', 'gov-pagamento.recusado');
    expect(result.transitions[0].message).toContain('errorRef match "gov-pagamento.recusado"');
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['b1']);
    // E o card resolve o NOME do espelho para o rótulo.
    const engine2 = new SimulationEngine(
      errorFixture((d) => {
        d.definitions!.errors.push({ id: 'gov-pagamento.recusado', name: 'Pagamento recusado' });
        d.nodes.b1 = {
          ...d.nodes.b1,
          properties: { ...d.nodes.b1.properties, eventDefinitionRef: 'gov-pagamento.recusado' },
        };
      }),
    );
    advanceToHost(engine2);
    const card = engine2.errorThrowOptions.find((c) => c.host === 'host')!;
    expect(card.options).toContainEqual({
      errorRef: 'gov-pagamento.recusado',
      label: 'Pagamento recusado',
    });
    // A opção NÃO catalogada (reforço 10) está sempre lá.
    expect(card.options.at(-1)).toEqual({});
  });
});

/** dois catches de sinal + um de mensagem aguardando (tokens parados neles). */
function catchesFixture(): BpmnDiagram {
  return flow(
    [
      's1:startEvent', 'c1:intermediateCatchEvent', 'f1:endEvent',
      's2:startEvent', 'c2:intermediateCatchEvent', 'f2:endEvent',
      's3:startEvent', 'c3:intermediateCatchEvent', 'f3:endEvent',
    ],
    ['s1->c1', 'c1->f1', 's2->c2', 'c2->f2', 's3->c3', 'c3->f3'],
    (d) => {
      d.definitions = {
        messages: [{ id: 'msg-1', name: 'Pedido aprovado' }],
        signals: [{ id: 'sig-1', name: 'Encerramento' }],
        errors: [],
      };
      const set = (id: string, kind: string, ref: string) => {
        d.nodes[id] = {
          ...d.nodes[id],
          properties: { eventDefinition: kind, eventDefinitionRef: ref },
        };
      };
      set('c1', 'signal', 'sig-1');
      set('c2', 'signal', 'sig-1');
      set('c3', 'message', 'msg-1');
    },
  );
}

describe('signal broadcast e message destino único (critério 3)', () => {
  it('sinal = broadcast: TODOS os catches em espera avançam; trilha nomeia a contagem', () => {
    const engine = new SimulationEngine(catchesFixture());
    engine.advance();
    engine.advance();
    engine.advance(); // três tokens: c1, c2, c3
    expect(engine.state.tokens.map((t) => t.nodeId).sort()).toEqual(['c1', 'c2', 'c3']);
    const result = engine.throwSignal('sig-1');
    expect(result.transitions[0].message).toContain('broadcast to 2 waiting catch(es)');
    // c1 e c2 avançaram; o catch de MENSAGEM (c3) não se move num sinal.
    expect(engine.state.tokens.map((t) => t.nodeId).sort()).toEqual(['c3', 'f1', 'f2']);
  });

  it('sinal sem ouvintes = no-op DECLARADO na trilha', () => {
    const engine = new SimulationEngine(catchesFixture());
    const result = engine.throwSignal('sig-9');
    expect(result.moved).toBe(false);
    expect(result.transitions[0].message).toContain('no waiting catch — declared no-op');
  });

  it('mensagem = destino único; >1 candidato em espera = BlockedDecision (correlação não simulável)', () => {
    const engine = new SimulationEngine(catchesFixture());
    engine.advance();
    engine.advance();
    engine.advance();
    const single = engine.throwMessage('msg-1');
    expect(single.transitions[0].message).toContain('single waiting catch "c3"');
    expect(engine.state.blockedDecision).toBeNull();
    // Agora um fixture com DOIS catches da mesma mensagem.
    const engine2 = new SimulationEngine(
      flow(
        ['s1:startEvent', 'c1:intermediateCatchEvent', 'f1:endEvent', 's2:startEvent', 'c2:intermediateCatchEvent', 'f2:endEvent'],
        ['s1->c1', 'c1->f1', 's2->c2', 'c2->f2'],
        (d) => {
          d.definitions = { messages: [{ id: 'msg-1', name: 'Pedido' }], signals: [], errors: [] };
          for (const id of ['c1', 'c2']) {
            d.nodes[id] = {
              ...d.nodes[id],
              properties: { eventDefinition: 'message', eventDefinitionRef: 'msg-1' },
            };
          }
        },
      ),
    );
    engine2.advance();
    engine2.advance();
    engine2.throwMessage('msg-1');
    const blocked = engine2.state.blockedDecision!;
    expect(blocked.reason).toContain('2 waiting recipients');
    expect(blocked.reason).toContain('runtime correlation is not simulable');
  });
});

describe('cenário + replay + compat (critérios 4 e 6)', () => {
  it('critério 6 — throwError/throwSignal/throwMessage serializam e o replay reproduz a trilha bit a bit', () => {
    const engine = new SimulationEngine(errorFixture());
    advanceToHost(engine);
    engine.throwError('host', 'err-x');
    let guard = 0;
    while (engine.canAdvance && guard++ < 100) engine.advance();
    const scenario = engine.scenario;
    expect(scenario.decisions).toContainEqual({ kind: 'error', host: 'host', errorRef: 'err-x' });
    const replayed = SimulationEngine.replay(errorFixture(), scenario);
    expect(replayed.transitions).toEqual(engine.transitions);
    expect(replayed.complete).toBe(engine.complete);
  });

  it('critério 6b — a AMBIGUIDADE também replaya para o MESMO estado bloqueado', () => {
    const ambiguous = () =>
      errorFixture((d) => {
        d.nodes.b2 = {
          ...d.nodes.b2,
          properties: { ...d.nodes.b2.properties, eventDefinitionRef: 'err-x' },
        };
      });
    const engine = new SimulationEngine(ambiguous());
    advanceToHost(engine);
    engine.throwError('host', 'err-x');
    const replayed = SimulationEngine.replay(ambiguous(), engine.scenario);
    expect(replayed.transitions).toEqual(engine.transitions);
    expect(replayed.state.blockedDecision).toEqual(engine.state.blockedDecision);
  });

  it('critério 6c — os três kinds novos canonicalizam com forma estável no cenário', () => {
    const engine = new SimulationEngine(catchesFixture());
    engine.throwSignal('sig-9');
    engine.throwMessage('msg-9');
    const withError = new SimulationEngine(errorFixture());
    advanceToHost(withError);
    withError.throwError('host');
    const canonical = canonicalizeScenario(engine.scenario);
    expect(canonical).toContain('{"kind":"signal","ref":"sig-9"}');
    expect(canonical).toContain('{"kind":"message","ref":"msg-9"}');
    // Erro sem ref serializa SEM o campo (uncatalogued estável).
    expect(canonicalizeScenario(withError.scenario)).toContain('{"kind":"error","host":"host"}');
  });

  it('guardas: lançar erro sem token no host é erro de uso; catch com 2 saídas faz split', () => {
    const engine = new SimulationEngine(errorFixture());
    expect(() => engine.throwError('host', 'err-x')).toThrow(SimulationError);
    // Catch de sinal com DUAS saídas: o broadcast emite como split.
    const split = new SimulationEngine(
      flow(
        ['s:startEvent', 'c:intermediateCatchEvent', 'a:task', 'b:task', 'fa:endEvent', 'fb:endEvent'],
        ['s->c', 'c->a', 'c->b', 'a->fa', 'b->fb'],
        (d) => {
          d.definitions = { messages: [], signals: [{ id: 'sig-1', name: 'S' }], errors: [] };
          d.nodes.c = {
            ...d.nodes.c,
            properties: { eventDefinition: 'signal', eventDefinitionRef: 'sig-1' },
          };
        },
      ),
    );
    split.advance();
    const result = split.throwSignal('sig-1');
    expect(result.transitions.some((t) => t.type === 'split')).toBe(true);
    expect(split.state.tokens.map((t) => t.nodeId).sort()).toEqual(['a', 'b']);
  });

  it('boundaryOptions carrega eventKind/eventRef dos boundaries NÃO-erro (o card manual segue)', () => {
    const engine = new SimulationEngine(
      errorFixture((d) => {
        d.definitions!.messages.push({ id: 'msg-1', name: 'Aviso' });
        d.nodes.bmsg = {
          ...d.nodes.b1,
          id: 'bmsg',
          label: 'Aviso chegou',
          properties: {
            attachedToRef: 'host',
            eventDefinition: 'message',
            eventDefinitionRef: 'msg-1',
          },
        };
        d.edges.em = { ...d.edges.e4, id: 'em', sourceId: 'bmsg', targetId: 'r1' };
      }),
    );
    advanceToHost(engine);
    const options = engine.boundaryOptions;
    expect(options).toHaveLength(1); // só o de message — erros foram pro throw card
    expect(options[0]).toMatchObject({ boundary: 'bmsg', eventKind: 'message', eventRef: 'msg-1' });
  });

  it('critério 4 — compat: fireBoundary AINDA aceita error boundary (cenários antigos replayam)', () => {
    // Cenário "antigo": decisão manual {kind:'boundary'} apontando um error
    // boundary — a API não mudou e o replay o consome intacto.
    const engine = new SimulationEngine(errorFixture());
    advanceToHost(engine);
    engine.fireBoundary('b1');
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['b1']);
    let guard = 0;
    while (engine.canAdvance && guard++ < 100) engine.advance();
    const scenario = engine.scenario;
    expect(scenario.decisions).toContainEqual({ kind: 'boundary', host: 'host', boundary: 'b1' });
    const replayed = SimulationEngine.replay(errorFixture(), scenario);
    expect(replayed.transitions).toEqual(engine.transitions);
    // E o card manual NÃO lista mais error boundaries (foram para o throw card).
    const fresh = new SimulationEngine(errorFixture());
    advanceToHost(fresh);
    expect(fresh.boundaryOptions.map((option) => option.boundary)).toEqual([]);
    expect(fresh.errorThrowOptions).toHaveLength(1);
    expect(fresh.errorThrowOptions[0].options.map((o) => o.errorRef)).toEqual([
      'err-x',
      'err-y',
      undefined,
    ]);
  });
});
