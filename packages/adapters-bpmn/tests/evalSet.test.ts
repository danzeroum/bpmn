import { describe, expect, it } from 'vitest';
import { RESEARCH_AGENT, type EvalSet, type Fixtures } from '@buildtovalue/agentflow';
import { evalPromotionGate, evalSetAdapter } from '../src/index.js';

const RESEARCH_FIXTURES: Fixtures = {
  'llm-1': {
    outputs: [
      { query: 'q', is_complete: false, answer: 'partial', sources: ['a'] },
      { is_complete: true, answer: 'fonte a and b', sources: ['a', 'b'] },
    ],
  },
  'tool-2': { outputs: [{ results: ['a'] }, { results: ['a', 'b'] }] },
};

const evalSet = (over: Partial<EvalSet> = {}): EvalSet => ({
  kind: 'EvalSet',
  id: 'eval:rsch-base',
  version: '1.0.0',
  targetRef: 'agnt-rsch@2.1.0',
  promotionThreshold: 1.0,
  cases: [
    {
      name: 'answers with fonte',
      fixtures: RESEARCH_FIXTURES,
      assertions: [{ kind: 'contains', path: 'answer', value: 'fonte' }, { kind: 'schema' }],
    },
  ],
  ...over,
});

describe('evalSetAdapter (Squad Lane SL-7)', () => {
  const old: EvalSet = { ...evalSet(), version: '0.9.0' };
  const adapter = evalSetAdapter([old, evalSet()]);

  it('lists one artifact per id with the newest version + target/threshold meta', async () => {
    const items = await adapter.list({});
    expect(items).toHaveLength(1);
    expect(items[0].version).toBe('1.0.0');
    expect(items[0].typeLabel).toBe('AVALIAÇÃO');
    expect(items[0].meta).toMatch(/alvo agnt-rsch@2\.1\.0 · 1 caso\(s\) · limiar 100%/);
  });

  it('get() returns a read-only detail with the version timeline', async () => {
    const detail = await adapter.get('eval:rsch-base');
    expect(detail.versions.map((v) => v.version)).toEqual(['1.0.0', '0.9.0']);
    expect(detail.actions).toEqual([]);
    expect(detail.changeSummary).toMatch(/regex\/contains\/schema/);
  });

  it('get() rejects an unknown eval set', async () => {
    await expect(adapter.get('eval:ghost')).rejects.toThrow(/unknown eval set "eval:ghost"/);
  });
});

describe('evalPromotionGate (Squad Lane SL-7)', () => {
  it('allows promotion when the eval meets its threshold', () => {
    expect(evalPromotionGate(RESEARCH_AGENT, evalSet()).allowed).toBe(true);
  });

  it('blocks with EVAL_BELOW_THRESHOLD naming pass/total below threshold', () => {
    const set = evalSet();
    set.cases[0].assertions = [{ kind: 'contains', path: 'answer', value: 'ABSENT' }, { kind: 'schema' }];
    const verdict = evalPromotionGate(RESEARCH_AGENT, set, 'pt');
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/EVAL_BELOW_THRESHOLD/);
    expect(verdict.reason).toMatch(/1\/2/); // one of two assertions passed
  });

  it('degrades honestly: an eval with no assertions never blocks', () => {
    expect(evalPromotionGate(RESEARCH_AGENT, evalSet({ cases: [{ name: 'empty', assertions: [] }] })).allowed).toBe(
      true,
    );
  });
});
