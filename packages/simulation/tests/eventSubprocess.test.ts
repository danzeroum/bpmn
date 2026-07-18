import { describe, expect, it } from 'vitest';
import { createNode, type BpmnDiagram } from '@buildtovalue/core';
import {
  canonicalizeScenario,
  SimulationEngine,
  SimulationError,
} from '../src/index.js';
import { flow } from './fixtures.js';

/**
 * Handoff 17 ES-5 (§4e) — disparo de event subprocess no simulador: candidatos
 * incluem os starts tipados do escopo do token (critério 1), precedência em
 * ordem TOTAL declarada (critério 2: esub-exato > boundary-exato >
 * esub-catch-all > boundary-catch-all), interrupção nomeada com contagem +
 * escopo (critério 3), card manual de timer/conditional que NUNCA auto-dispara
 * (critério 4, reforço 10), espelho gov-* (critério 5), replay bit a bit +
 * compat E-6 (critério 6) e os reforços 9 (broadcast+interrupting vinculante)
 * e 10 (fire manual aplica a MESMA interrupção).
 */

/** Adds an event subprocess `id` with one typed start `startId` to `d`. */
function addEsub(
  d: BpmnDiagram,
  id: string,
  startId: string,
  kind: string,
  opts: { ref?: string; interrupting?: boolean; parent?: string; label?: string } = {},
): void {
  d.nodes[id] = createNode({
    id,
    type: 'subProcess',
    label: opts.label ?? id,
    x: 0,
    y: 0,
    properties: { triggeredByEvent: true, ...(opts.parent ? { parentId: opts.parent } : {}) },
  });
  d.nodes[startId] = createNode({
    id: startId,
    type: 'startEvent',
    label: startId,
    x: 0,
    y: 0,
    properties: {
      parentId: id,
      eventDefinition: kind,
      ...(opts.ref ? { eventDefinitionRef: opts.ref } : {}),
      ...(opts.interrupting === false ? { isInterrupting: false } : {}),
    },
  });
}

/** start → host(task, boundary b1→err-x) → end, com definições nomeadas. */
function hostFixture(extra?: (d: BpmnDiagram) => void): BpmnDiagram {
  return flow(
    ['s:startEvent', 'host:task', 'e:endEvent', 'b1:boundaryEvent', 'r1:task', 'f1:endEvent'],
    ['s->host', 'host->e', 'b1->r1', 'r1->f1'],
    (d) => {
      d.definitions = {
        messages: [{ id: 'msg-1', name: 'Pedido' }],
        signals: [{ id: 'sig-1', name: 'Alerta' }],
        errors: [{ id: 'err-x', name: 'Falha X' }],
      };
      d.nodes.b1 = {
        ...d.nodes.b1,
        properties: {
          ...d.nodes.b1.properties,
          attachedToRef: 'host',
          eventDefinition: 'error',
          eventDefinitionRef: 'err-x',
        },
      };
      extra?.(d);
    },
  );
}

/** AND-split com 2 tokens vivos (a, b) — o cenário da interrupção contada. */
function parallelFixture(extra?: (d: BpmnDiagram) => void): BpmnDiagram {
  return flow(
    ['s:startEvent', 'f:parallelGateway', 'a:task', 'b:task', 'j:parallelGateway', 'e:endEvent'],
    ['s->f', 'f->a', 'f->b', 'a->j', 'b->j', 'j->e'],
    (d) => {
      d.definitions = {
        messages: [{ id: 'msg-1', name: 'Pedido' }],
        signals: [{ id: 'sig-1', name: 'Alerta' }],
        errors: [{ id: 'err-x', name: 'Falha X' }],
      };
      extra?.(d);
    },
  );
}

const toParallelTokens = (engine: SimulationEngine) => {
  engine.advance(); // s -> f
  engine.advance(); // f -> split em a e b
  expect(engine.state.tokens.map((t) => t.nodeId).sort()).toEqual(['a', 'b']);
};

describe('candidatos e casca (critério 1)', () => {
  it('a casca NUNCA semeia token implícito; escopo sem start segue semeando as fontes reais', () => {
    const diagram = flow(['a:task', 'e:endEvent'], ['a->e'], (d) => {
      addEsub(d, 'esub', 'st', 'error', { ref: 'err-x' });
    });
    const engine = new SimulationEngine(diagram);
    // Sem startEvent no escopo: só a fonte real `a` recebe token — a casca não.
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['a']);
  });

  it('card de lançar erro existe em host SEM boundary quando o escopo tem esub de erro; degenerado nunca é candidato', () => {
    const diagram = flow(
      ['s:startEvent', 'host:task', 'e:endEvent'],
      ['s->host', 'host->e'],
      (d) => {
        d.definitions = { messages: [], signals: [], errors: [{ id: 'err-x', name: 'Falha X' }] };
        addEsub(d, 'esub', 'st', 'error', { ref: 'err-x', label: 'Tratar exceções' });
        // Degenerado: 2 starts — nunca candidato (corrigir é papel do lint 4d).
        addEsub(d, 'bad', 'bs1', 'error', { ref: 'err-x' });
        d.nodes.bs2 = createNode({
          id: 'bs2',
          type: 'startEvent',
          x: 0,
          y: 0,
          properties: { parentId: 'bad', eventDefinition: 'message' },
        });
      },
    );
    const engine = new SimulationEngine(diagram);
    engine.advance(); // s -> host
    const cards = engine.state.errorThrowOptions;
    expect(cards).toHaveLength(1);
    expect(cards[0].host).toBe('host');
    expect(cards[0].options).toEqual([
      { errorRef: 'err-x', label: 'Falha X' },
      {}, // não catalogado (reforço 10 da E-6, mantido)
    ]);
    // O throw resolve para o ÚNICO elegível (o degenerado não concorre — se
    // concorresse, seria BlockedDecision por duplicata no tier).
    const result = engine.throwError('host', 'err-x');
    expect(engine.state.blockedDecision).toBeNull();
    expect(result.transitions[0].message).toContain(
      'caught by event subprocess "Tratar exceções" (start st, errorRef "err-x", interrupting)',
    );
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['esub']);
  });
});

describe('precedência em ordem TOTAL (critério 2)', () => {
  it('VINCULANTE — esub exato VENCE boundary exato do MESMO ref (não é ambiguidade)', () => {
    const engine = new SimulationEngine(
      hostFixture((d) => addEsub(d, 'esub', 'st', 'error', { ref: 'err-x', label: 'Tratar' })),
    );
    engine.advance();
    const result = engine.throwError('host', 'err-x');
    expect(engine.state.blockedDecision).toBeNull(); // dois elegíveis ≠ empate: tiers distintos
    expect(result.transitions[0].message).toContain('caught by event subprocess "Tratar"');
    expect(result.transitions[0].message).toContain('(start st, errorRef "err-x", interrupting)');
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['esub']);
  });

  it('composto com a E-6: boundary EXATO vence esub CATCH-ALL (especificidade antes de escopo)', () => {
    const engine = new SimulationEngine(
      hostFixture((d) => addEsub(d, 'esub', 'st', 'error')), // start de erro SEM ref
    );
    engine.advance();
    const result = engine.throwError('host', 'err-x');
    expect(result.transitions[0].message).toContain('caught by boundary "b1"');
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['b1']);
  });

  it('esub catch-all vence boundary catch-all (escopo desempata o tier catch-all)', () => {
    const engine = new SimulationEngine(
      hostFixture((d) => {
        addEsub(d, 'esub', 'st', 'error', { label: 'Catch-all interno' });
        // b1 vira catch-all também (sem ref).
        const { eventDefinitionRef: _dropped, ...rest } = d.nodes.b1.properties;
        d.nodes.b1 = { ...d.nodes.b1, properties: rest };
      }),
    );
    engine.advance();
    const result = engine.throwError('host', 'err-z');
    expect(result.transitions[0].message).toContain('caught by event subprocess "Catch-all interno"');
    expect(result.transitions[0].message).toContain('the DECLARED catch-all (no errorRef)');
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['esub']);
  });

  it('duplicata no MESMO tier (2 esubs com o mesmo ref) = BlockedDecision nomeando candidatos', () => {
    const engine = new SimulationEngine(
      hostFixture((d) => {
        addEsub(d, 'es1', 'st1', 'error', { ref: 'err-x', label: 'Primeiro' });
        addEsub(d, 'es2', 'st2', 'error', { ref: 'err-x', label: 'Segundo' });
      }),
    );
    engine.advance();
    const result = engine.throwError('host', 'err-x');
    const blocked = engine.state.blockedDecision!;
    expect(blocked.reason).toContain('ambiguous');
    expect(blocked.reason).toContain('es1 ("Primeiro")');
    expect(blocked.reason).toContain('es2 ("Segundo")');
    expect(result.transitions[0].type).toBe('decision-blocked');
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['host']);
  });
});

describe('interrupção nomeada (critério 3)', () => {
  it('interrupting cancela TODOS os tokens do escopo e a trilha nomeia contagem + escopo', () => {
    const engine = new SimulationEngine(
      parallelFixture((d) => addEsub(d, 'esub', 'st', 'error', { ref: 'err-x' })),
    );
    toParallelTokens(engine);
    const result = engine.throwError('a', 'err-x');
    expect(result.transitions.map((t) => t.message)).toEqual([
      'Thrown error "err-x" on "a": caught by event subprocess "esub" (start st, errorRef "err-x", interrupting)',
      'interrupting: 2 token(s) cancelled in scope "Fixture"',
    ]);
    // Só o token do contêiner sobrevive (decisão 1 da ES-0: token na casca).
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['esub']);
    // A descida não é simulada: avançar consome o token na casca (declarado).
    engine.advance();
    expect(engine.state.complete).toBe(true);
  });

  it('não-interrupting mantém os tokens do escopo — token paralelo no contêiner', () => {
    const engine = new SimulationEngine(
      parallelFixture((d) =>
        addEsub(d, 'esub', 'st', 'error', { ref: 'err-x', interrupting: false }),
      ),
    );
    toParallelTokens(engine);
    const result = engine.throwError('a', 'err-x');
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].message).toContain('non-interrupting: scope continues');
    expect(engine.state.tokens.map((t) => t.nodeId).sort()).toEqual(['a', 'b', 'esub']);
  });

  it('a trilha nomeia o ESCOPO drill-in pelo label do subProcess hospedeiro', () => {
    const diagram = flow(
      ['big:subProcess', 'is:startEvent', 'it:task', 'ie:endEvent'],
      ['is->it', 'it->ie'],
      (d) => {
        d.nodes.big.label = 'Subprocesso S';
        for (const id of ['is', 'it', 'ie']) {
          d.nodes[id] = { ...d.nodes[id], properties: { ...d.nodes[id].properties, parentId: 'big' } };
        }
        d.definitions = { messages: [], signals: [], errors: [{ id: 'err-x', name: 'Falha X' }] };
        addEsub(d, 'esub', 'st', 'error', { ref: 'err-x', parent: 'big', label: 'Tratar exceções' });
      },
    );
    const engine = new SimulationEngine(diagram, { scope: 'big' });
    engine.advance(); // is -> it
    const result = engine.throwError('it', 'err-x');
    expect(result.transitions[1].message).toBe(
      'interrupting: 1 token(s) cancelled in scope "Subprocesso S"',
    );
  });
});

describe('signal e message com esub (critério 1, reforço 9)', () => {
  it('VINCULANTE — broadcast com 1 interrupting + 1 não: pré-existentes cancelados UMA vez, os 2 recém-colocados sobrevivem, ordem determinística', () => {
    const engine = new SimulationEngine(
      parallelFixture((d) => {
        addEsub(d, 'esI', 'stI', 'signal', { ref: 'sig-1', label: 'Interruptor' });
        addEsub(d, 'esN', 'stN', 'signal', { ref: 'sig-1', interrupting: false, label: 'Paralelo' });
      }),
    );
    toParallelTokens(engine);
    const result = engine.throwSignal('sig-1');
    expect(result.transitions.map((t) => t.message)).toEqual([
      'Signal "sig-1" thrown: broadcast to 2 recipient(s)',
      'Signal "sig-1" caught by event subprocess "Interruptor" (start stI, interrupting)',
      'Signal "sig-1" caught by event subprocess "Paralelo" (start stN, non-interrupting: scope continues)',
      'interrupting: 2 token(s) cancelled in scope "Fixture"',
    ]);
    // Os DOIS tokens de contêiner sobrevivem; os 2 pré-existentes morreram.
    expect(engine.state.tokens.map((t) => t.nodeId).sort()).toEqual(['esI', 'esN']);
  });

  it('mensagem: esub como destino ÚNICO entrega; esub + catch em espera = BlockedDecision nomeando AMBOS', () => {
    const single = new SimulationEngine(
      parallelFixture((d) => addEsub(d, 'esub', 'st', 'message', { ref: 'msg-1', label: 'Recebedor' })),
    );
    toParallelTokens(single);
    const delivered = single.throwMessage('msg-1');
    expect(delivered.transitions[0].message).toContain(
      'caught by event subprocess "Recebedor" (start st, interrupting)',
    );
    // >1 candidato no total (catch em espera + esub) = correlação não simulável.
    const both = new SimulationEngine(
      flow(
        ['s:startEvent', 'c:intermediateCatchEvent', 'e:endEvent'],
        ['s->c', 'c->e'],
        (d) => {
          d.definitions = { messages: [{ id: 'msg-1', name: 'Pedido' }], signals: [], errors: [] };
          d.nodes.c = {
            ...d.nodes.c,
            properties: { ...d.nodes.c.properties, eventDefinition: 'message', eventDefinitionRef: 'msg-1' },
          };
          addEsub(d, 'esub', 'st', 'message', { ref: 'msg-1', label: 'Recebedor' });
        },
      ),
    );
    both.advance(); // s -> c (catch em espera)
    both.throwMessage('msg-1');
    const blocked = both.state.blockedDecision!;
    expect(blocked.reason).toContain('2 waiting recipients');
    expect(blocked.reason).toContain('c ("c")');
    expect(blocked.reason).toContain('esub ("Recebedor", event subprocess)');
  });
});

describe('card manual timer/conditional (critério 4, reforço 10)', () => {
  it('timer NUNCA auto-dispara; o card expõe o MODO; fire manual aplica a MESMA interrupção nomeada', () => {
    const engine = new SimulationEngine(
      parallelFixture((d) => addEsub(d, 'esub', 'st', 'timer', { label: 'Todo dia' })),
    );
    toParallelTokens(engine);
    // O card manual existe e declara o modo (reforço 10 — decisão informada).
    expect(engine.state.eventSubprocessOptions).toEqual([
      { sub: 'esub', subLabel: 'Todo dia', startId: 'st', kind: 'timer', interrupting: true },
    ]);
    // Avançar até o fim sem tocar o card: o esub nunca dispara sozinho.
    const auto = new SimulationEngine(
      parallelFixture((d) => addEsub(d, 'esub', 'st', 'timer')),
    );
    let guard = 0;
    while (!auto.state.complete && guard++ < 50) auto.advance();
    expect(auto.state.complete).toBe(true);
    expect(auto.state.visitedNodes).not.toContain('esub');
    // Fire manual: MESMA interrupção nomeada do caminho do throw (reforço 10).
    const result = engine.fireEventSubprocess('esub');
    expect(result.transitions.map((t) => t.message)).toEqual([
      'Event subprocess "Todo dia" manually fired (start st, timer never auto-fires in simulation, interrupting)',
      'interrupting: 2 token(s) cancelled in scope "Fixture"',
    ]);
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['esub']);
  });

  it('variante não-interrupting do fire manual: escopo segue', () => {
    const engine = new SimulationEngine(
      parallelFixture((d) =>
        addEsub(d, 'esub', 'st', 'conditional', { interrupting: false, label: 'Se preciso' }),
      ),
    );
    toParallelTokens(engine);
    expect(engine.state.eventSubprocessOptions[0]).toMatchObject({
      kind: 'conditional',
      interrupting: false,
    });
    engine.fireEventSubprocess('esub');
    expect(engine.state.tokens.map((t) => t.nodeId).sort()).toEqual(['a', 'b', 'esub']);
  });

  it('guardas: fire de esub message é erro de uso (dispare pelo throw); id inválido idem', () => {
    const engine = new SimulationEngine(
      parallelFixture((d) => addEsub(d, 'esub', 'st', 'message', { ref: 'msg-1' })),
    );
    toParallelTokens(engine);
    expect(() => engine.fireEventSubprocess('esub')).toThrow(SimulationError);
    expect(() => engine.fireEventSubprocess('ghost')).toThrow(SimulationError);
    // E o card manual não o lista (message dispara por matching, não por card).
    expect(engine.state.eventSubprocessOptions).toEqual([]);
  });
});

describe('espelho gov-* (critério 5, molde reforço 9 da E-6)', () => {
  it('start de esub referindo definição espelho gov-* faz matching IDÊNTICO ao da definição comum', () => {
    const run = (errId: string) => {
      const engine = new SimulationEngine(
        parallelFixture((d) => {
          d.definitions = { messages: [], signals: [], errors: [{ id: errId, name: 'Falha Gov' }] };
          addEsub(d, 'esub', 'st', 'error', { ref: errId, label: 'Tratar' });
        }),
      );
      toParallelTokens(engine);
      engine.throwError('a', errId);
      return engine;
    };
    const plain = run('err-1');
    const gov = run('gov-err-1');
    const shape = (e: SimulationEngine) =>
      e.state.trail.slice(-2).map((t) => t.message.replace(/"(gov-)?err-1"/g, '"<ref>"'));
    expect(shape(gov)).toEqual(shape(plain)); // mesma trilha, mesmo tier
    expect(gov.state.tokens.map((t) => t.nodeId)).toEqual(['esub']);
  });
});

describe('replay bit a bit + compat (critério 6)', () => {
  it('cenário com erro→esub interrupting replaya a trilha BIT A BIT', () => {
    const build = () =>
      parallelFixture((d) => addEsub(d, 'esub', 'st', 'error', { ref: 'err-x' }));
    const engine = new SimulationEngine(build());
    toParallelTokens(engine);
    engine.throwError('a', 'err-x');
    engine.advance(); // consome o token do contêiner
    expect(engine.state.complete).toBe(true);
    const replayed = SimulationEngine.replay(build(), engine.scenario);
    expect(replayed.transitions).toEqual(engine.transitions);
    expect(replayed.state.complete).toBe(true);
  });

  it('fire manual serializa ({kind:"eventSubprocess"}) e replaya bit a bit', () => {
    const build = () => parallelFixture((d) => addEsub(d, 'esub', 'st', 'timer'));
    const engine = new SimulationEngine(build());
    toParallelTokens(engine);
    engine.fireEventSubprocess('esub');
    engine.advance();
    expect(engine.state.complete).toBe(true);
    // O momento do disparo manual é PARTE do cenário (âncora atStep): um
    // interrupting disparado noutro momento cancelaria outra contagem.
    expect(canonicalizeScenario(engine.scenario)).toContain(
      '{"kind":"eventSubprocess","sub":"esub","atStep":2}',
    );
    const replayed = SimulationEngine.replay(build(), engine.scenario);
    expect(replayed.transitions).toEqual(engine.transitions);
  });

  it('o estado BLOQUEADO (duplicata no tier) também replaya idêntico', () => {
    const build = () =>
      hostFixture((d) => {
        addEsub(d, 'es1', 'st1', 'error', { ref: 'err-x' });
        addEsub(d, 'es2', 'st2', 'error', { ref: 'err-x' });
      });
    const engine = new SimulationEngine(build());
    engine.advance();
    engine.throwError('host', 'err-x');
    expect(engine.state.blockedDecision).not.toBeNull();
    const replayed = SimulationEngine.replay(build(), engine.scenario);
    expect(replayed.transitions).toEqual(engine.transitions);
    expect(replayed.state.blockedDecision).toEqual(engine.state.blockedDecision);
  });

  it('COMPAT obrigatória — diagrama SEM esub: trilha e wording E-6 byte-idênticos no replay', () => {
    // Sem event subprocess no jogo, as linhas E-6 não mudam nem uma vírgula:
    // o broadcast segue "waiting catch(es)" e o erro segue "caught by boundary".
    const build = () =>
      hostFixture((d) => {
        d.nodes.c = createNode({
          id: 'c',
          type: 'intermediateCatchEvent',
          label: 'c',
          x: 0,
          y: 0,
          properties: { eventDefinition: 'signal', eventDefinitionRef: 'sig-1' },
        });
        d.edges.ec = {
          ...d.edges.e0,
          id: 'ec',
          sourceId: 'c',
          targetId: 'e',
        };
      });
    const engine = new SimulationEngine(build());
    // Sinal antes do advance — o replay E-6 aplica signal/message avidamente
    // na posição da fila (semântica pré-existente, intocada pela ES-5).
    engine.throwSignal('sig-1'); // zero ouvintes: no-op declarado (E-6 wording)
    engine.advance();
    engine.throwError('host', 'err-x');
    // Avançar até completar antes de comparar (o replay auto-avança no fim).
    let guard = 0;
    while (engine.canAdvance && guard++ < 50) engine.advance();
    const messages = engine.transitions.map((t) => t.message);
    expect(messages).toContain('Signal "sig-1" thrown: no waiting catch — declared no-op');
    expect(
      messages.some((m) => m.includes('caught by boundary "b1" via errorRef match "err-x"')),
    ).toBe(true);
    const replayed = SimulationEngine.replay(build(), engine.scenario);
    expect(replayed.transitions).toEqual(engine.transitions);
  });
});
