import { describe, expect, it } from 'vitest';
import { buildSimGraph } from '../src/graph.js';
import { computeDominators, dominates } from '../src/dominators.js';
import { flow } from './fixtures.js';

describe('dominators (Cooper–Harvey–Kennedy)', () => {
  it('computes dominance over a diamond', () => {
    // s → x → a → m ; x → b → m ; m → e
    const diagram = flow(
      ['s:startEvent', 'x:exclusiveGateway', 'a:task', 'b:task', 'm:exclusiveGateway', 'e:endEvent'],
      ['s->x', 'x->a', 'x->b', 'a->m', 'b->m', 'm->e'],
    );
    const dom = computeDominators(buildSimGraph(diagram));

    expect(dominates(dom, 's', 'e')).toBe(true); // the start dominates everything
    expect(dominates(dom, 'x', 'm')).toBe(true); // every path to the merge goes through x
    expect(dominates(dom, 'a', 'm')).toBe(false); // the b-branch reaches m without a
    expect(dominates(dom, 'b', 'm')).toBe(false);
    expect(dominates(dom, 'm', 'x')).toBe(false); // a node never dominates its predecessor
    expect(dominates(dom, 'a', 'a')).toBe(true); // reflexive
  });

  it('an OR-join in a loop dominates the nodes after it', () => {
    // s → pre → j(join) → r(split) → j (loop back) ; r → e
    const diagram = flow(
      ['s:startEvent', 'pre:task', 'j:inclusiveGateway', 'r:exclusiveGateway', 'e:endEvent'],
      ['s->pre', 'pre->j', 'j->r', 'r->j', 'r->e'],
    );
    const dom = computeDominators(buildSimGraph(diagram));

    // Every path from the start to r passes through j, so j dominates r — which
    // is exactly why a token at r must NOT hold the join open (it is a later
    // iteration, not the activation being synchronized).
    expect(dominates(dom, 'j', 'r')).toBe(true);
    expect(dominates(dom, 'j', 'e')).toBe(true);
    expect(dominates(dom, 'pre', 'j')).toBe(true);
    expect(dominates(dom, 'r', 'j')).toBe(false); // j is not reached only via r
  });
});
