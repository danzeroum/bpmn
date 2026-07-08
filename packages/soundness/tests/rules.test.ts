import { describe, expect, it } from 'vitest';
import {
  createDiagram,
  createEdge,
  createNode,
  LifecycleEngine,
  ValidationEngine,
  type BpmnDiagram,
  type ValidationIssue,
} from '@bpmn-react/core';
import { analyzeSoundness, soundnessPromotionRule, soundnessRules, SOUNDNESS_RULES } from '../src/index.js';

/** Terse builder: nodes as `id:type`, edges as `source->target`. */
function flow(nodeSpecs: string[], edgeSpecs: string[], patch?: (d: BpmnDiagram) => void): BpmnDiagram {
  const diagram = createDiagram({ name: 'Fixture' });
  for (const spec of nodeSpecs) {
    const [id, type] = spec.split(':');
    diagram.nodes[id] = createNode({ id, type, label: id, x: 0, y: 0 });
  }
  edgeSpecs.forEach((spec, index) => {
    const [sourceId, targetId] = spec.split('->');
    const id = `e${index}`;
    diagram.edges[id] = createEdge({ id, sourceId, targetId });
  });
  patch?.(diagram);
  return diagram;
}

const codes = (issues: ValidationIssue[]) => issues.map((issue) => issue.code);

describe('SND_DEADLOCK_JOIN', () => {
  it('fires on the classic trap: XOR-split feeding an AND-join', () => {
    const diagram = flow(
      ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'j:parallelGateway', 'e:endEvent'],
      ['s->x', 'x->a', 'x->b', 'a->j', 'b->j', 'j->e'],
    );
    const issues = analyzeSoundness(diagram);
    const deadlock = issues.filter((issue) => issue.code === 'SND_DEADLOCK_JOIN');
    expect(deadlock).toHaveLength(1);
    expect(deadlock[0].severity).toBe('error');
    expect(deadlock[0].nodeId).toBe('j');
    expect(deadlock[0].message).toContain('only one');
  });

  it('stays quiet on the sound AND-split → AND-join pair', () => {
    const diagram = flow(
      ['s:startEvent', 'f:parallelGateway', 'a:task', 'b:task', 'j:parallelGateway', 'e:endEvent'],
      ['s->f', 'f->a', 'f->b', 'a->j', 'b->j', 'j->e'],
    );
    expect(codes(analyzeSoundness(diagram))).not.toContain('SND_DEADLOCK_JOIN');
  });

  it('fires when the event-based gateway plays the exclusive split', () => {
    const diagram = flow(
      [
        's:startEvent', 'g:eventBasedGateway', 'a:intermediateCatchEvent',
        'b:intermediateCatchEvent', 'j:parallelGateway', 'e:endEvent',
      ],
      ['s->g', 'g->a', 'g->b', 'a->j', 'b->j', 'j->e'],
    );
    expect(codes(analyzeSoundness(diagram))).toContain('SND_DEADLOCK_JOIN');
  });
});

describe('SND_UNMATCHED_SPLIT', () => {
  it('fires on an XOR-split whose branches never rejoin', () => {
    const diagram = flow(
      ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'ea:endEvent', 'eb:endEvent'],
      ['s->x', 'x->a', 'x->b', 'a->ea', 'b->eb'],
    );
    const issues = analyzeSoundness(diagram).filter((i) => i.code === 'SND_UNMATCHED_SPLIT');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].nodeId).toBe('x');
  });

  it('stays quiet when a same-type join exists downstream', () => {
    const diagram = flow(
      ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'm:exclusiveGateway', 'e:endEvent'],
      ['s->x', 'x->a', 'x->b', 'a->m', 'b->m', 'm->e'],
    );
    expect(codes(analyzeSoundness(diagram))).not.toContain('SND_UNMATCHED_SPLIT');
  });
});

describe('SND_NO_PATH_TO_END', () => {
  it('fires on a node that can never finish', () => {
    // stuck -> trap -> stuck: a two-node cycle off the happy path.
    const diagram = flow(
      ['s:startEvent', 't:task', 'e:endEvent', 'stuck:task', 'trap:task'],
      ['s->t', 't->e', 't->stuck', 'stuck->trap', 'trap->stuck'],
    );
    const issues = analyzeSoundness(diagram).filter((i) => i.code === 'SND_NO_PATH_TO_END');
    expect(issues.map((i) => i.nodeId).sort()).toEqual(['stuck', 'trap']);
    expect(issues[0].severity).toBe('error');
  });

  it('treats sink nodes as implicit ends when the scope has no end event', () => {
    const diagram = flow(['s:startEvent', 't:task'], ['s->t']);
    expect(codes(analyzeSoundness(diagram))).not.toContain('SND_NO_PATH_TO_END');
  });
});

describe('SND_INFINITE_LOOP', () => {
  it('fires on a cycle with no exit', () => {
    const diagram = flow(
      ['s:startEvent', 'a:task', 'b:task', 'c:task'],
      ['s->a', 'a->b', 'b->c', 'c->a'],
    );
    const issues = analyzeSoundness(diagram).filter((i) => i.code === 'SND_INFINITE_LOOP');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
  });

  it('stays quiet on a retry loop that has an exit edge', () => {
    const diagram = flow(
      ['s:startEvent', 'work:task', 'check:exclusiveGateway', 'e:endEvent'],
      ['s->work', 'work->check', 'check->work', 'check->e'],
    );
    expect(codes(analyzeSoundness(diagram))).not.toContain('SND_INFINITE_LOOP');
  });
});

describe('SND_DEAD_BRANCH', () => {
  it('fires on the outgoing edges of a gateway unreachable from the start', () => {
    const diagram = flow(
      ['s:startEvent', 't:task', 'e:endEvent', 'orphan:exclusiveGateway', 'a:task', 'b:task'],
      ['s->t', 't->e', 'orphan->a', 'orphan->b', 'a->e', 'b->e'],
    );
    const issues = analyzeSoundness(diagram).filter((i) => i.code === 'SND_DEAD_BRANCH');
    expect(issues).toHaveLength(2);
    expect(issues[0].severity).toBe('warning');
    expect(issues.every((i) => i.edgeId)).toBe(true);
  });

  it('stays quiet when every gateway is live (and when there is no start)', () => {
    const live = flow(
      ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'e:endEvent'],
      ['s->x', 'x->a', 'a->e'],
    );
    expect(codes(analyzeSoundness(live))).not.toContain('SND_DEAD_BRANCH');
    const noStart = flow(['x:exclusiveGateway', 'a:task', 'b:task'], ['x->a', 'x->b']);
    expect(codes(analyzeSoundness(noStart))).not.toContain('SND_DEAD_BRANCH');
  });
});

describe('SND_BOUNDARY_NO_OUTFLOW', () => {
  it('fires on a boundary event that goes nowhere', () => {
    const diagram = flow(
      ['s:startEvent', 'work:task', 'e:endEvent', 'bnd:boundaryEvent'],
      ['s->work', 'work->e'],
      (d) => {
        d.nodes.bnd.properties.attachedToRef = 'work';
      },
    );
    const issues = analyzeSoundness(diagram).filter((i) => i.code === 'SND_BOUNDARY_NO_OUTFLOW');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].nodeId).toBe('bnd');
  });

  it('stays quiet when the handler leads somewhere', () => {
    const diagram = flow(
      ['s:startEvent', 'work:task', 'e:endEvent', 'bnd:boundaryEvent', 'fix:task'],
      ['s->work', 'work->e', 'bnd->fix', 'fix->e'],
      (d) => {
        d.nodes.bnd.properties.attachedToRef = 'work';
      },
    );
    expect(codes(analyzeSoundness(diagram))).not.toContain('SND_BOUNDARY_NO_OUTFLOW');
  });
});

describe('SND_EVENT_GW_TARGETS', () => {
  it('fires when the gateway races a plain task', () => {
    const diagram = flow(
      ['s:startEvent', 'g:eventBasedGateway', 'msg:intermediateCatchEvent', 'oops:task', 'e:endEvent'],
      ['s->g', 'g->msg', 'g->oops', 'msg->e', 'oops->e'],
    );
    const issues = analyzeSoundness(diagram).filter((i) => i.code === 'SND_EVENT_GW_TARGETS');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('oops');
  });

  it('accepts catch events and receive tasks', () => {
    const diagram = flow(
      ['s:startEvent', 'g:eventBasedGateway', 'msg:intermediateCatchEvent', 'recv:receiveTask', 'e:endEvent'],
      ['s->g', 'g->msg', 'g->recv', 'msg->e', 'recv->e'],
    );
    expect(codes(analyzeSoundness(diagram))).not.toContain('SND_EVENT_GW_TARGETS');
  });
});

describe('SND_LANE_NO_ACTOR', () => {
  it('fires on an empty lane and stays quiet on a populated one', () => {
    const diagram = flow(
      ['s:startEvent', 't:task', 'e:endEvent', 'laneFull:lane', 'laneEmpty:lane'],
      ['s->t', 't->e'],
      (d) => {
        d.nodes.laneFull.properties.flowNodeRefs = ['t'];
      },
    );
    const issues = analyzeSoundness(diagram).filter((i) => i.code === 'SND_LANE_NO_ACTOR');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('info');
    expect(issues[0].nodeId).toBe('laneEmpty');
  });
});

describe('SND_IMPLICIT_MERGE', () => {
  it('fires on a task with two incoming flows', () => {
    const diagram = flow(
      ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'merge:task', 'e:endEvent'],
      ['s->x', 'x->a', 'x->b', 'a->merge', 'b->merge', 'merge->e'],
    );
    const issues = analyzeSoundness(diagram).filter((i) => i.code === 'SND_IMPLICIT_MERGE');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('info');
    expect(issues[0].nodeId).toBe('merge');
  });

  it('stays quiet when a gateway does the merging', () => {
    const diagram = flow(
      ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'm:exclusiveGateway', 'e:endEvent'],
      ['s->x', 'x->a', 'x->b', 'a->m', 'b->m', 'm->e'],
    );
    expect(codes(analyzeSoundness(diagram))).not.toContain('SND_IMPLICIT_MERGE');
  });
});

describe('hierarchy (F7): each sub-process is its own scope', () => {
  function nested(): BpmnDiagram {
    // Sound outer flow; the deadlock trap lives INSIDE the sub-process.
    return flow(
      [
        's:startEvent', 'sub:subProcess', 'e:endEvent',
        'is:startEvent', 'ix:exclusiveGateway', 'ia:task', 'ib:task', 'ij:parallelGateway', 'ie:endEvent',
      ],
      ['s->sub', 'sub->e', 'is->ix', 'ix->ia', 'ix->ib', 'ia->ij', 'ib->ij', 'ij->ie'],
      (d) => {
        for (const id of ['is', 'ix', 'ia', 'ib', 'ij', 'ie']) {
          d.nodes[id].properties.parentId = 'sub';
        }
      },
    );
  }

  it('finds the deadlock inside a sub-process', () => {
    const issues = analyzeSoundness(nested());
    const deadlock = issues.filter((i) => i.code === 'SND_DEADLOCK_JOIN');
    expect(deadlock).toHaveLength(1);
    expect(deadlock[0].nodeId).toBe('ij');
  });

  it('never mixes scopes: the outer end does not satisfy inner reachability', () => {
    // Inner task with no path to the INNER end; the outer scope stays sound.
    const diagram = flow(
      ['s:startEvent', 'sub:subProcess', 'e:endEvent', 'is:startEvent', 'stuckA:task', 'stuckB:task', 'ie:endEvent'],
      ['s->sub', 'sub->e', 'is->ie', 'is->stuckA', 'stuckA->stuckB', 'stuckB->stuckA'],
      (d) => {
        for (const id of ['is', 'stuckA', 'stuckB', 'ie']) d.nodes[id].properties.parentId = 'sub';
      },
    );
    const issues = analyzeSoundness(diagram).filter((i) => i.code === 'SND_NO_PATH_TO_END');
    expect(issues.map((i) => i.nodeId).sort()).toEqual(['stuckA', 'stuckB']);
  });
});

describe('a complex but sound process passes clean', () => {
  it('reports no errors or warnings', () => {
    // start → AND-split {a → xor-retry-loop; b} → AND-join → XOR-split
    // {c; d} → XOR-join → end, plus a boundary handler that rejoins.
    const diagram = flow(
      [
        's:startEvent', 'fork:parallelGateway', 'a:task', 'check:exclusiveGateway',
        'b:serviceTask', 'join:parallelGateway', 'x:exclusiveGateway', 'c:task',
        'd:task', 'm:exclusiveGateway', 'bnd:boundaryEvent', 'fix:task', 'e:endEvent',
      ],
      [
        's->fork', 'fork->a', 'fork->b', 'a->check', 'check->a', 'check->join',
        'b->join', 'join->x', 'x->c', 'x->d', 'c->m', 'd->m', 'm->e', 'bnd->fix', 'fix->e',
      ],
      (d) => {
        d.nodes.bnd.properties.attachedToRef = 'b';
      },
    );
    const issues = analyzeSoundness(diagram);
    expect(issues.filter((i) => i.severity !== 'info')).toEqual([]);
  });
});

describe('soundnessRules() configuration', () => {
  const trap = () =>
    flow(
      ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'j:parallelGateway', 'e:endEvent'],
      ['s->x', 'x->a', 'x->b', 'a->j', 'b->j', 'j->e'],
    );

  it('plugs into the core ValidationEngine (plugin format)', () => {
    const engine = new ValidationEngine(soundnessRules());
    const result = engine.validate(trap());
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain('SND_DEADLOCK_JOIN');
  });

  it('honors severityOverrides and disabled', () => {
    const softened = analyzeSoundness(trap(), {
      severityOverrides: { SND_DEADLOCK_JOIN: 'warning' },
    });
    expect(softened.find((i) => i.code === 'SND_DEADLOCK_JOIN')?.severity).toBe('warning');

    const disabled = analyzeSoundness(trap(), { disabled: ['SND_DEADLOCK_JOIN'] });
    expect(codes(disabled)).not.toContain('SND_DEADLOCK_JOIN');
  });

  it('speaks Portuguese on demand', () => {
    const issues = analyzeSoundness(trap(), { locale: 'pt' });
    expect(issues.find((i) => i.code === 'SND_DEADLOCK_JOIN')?.message).toContain('só um');
  });

  it('exposes the 9 stable rule definitions', () => {
    expect(SOUNDNESS_RULES).toHaveLength(9);
    for (const rule of SOUNDNESS_RULES) {
      expect(rule.code.startsWith('SND_')).toBe(true);
      expect(rule.title.en.length).toBeGreaterThan(0);
      expect(rule.title.pt.length).toBeGreaterThan(0);
    }
  });
});

describe('performance (aceite C2)', () => {
  it('analyzes 350 nodes in under 50ms', () => {
    // Chained blocks of AND-split/join pairs with retry loops — dense but sound.
    const nodeSpecs: string[] = ['s:startEvent'];
    const edgeSpecs: string[] = [];
    let previous = 's';
    const BLOCKS = 58; // 58 * 6 + 2 ≈ 350 nodes
    for (let i = 0; i < BLOCKS; i++) {
      nodeSpecs.push(
        `f${i}:parallelGateway`, `a${i}:task`, `b${i}:serviceTask`,
        `g${i}:exclusiveGateway`, `j${i}:parallelGateway`, `t${i}:userTask`,
      );
      edgeSpecs.push(
        `${previous}->f${i}`, `f${i}->a${i}`, `f${i}->b${i}`, `a${i}->g${i}`,
        `g${i}->a${i}`, `g${i}->j${i}`, `b${i}->j${i}`, `j${i}->t${i}`,
      );
      previous = `t${i}`;
    }
    nodeSpecs.push('e:endEvent');
    edgeSpecs.push(`${previous}->e`);
    const diagram = flow(nodeSpecs, edgeSpecs);
    expect(Object.keys(diagram.nodes).length).toBeGreaterThanOrEqual(350);

    analyzeSoundness(diagram); // warm-up (JIT) — the budget targets steady state
    const started = performance.now();
    const issues = analyzeSoundness(diagram);
    const elapsed = performance.now() - started;
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(elapsed).toBeLessThan(50);
  });
});

describe('soundnessPromotionRule (aceite C2 — gate de promoção)', () => {
  const trapDiagram = () =>
    flow(
      ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'j:parallelGateway', 'e:endEvent'],
      ['s->x', 'x->a', 'x->b', 'a->j', 'b->j', 'j->e'],
    );
  const actor = { id: 'u1', name: 'Ana', role: 'Owner' };

  it('blocks promotion to active with the offending codes in the reason', async () => {
    const rule = soundnessPromotionRule();
    const verdict = await rule({
      diagram: trapDiagram(),
      target: 'active',
      actor,
      reason: 'activate',
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('SND_DEADLOCK_JOIN');
  });

  it('never blocks other targets, and never blocks on warnings alone', async () => {
    const rule = soundnessPromotionRule();
    // Same unsound diagram, but the target is not 'active'.
    expect(
      (await rule({ diagram: trapDiagram(), target: 'test', actor, reason: 'r' })).allowed,
    ).toBe(true);
    // Warning-only diagram (unmatched split): promotion to active passes.
    const warningsOnly = flow(
      ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'ea:endEvent', 'eb:endEvent'],
      ['s->x', 'x->a', 'x->b', 'a->ea', 'b->eb'],
    );
    expect(
      (await rule({ diagram: warningsOnly, target: 'active', actor, reason: 'r' })).allowed,
    ).toBe(true);
  });

  it('integrates with LifecycleEngine.evaluateGates as a failing gate', async () => {
    const engine = new LifecycleEngine({
      minApprovalRoles: 0,
      minChangeSummaryLength: 0,
      promotionRules: [soundnessPromotionRule({ locale: 'pt' })],
    });
    const diagram = trapDiagram();
    diagram.version.status = 'candidate';
    const gates = await engine.evaluateGates({
      diagram,
      target: 'active',
      actor,
      reason: 'ok',
    });
    const ruleGate = gates.find((gate) => gate.id === 'rule:0');
    expect(ruleGate?.satisfied).toBe(false);
    expect(ruleGate?.detail).toContain('SND_DEADLOCK_JOIN');
    expect(ruleGate?.detail).toContain('bloqueiam');
    await expect(
      engine.promote({ diagram, target: 'active', actor, reason: 'ok' }),
    ).rejects.toThrow(/SND_DEADLOCK_JOIN/);
  });
});
