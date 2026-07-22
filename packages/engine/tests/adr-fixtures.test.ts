import { describe, expect, it } from 'vitest';
import { canonicalJsonExact, createEngine, type InstanceState } from '../src/index.js';
import { DEF_REF, flow, NOW } from './fixtures.js';

/**
 * AS TRÊS FIXTURES OBRIGATÓRIAS da condição (d) do ADR-0001 (aprovação do
 * dono, 2026-07-22). O CI fica vermelho se qualquer uma sumir ou regredir.
 */
const vars = Object.freeze({});

const parallelUserTasks = () =>
  flow(
    ['s:startEvent', 'f:parallelGateway', 'a:userTask', 'b:userTask', 'j:parallelGateway', 'e:endEvent'],
    ['s->f', 'f->a', 'f->b', 'a->j', 'b->j', 'j->e'],
  );

describe('ADR-0001 condição (d) — fixtures obrigatórias', () => {
  it('d.1 — parada com join incompleto: persistir → recarregar → retomar', () => {
    const engine = createEngine(parallelUserTasks());
    const started = engine.advance(engine.initialState(DEF_REF), {
      type: 'StartInstance', now: NOW, instanceId: 'i1', variables: vars,
    });
    if (!started.ok) throw new Error();
    const half = engine.advance(started.state, {
      type: 'UserTaskCompleted', now: NOW, waitKey: 'a:i1/e1', variables: vars, submission: vars,
    });
    if (!half.ok) throw new Error();
    expect(half.state.joinArrivals).toEqual({ 'j@root': ['e3'] });

    // PERSISTE (JSON canônico) e RECARREGA — a chegada parcial sobrevive.
    const persisted = canonicalJsonExact(half.state);
    const reloaded = JSON.parse(persisted) as InstanceState;
    expect(canonicalJsonExact(reloaded)).toBe(persisted); // byte-idêntico (condição c)

    // RETOMA com um engine RECRIADO (novo processo, mesmo diagrama).
    const resumed = createEngine(parallelUserTasks()).advance(reloaded, {
      type: 'UserTaskCompleted', now: NOW, waitKey: 'b:i1/e2', variables: vars, submission: vars,
    });
    if (!resumed.ok) throw new Error('retomada rejeitada');
    expect(resumed.state.status).toBe('completed');
    expect(resumed.state.joinArrivals).toEqual({});
  });

  it('d.2 — loop com dupla chegada pelo MESMO fluxo não infla o set', () => {
    // Fork triplo: a e b convergem num merge XOR e entram no join pela MESMA
    // aresta (e6); c entra por e7. Depois de a E b, o join recebeu e6 DUAS
    // vezes: o set não infla ({e6}), o join NÃO dispara espuriamente e a
    // instância segue ativa esperando c — semântica declarada (set, não
    // contagem), pinada aqui. c completa → e7 → join dispara.
    const engine = createEngine(
      flow(
        ['s:startEvent', 'f:parallelGateway', 'a:userTask', 'b:userTask', 'c:userTask', 'm:exclusiveGateway', 'j:parallelGateway', 'e:endEvent'],
        ['s->f', 'f->a', 'f->b', 'f->c', 'a->m', 'b->m', 'm->j', 'c->j', 'j->e'],
      ),
    );
    const started = engine.advance(engine.initialState(DEF_REF), {
      type: 'StartInstance', now: NOW, instanceId: 'i1', variables: vars,
    });
    if (!started.ok) throw new Error('start rejeitado');
    expect(started.state.joinArrivals).toEqual({});

    const first = engine.advance(started.state, {
      type: 'UserTaskCompleted', now: NOW, waitKey: 'a:i1/e1', variables: vars, submission: vars,
    });
    if (!first.ok) throw new Error('a rejeitada');
    expect(first.state.joinArrivals).toEqual({ 'j@root': ['e6'] });

    const second = engine.advance(first.state, {
      type: 'UserTaskCompleted', now: NOW, waitKey: 'b:i1/e2', variables: vars, submission: vars,
    });
    if (!second.ok) throw new Error('b rejeitada');
    // Dupla chegada por e6: o set NÃO infla e o join não dispara.
    expect(second.state.joinArrivals).toEqual({ 'j@root': ['e6'] });
    expect(second.state.status).toBe('active');
    expect(second.state.waits).toEqual([
      { kind: 'userTask', elementId: 'c', tokenId: 'i1/e3', waitKey: 'c:i1/e3' },
    ]);

    const third = engine.advance(second.state, {
      type: 'UserTaskCompleted', now: NOW, waitKey: 'c:i1/e3', variables: vars, submission: vars,
    });
    if (!third.ok) throw new Error('c rejeitada');
    expect(third.state.status).toBe('completed');
    expect(third.state.joinArrivals).toEqual({});
  });

  it('d.3 — join em escopo cancelado: entradas somem junto (condição b)', () => {
    const engine = createEngine(parallelUserTasks());
    const started = engine.advance(engine.initialState(DEF_REF), {
      type: 'StartInstance', now: NOW, instanceId: 'i1', variables: vars,
    });
    if (!started.ok) throw new Error();
    const half = engine.advance(started.state, {
      type: 'UserTaskCompleted', now: NOW, waitKey: 'a:i1/e1', variables: vars, submission: vars,
    });
    if (!half.ok) throw new Error();
    expect(Object.keys(half.state.joinArrivals)).toHaveLength(1);

    const cancelled = engine.advance(half.state, {
      type: 'CancelInstance', now: NOW, variables: vars, reason: 'pedido do cliente',
    });
    if (!cancelled.ok) throw new Error();
    expect(cancelled.state.status).toBe('cancelled');
    expect(cancelled.state.joinArrivals).toEqual({}); // condição b
    expect(cancelled.state.tokens).toEqual([]);
    expect(cancelled.state.waits).toEqual([]);
    // a espera remanescente (task b) foi FECHADA com efeito, nunca órfã
    expect(cancelled.effects).toContainEqual({ type: 'CloseUserTask', waitKey: 'b:i1/e2' });
    expect(
      cancelled.effects.some(
        (e) =>
          e.type === 'EmitHistory' &&
          e.kind === 'instanceCancelled' &&
          (e.payload as { reason: string }).reason === 'pedido do cliente',
      ),
    ).toBe(true);
  });
});
