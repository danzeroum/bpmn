import { describe, expect, it } from 'vitest';
import { canonicalJsonExact, createEngine, type Effect, type InstanceState } from '../src/index.js';
import { DEF_REF, flow, NOW } from './fixtures.js';

const vars = Object.freeze({});

function start(engine: ReturnType<typeof createEngine>, instanceId = 'i1') {
  const result = engine.advance(engine.initialState(DEF_REF), {
    type: 'StartInstance',
    now: NOW,
    instanceId,
    variables: vars,
  });
  if (!result.ok) throw new Error('start rejeitado');
  return result;
}

function effectsOf(effects: Effect[], type: Effect['type']): Effect[] {
  return effects.filter((e) => e.type === type);
}

describe('fluxo sequencial e término', () => {
  it('start → task → end completa em um avanço', () => {
    const engine = createEngine(flow(['s:startEvent', 'a:task', 'e:endEvent'], ['s->a', 'a->e']));
    const { state, effects } = start(engine);
    expect(state.status).toBe('completed');
    expect(state.tokens).toEqual([]);
    expect(effectsOf(effects, 'CompleteInstance')).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: 'EmitHistory', kind: 'instanceStarted' });
  });

  it('user task abre espera com waitKey determinística e formRef', () => {
    const engine = createEngine(
      flow(['s:startEvent', 'u:userTask', 'e:endEvent'], ['s->u', 'u->e'], (d) => {
        d.nodes.u.properties.formRef = 'form-aprovacao@3';
        d.nodes.u.properties.candidateRoles = ['analista'];
      }),
    );
    const { state, effects } = start(engine);
    expect(state.status).toBe('active');
    expect(state.waits).toEqual([
      { kind: 'userTask', elementId: 'u', tokenId: 'i1', waitKey: 'u:i1' },
    ]);
    expect(effectsOf(effects, 'OpenUserTask')[0]).toMatchObject({
      waitKey: 'u:i1',
      formRef: 'form-aprovacao@3',
      candidates: ['analista'],
    });

    const done = engine.advance(state, {
      type: 'UserTaskCompleted',
      now: NOW,
      waitKey: 'u:i1',
      variables: vars,
      submission: vars,
    });
    expect(done.ok && done.state.status).toBe('completed');
  });

  it('service task emite CreateJob; JobCompleted avança; waitKey velha → staleWait', () => {
    const engine = createEngine(
      flow(['s:startEvent', 'j:serviceTask', 'e:endEvent'], ['s->j', 'j->e'], (d) => {
        d.nodes.j.properties.jobType = 'http-call';
        d.nodes.j.properties.jobPayload = { url: 'https://x' };
      }),
    );
    const { state, effects } = start(engine);
    expect(effectsOf(effects, 'CreateJob')[0]).toMatchObject({
      waitKey: 'j:i1',
      jobType: 'http-call',
      payload: { url: 'https://x' },
    });
    const done = engine.advance(state, {
      type: 'JobCompleted',
      now: NOW,
      waitKey: 'j:i1',
      variables: vars,
    });
    expect(done.ok && done.state.status).toBe('completed');

    // replay do MESMO evento sobre o estado novo → rejeição de negócio tipada
    const replayed = engine.advance((done as { state: InstanceState }).state ?? state, {
      type: 'JobCompleted',
      now: NOW,
      waitKey: 'j:i1',
      variables: vars,
    });
    expect(replayed.ok).toBe(false);
    if (!replayed.ok) expect(replayed.rejection.kind).toBe('alreadyClosed');
  });

  it('agent task emite CreateJob(agent) com agentRef+elementId; JobCompleted avança (fronteira D27)', () => {
    // ADENDO-02 D27: o agentTask é ESPERA determinística — emite job `agent`, pausa,
    // e o RESULTADO (JobCompleted) retoma o avanço. O interior do agente NÃO entra
    // no engine (roda no worker) — aqui só o contorno determinístico é exercido.
    const engine = createEngine(
      flow(['s:startEvent', 'a:agentTask', 'e:endEvent'], ['s->a', 'a->e'], (d) => {
        d.nodes.a.properties.agentWorkflowRef = 'agnt-aprova'; // declarada (flutuante); host pina
      }),
    );
    const { state, effects } = start(engine);
    expect(state.status).toBe('active'); // pausou na espera do agente
    expect(effectsOf(effects, 'CreateJob')[0]).toMatchObject({
      waitKey: 'a:i1',
      jobType: 'agent',
      // payload carrega elementId + a ref DECLARADA (o host substitui pelo pin efetivo)
      payload: { elementId: 'a', agentRef: 'agnt-aprova' },
    });
    // o RESULTADO do agente (variáveis) volta pelo host via JobCompleted → avança.
    const done = engine.advance(state, {
      type: 'JobCompleted',
      now: NOW,
      waitKey: 'a:i1',
      variables: vars,
    });
    expect(done.ok && done.state.status).toBe('completed');

    // replay do MESMO JobCompleted → rejeição tipada (a espera já fechou).
    const replayed = engine.advance((done as { state: InstanceState }).state ?? state, {
      type: 'JobCompleted',
      now: NOW,
      waitKey: 'a:i1',
      variables: vars,
    });
    expect(replayed.ok).toBe(false);
    if (!replayed.ok) expect(replayed.rejection.kind).toBe('alreadyClosed');
  });

  it('agentTask sem agentWorkflowRef → incidente estrutural (deploy lint deveria barrar)', () => {
    const engine = createEngine(
      flow(['s:startEvent', 'a:agentTask', 'e:endEvent'], ['s->a', 'a->e']),
    );
    const { effects } = start(engine);
    expect(effectsOf(effects, 'RaiseIncident')[0]).toMatchObject({ kind: 'invalidDefinition' });
    expect(effectsOf(effects, 'CreateJob')).toHaveLength(0);
  });
});

describe('XOR com condições (avaliador injetado)', () => {
  const diagram = () =>
    flow(
      ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'e1:endEvent', 'e2:endEvent'],
      ['s->x', 'x->a', 'x->b', 'a->e1', 'b->e2'],
      (d) => {
        d.edges.e1.properties.condition = 'valor > 100';
        // e2 sem condição = default implícito (convenção do lint)
      },
    );

  it('condição verdadeira roteia; falsa cai no default', () => {
    const evaluator = {
      evaluate: (expr: string, v: Readonly<Record<string, unknown>>) => ({
        value: expr === 'valor > 100' && (v.valor as number) > 100,
      }),
    };
    const engine = createEngine(diagram(), { conditions: evaluator });
    const high = engine.advance(engine.initialState(DEF_REF), {
      type: 'StartInstance',
      now: NOW,
      instanceId: 'i1',
      variables: { valor: 200 },
    });
    expect(high.ok && high.effects.some((e) => e.type === 'EmitHistory' && e.kind === 'flowRouted' && (e.payload as { edgeId: string }).edgeId === 'e1')).toBe(true);

    const low = engine.advance(engine.initialState(DEF_REF), {
      type: 'StartInstance',
      now: NOW,
      instanceId: 'i2',
      variables: { valor: 5 },
    });
    expect(low.ok && low.effects.some((e) => e.type === 'EmitHistory' && e.kind === 'flowRouted' && (e.payload as { default?: boolean }).default === true)).toBe(true);
  });

  it('condição sem avaliador injetado → incidente estrutural, nunca escolha arbitrária', () => {
    const engine = createEngine(diagram());
    const result = start(engine);
    expect(result.state.status).toBe('incident');
    expect(effectsOf(result.effects, 'RaiseIncident')[0]).toMatchObject({ kind: 'invalidDefinition' });
  });
});

describe('AND fork/join', () => {
  const parallel = () =>
    flow(
      ['s:startEvent', 'f:parallelGateway', 'a:userTask', 'b:userTask', 'j:parallelGateway', 'e:endEvent'],
      ['s->f', 'f->a', 'f->b', 'a->j', 'b->j', 'j->e'],
    );

  it('fork deriva ids dos filhos do pai; join sincroniza e completa', () => {
    const engine = createEngine(parallel());
    const { state } = start(engine);
    expect(state.tokens.map((t) => t.id).sort()).toEqual(['i1/e1', 'i1/e2']);
    expect(state.waits).toHaveLength(2);

    const afterA = engine.advance(state, {
      type: 'UserTaskCompleted', now: NOW, waitKey: 'a:i1/e1', variables: vars, submission: vars,
    });
    if (!afterA.ok) throw new Error('a rejeitada');
    // condição a: chave composta joinElementId@scopeId
    expect(afterA.state.joinArrivals).toEqual({ 'j@root': ['e3'] });
    expect(afterA.state.status).toBe('active');

    const afterB = engine.advance(afterA.state, {
      type: 'UserTaskCompleted', now: NOW, waitKey: 'b:i1/e2', variables: vars, submission: vars,
    });
    if (!afterB.ok) throw new Error('b rejeitada');
    expect(afterB.state.status).toBe('completed');
    expect(afterB.state.joinArrivals).toEqual({});
  });
});

describe('timers', () => {
  it('timer intermediário agenda com fireAt = now + duração', () => {
    const engine = createEngine(
      flow(['s:startEvent', 't:intermediateCatchEvent', 'e:endEvent'], ['s->t', 't->e'], (d) => {
        d.nodes.t.properties.eventDefinition = 'timer';
        d.nodes.t.properties.timer = { kind: 'duration', expression: 'PT15M' };
      }),
    );
    const { state, effects } = start(engine);
    expect(effectsOf(effects, 'ScheduleTimer')[0]).toMatchObject({
      waitKey: 't:i1',
      fireAt: '2026-07-22T12:15:00.000Z',
    });
    const fired = engine.advance(state, { type: 'TimerFired', now: NOW, waitKey: 't:i1', variables: vars });
    expect(fired.ok && fired.state.status).toBe('completed');
  });

  it('boundary interruptivo sobre user task: CloseUserTask + rota do boundary', () => {
    const engine = createEngine(
      flow(
        ['s:startEvent', 'u:userTask', 'bt:boundaryEvent', 'esc:task', 'e1:endEvent', 'e2:endEvent'],
        ['s->u', 'u->e1', 'bt->esc', 'esc->e2'],
        (d) => {
          d.nodes.bt.properties.attachedToRef = 'u';
          d.nodes.bt.properties.eventDefinition = 'timer';
          d.nodes.bt.properties.timer = { kind: 'duration', expression: 'PT1H' };
        },
      ),
    );
    const { state, effects } = start(engine);
    expect(effectsOf(effects, 'ScheduleTimer')).toHaveLength(1);
    expect(state.waits.map((w) => w.kind).sort()).toEqual(['timer', 'userTask']);

    const fired = engine.advance(state, { type: 'TimerFired', now: NOW, waitKey: 'bt:i1', variables: vars });
    if (!fired.ok) throw new Error('timer rejeitado');
    expect(effectsOf(fired.effects, 'CloseUserTask')).toEqual([{ type: 'CloseUserTask', waitKey: 'u:i1' }]);
    expect(fired.state.status).toBe('completed'); // esc → e2
  });

  it('user task completa ANTES do boundary → CancelTimer emitido e espera do timer morre', () => {
    const engine = createEngine(
      flow(
        ['s:startEvent', 'u:userTask', 'bt:boundaryEvent', 'esc:task', 'e1:endEvent', 'e2:endEvent'],
        ['s->u', 'u->e1', 'bt->esc', 'esc->e2'],
        (d) => {
          d.nodes.bt.properties.attachedToRef = 'u';
          d.nodes.bt.properties.eventDefinition = 'timer';
          d.nodes.bt.properties.timer = { kind: 'duration', expression: 'PT1H' };
        },
      ),
    );
    const { state } = start(engine);
    const done = engine.advance(state, {
      type: 'UserTaskCompleted', now: NOW, waitKey: 'u:i1', variables: vars, submission: vars,
    });
    if (!done.ok) throw new Error('conclusão rejeitada');
    expect(done.effects).toContainEqual({ type: 'CancelTimer', waitKey: 'bt:i1' });
    expect(done.state.waits).toEqual([]);
    expect(done.state.status).toBe('completed');
    // o timer cancelado disparar depois é staleWait, nunca efeito duplo
    const late = engine.advance(done.state, { type: 'TimerFired', now: NOW, waitKey: 'bt:i1', variables: vars });
    expect(late.ok).toBe(false);
  });

  it('job completa ANTES do boundary → CancelTimer emitido (simétrico)', () => {
    const engine = createEngine(
      flow(
        ['s:startEvent', 'j:serviceTask', 'bt:boundaryEvent', 'esc:task', 'e1:endEvent', 'e2:endEvent'],
        ['s->j', 'j->e1', 'bt->esc', 'esc->e2'],
        (d) => {
          d.nodes.j.properties.jobType = 'http-call';
          d.nodes.bt.properties.attachedToRef = 'j';
          d.nodes.bt.properties.eventDefinition = 'timer';
          d.nodes.bt.properties.timer = { kind: 'duration', expression: 'PT1H' };
        },
      ),
    );
    const { state } = start(engine);
    const done = engine.advance(state, {
      type: 'JobCompleted', now: NOW, waitKey: 'j:i1', variables: vars,
    });
    if (!done.ok) throw new Error('conclusão rejeitada');
    expect(done.effects).toContainEqual({ type: 'CancelTimer', waitKey: 'bt:i1' });
    expect(done.state.status).toBe('completed');
  });

  it('boundary interruptivo sobre SERVICE task → CancelJob emitido (simétrico)', () => {
    const engine = createEngine(
      flow(
        ['s:startEvent', 'j:serviceTask', 'bt:boundaryEvent', 'esc:task', 'e1:endEvent', 'e2:endEvent'],
        ['s->j', 'j->e1', 'bt->esc', 'esc->e2'],
        (d) => {
          d.nodes.j.properties.jobType = 'http-call';
          d.nodes.bt.properties.attachedToRef = 'j';
          d.nodes.bt.properties.eventDefinition = 'timer';
          d.nodes.bt.properties.timer = { kind: 'duration', expression: 'PT1H' };
        },
      ),
    );
    const { state } = start(engine);
    const fired = engine.advance(state, { type: 'TimerFired', now: NOW, waitKey: 'bt:i1', variables: vars });
    if (!fired.ok) throw new Error('timer rejeitado');
    expect(fired.effects).toContainEqual({ type: 'CancelJob', waitKey: 'j:i1' });
    expect(fired.state.status).toBe('completed'); // esc → e2
    // completar o job cancelado depois é staleWait (fencing semântico)
    const late = engine.advance(fired.state, { type: 'JobCompleted', now: NOW, waitKey: 'j:i1', variables: vars });
    expect(late.ok).toBe(false);
  });

  it('boundary NÃO-interruptivo: host continua, token paralelo nasce', () => {
    const engine = createEngine(
      flow(
        ['s:startEvent', 'u:userTask', 'bt:boundaryEvent', 'nudge:task', 'e1:endEvent', 'e2:endEvent'],
        ['s->u', 'u->e1', 'bt->nudge', 'nudge->e2'],
        (d) => {
          d.nodes.bt.properties.attachedToRef = 'u';
          d.nodes.bt.properties.cancelActivity = false;
          d.nodes.bt.properties.eventDefinition = 'timer';
          d.nodes.bt.properties.timer = { kind: 'duration', expression: 'PT1H' };
        },
      ),
    );
    const { state } = start(engine);
    const fired = engine.advance(state, { type: 'TimerFired', now: NOW, waitKey: 'bt:i1', variables: vars });
    if (!fired.ok) throw new Error('timer rejeitado');
    expect(fired.state.status).toBe('active'); // user task segue aberta
    expect(fired.state.waits).toEqual([
      { kind: 'userTask', elementId: 'u', tokenId: 'i1', waitKey: 'u:i1' },
    ]);
    expect(fired.effects.some((e) => e.type === 'CloseUserTask')).toBe(false);
  });
});

describe('D19 defensivo e invariantes', () => {
  it('elemento fora do subset v1 → RaiseIncident tipado + status incident', () => {
    const engine = createEngine(
      flow(['s:startEvent', 'o:inclusiveGateway', 'a:task', 'e:endEvent'], ['s->o', 'o->a', 'a->e']),
    );
    const { state, effects } = start(engine);
    expect(state.status).toBe('incident');
    expect(effectsOf(effects, 'RaiseIncident')[0]).toMatchObject({ kind: 'unsupportedElement' });
  });

  it('advance NUNCA retorna variáveis (D13): efeitos não carregam event.variables', () => {
    const engine = createEngine(
      flow(['s:startEvent', 'u:userTask', 'e:endEvent'], ['s->u', 'u->e']),
    );
    const secret = { cpf: '123' };
    const result = engine.advance(engine.initialState(DEF_REF), {
      type: 'StartInstance', now: NOW, instanceId: 'i1', variables: secret,
    });
    if (!result.ok) throw new Error();
    expect(JSON.stringify(result.effects)).not.toContain('123');
    expect(JSON.stringify(result.state)).not.toContain('123');
  });

  it('determinismo byte-a-byte (invariante 2): mesma entrada, mesma saída canônica', () => {
    const build = () =>
      createEngine(
        flow(
          ['s:startEvent', 'f:parallelGateway', 'a:userTask', 'b:serviceTask', 'j:parallelGateway', 'e:endEvent'],
          ['s->f', 'f->a', 'f->b', 'a->j', 'b->j', 'j->e'],
          (d) => {
            d.nodes.b.properties.jobType = 'noop';
          },
        ),
      );
    const run = () => {
      const engine = build();
      const r = engine.advance(engine.initialState(DEF_REF), {
        type: 'StartInstance', now: NOW, instanceId: 'i1', variables: vars,
      });
      if (!r.ok) throw new Error();
      return canonicalJsonExact({ state: r.state, effects: r.effects });
    };
    expect(run()).toBe(run());
  });
});
