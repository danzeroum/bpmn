import { describe, expect, it } from 'vitest';
import { SimulationEngine, SimulationError, type PendingChoice } from '../src/index.js';
import {
  andParallel,
  eventBased,
  flow,
  linear,
  nonInterruptingBoundary,
  orRegion,
  threePaths,
  trap,
  xorSplit,
} from './fixtures.js';

/**
 * Auto-advance to a stopping point (completion, deadlock, or an unresolved
 * choice). `decide` resolves any branch reached; without it the run stops at
 * the first choice instead of looping.
 */
function run(engine: SimulationEngine, decide?: (choice: PendingChoice) => void): void {
  let guard = 0;
  while (guard++ < 500) {
    const choice = engine.pendingChoice;
    if (choice) {
      if (!decide) break;
      decide(choice);
      if (engine.pendingChoice) break; // decider left it unresolved — avoid a loop
      continue;
    }
    if (!engine.canAdvance) break;
    engine.advance();
  }
}

describe('linear flow', () => {
  it('walks start → task → end and completes', () => {
    const engine = new SimulationEngine(linear());
    expect(engine.state.tokens).toEqual([{ id: 't0', nodeId: 's' }]);
    engine.advance();
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['a']);
    engine.advance();
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['e']);
    engine.advance();
    expect(engine.complete).toBe(true);
    expect(engine.state.traversedEdges.sort()).toEqual(['e0', 'e1']);
    expect(engine.state.trail.at(-1)?.type).toBe('end');
  });
});

describe('XOR split', () => {
  it('pauses for a choice and surfaces the flow labels', () => {
    const engine = new SimulationEngine(xorSplit());
    engine.advance(); // s → x
    const choice = engine.pendingChoice;
    expect(choice?.kind).toBe('exclusive');
    expect(choice?.multiple).toBe(false);
    expect(choice?.options.map((o) => o.label)).toEqual(['approve', 'reject']);
    expect(engine.canAdvance).toBe(false); // must choose first
  });

  it('follows the chosen branch only', () => {
    const engine = new SimulationEngine(xorSplit());
    engine.advance();
    const choice = engine.pendingChoice!;
    engine.choose({ kind: 'exclusive', gateway: 'x', edge: choice.options[1].edgeId }); // reject
    run(engine);
    expect(engine.complete).toBe(true);
    expect(engine.state.traversedEdges).toContain('e2'); // x->no
    expect(engine.state.traversedEdges).not.toContain('e1'); // x->ok not taken
  });
});

describe('AND split / join', () => {
  it('produces N tokens and the join synchronizes them', () => {
    const engine = new SimulationEngine(andParallel());
    engine.advance(); // s → f
    engine.advance(); // f splits
    expect(engine.state.tokens.map((t) => t.nodeId).sort()).toEqual(['a', 'b']);
    engine.advance(); // a → j (wait); a absorbed, b still resting
    const waiting = engine.state.trail.at(-1);
    expect(waiting?.type).toBe('join-wait');
    expect(waiting?.message).toContain('1 of 2');
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['b']); // a absorbed at the join
    engine.advance(); // b → j (fire)
    expect(engine.state.trail.some((t) => t.type === 'join-fire')).toBe(true);
    run(engine);
    expect(engine.complete).toBe(true);
  });
});

describe('the trap: XOR-split → AND-join', () => {
  it('deadlocks at the join exactly as soundness predicts', () => {
    const engine = new SimulationEngine(trap());
    engine.advance(); // s → x
    engine.choose({ kind: 'exclusive', gateway: 'x', edge: 'e1' }); // x → a
    run(engine);
    expect(engine.complete).toBe(false);
    expect(engine.deadlocked).toBe(true);
    expect(engine.state.joinArrivals.j).toEqual(['e3']); // 1 of 2 forever
  });
});

describe('event-based gateway', () => {
  it('races the catch events as an exclusive choice', () => {
    const engine = new SimulationEngine(eventBased());
    engine.advance(); // s → g
    const choice = engine.pendingChoice;
    expect(choice?.kind).toBe('eventBased');
    expect(choice?.options.map((o) => o.label)).toEqual(['message', 'timer']);
    engine.choose({ kind: 'eventBased', gateway: 'g', edge: choice!.options[0].edgeId });
    run(engine);
    expect(engine.complete).toBe(true);
  });
});

describe('inclusive (OR) — approximate', () => {
  it('flags approximate semantics and joins the activated branches', () => {
    const engine = new SimulationEngine(orRegion());
    expect(engine.hasApproximateSemantics).toBe(true);
    engine.advance(); // s → o
    const choice = engine.pendingChoice!;
    expect(choice.kind).toBe('inclusive');
    expect(choice.multiple).toBe(true);
    expect(choice.approximate).toBe(true);
    engine.choose({ kind: 'inclusive', gateway: 'o', edges: choice.options.map((o) => o.edgeId) });
    run(engine);
    expect(engine.complete).toBe(true);
    expect(engine.state.trail.some((t) => t.type === 'join-fire' && t.approximate)).toBe(true);
  });

  it('fires the OR-join on the first arrival when only one branch is activated', () => {
    const engine = new SimulationEngine(orRegion());
    engine.advance();
    const choice = engine.pendingChoice!;
    engine.choose({ kind: 'inclusive', gateway: 'o', edges: [choice.options[0].edgeId] }); // left only
    run(engine);
    expect(engine.complete).toBe(true);
    expect(engine.state.traversedEdges).not.toContain('e2'); // right branch never ran
  });

  it('fires the OR-join when an activated branch diverges away from it (no false deadlock)', () => {
    // o activates a AND b; b reaches an XOR that can either reach the join (x->j)
    // or leave the region (x->gone). Taking the exit must still let the join fire
    // on the single arrival it received — the local heuristic stranded it here.
    const diagram = flow(
      [
        's:startEvent', 'o:inclusiveGateway', 'a:task', 'b:task', 'x:exclusiveGateway',
        'away:task', 'j:inclusiveGateway', 'e:endEvent', 'gone:endEvent',
      ],
      ['s->o', 'o->a', 'o->b', 'a->j', 'b->x', 'x->j', 'x->away', 'away->gone', 'j->e'],
    );
    const engine = new SimulationEngine(diagram);
    engine.advance(); // s → o
    const orChoice = engine.pendingChoice!;
    expect(orChoice.kind).toBe('inclusive');
    engine.choose({ kind: 'inclusive', gateway: 'o', edges: orChoice.options.map((o) => o.edgeId) });
    for (let i = 0; i < 20 && engine.pendingChoice?.nodeId !== 'x'; i++) engine.advance();
    expect(engine.pendingChoice?.nodeId).toBe('x');
    const awayEdge = engine.pendingChoice!.options.find((o) => o.targetId === 'away')!.edgeId;
    engine.choose({ kind: 'exclusive', gateway: 'x', edge: awayEdge }); // diverge away from the join
    for (let i = 0; i < 20 && engine.canAdvance; i++) engine.advance();
    expect(engine.deadlocked).toBe(false);
    expect(engine.complete).toBe(true);
    expect(engine.state.traversedEdges).toContain('e6'); // x → away taken
    expect(engine.state.traversedEdges).not.toContain('e5'); // x → j never taken
    expect(engine.state.traversedEdges).toContain('e8'); // j → e: the join still fired
  });

  it('terminates for an OR-join inside a loop (dominance prevents a spurious wait)', () => {
    const diagram = flow(
      [
        's:startEvent', 'o:inclusiveGateway', 'a:task', 'b:task',
        'j:inclusiveGateway', 'r:exclusiveGateway', 'e:endEvent',
      ],
      ['s->o', 'o->a', 'o->b', 'a->j', 'b->j', 'j->r', 'r->o:again', 'r->e:done'],
    );
    const engine = new SimulationEngine(diagram);
    engine.advance(); // s → o
    engine.choose({
      kind: 'inclusive',
      gateway: 'o',
      edges: engine.pendingChoice!.options.map((o) => o.edgeId),
    });
    for (let i = 0; i < 30 && engine.pendingChoice?.nodeId !== 'r'; i++) engine.advance();
    expect(engine.pendingChoice?.nodeId).toBe('r'); // join fired, token reached the loop gateway
    const exit = engine.pendingChoice!.options.find((o) => o.targetId === 'e')!.edgeId;
    engine.choose({ kind: 'exclusive', gateway: 'r', edge: exit });
    for (let i = 0; i < 30 && engine.canAdvance; i++) engine.advance();
    expect(engine.complete).toBe(true);
  });
});

describe('boundary events', () => {
  it('interrupting boundary moves the token off the host', () => {
    const engine = new SimulationEngine(threePaths());
    engine.advance(); // s → prod
    const boundaries = engine.boundaryOptions;
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0]).toMatchObject({ host: 'prod', boundary: 'timer', interrupting: true });
    engine.fireBoundary('timer');
    expect(engine.state.tokens.map((t) => t.nodeId)).toEqual(['timer']);
    run(engine);
    expect(engine.complete).toBe(true);
    expect(engine.state.traversedEdges).toContain('e6'); // timer → timedout
    expect(engine.state.traversedEdges).not.toContain('e1'); // prod → x never taken
  });

  it('non-interrupting boundary spawns a second token, host keeps running', () => {
    const engine = new SimulationEngine(nonInterruptingBoundary());
    engine.advance(); // s → a
    expect(engine.boundaryOptions[0]).toMatchObject({ interrupting: false });
    engine.fireBoundary('sig');
    expect(engine.state.tokens.map((t) => t.nodeId).sort()).toEqual(['a', 'sig']);
    run(engine);
    expect(engine.complete).toBe(true);
    // both the host end and the boundary end were reached
    expect(engine.state.traversedEdges).toEqual(expect.arrayContaining(['e0', 'e1', 'e2']));
  });
});

describe('errors', () => {
  it('rejects a choice for the wrong edge', () => {
    const engine = new SimulationEngine(xorSplit());
    engine.advance();
    expect(() => engine.choose({ kind: 'exclusive', gateway: 'x', edge: 'nope' })).toThrow(
      SimulationError,
    );
  });

  it('rejects firing a boundary with no token on its host', () => {
    const engine = new SimulationEngine(threePaths());
    expect(() => engine.fireBoundary('timer')).toThrow(SimulationError);
  });
});
