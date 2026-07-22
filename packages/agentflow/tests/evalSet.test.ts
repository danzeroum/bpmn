import { describe, expect, it } from 'vitest';
import {
  finalOutput,
  RESEARCH_AGENT,
  runEvalSet,
  simulate,
  type EvalSet,
  type Fixtures,
} from '../src/index.js';

const RESEARCH_FIXTURES: Fixtures = {
  'llm-1': {
    outputs: [
      { query: 'q', is_complete: false, answer: 'partial', sources: ['a'] },
      { is_complete: true, answer: 'fonte a and fonte b', sources: ['a', 'b'] },
    ],
  },
  'tool-2': { outputs: [{ results: ['a'] }, { results: ['a', 'b'] }] },
};

describe('finalOutput (Squad Lane SL-7)', () => {
  it('recovers the merged output from a completed run', () => {
    const out = finalOutput(simulate(RESEARCH_AGENT, { fixtures: RESEARCH_FIXTURES }));
    expect(out).toMatchObject({ is_complete: true, answer: 'fonte a and fonte b' });
  });

  it('is undefined when the run blocked (no end record)', () => {
    const blocked = simulate(RESEARCH_AGENT, { fixtures: RESEARCH_FIXTURES, budget: { maxSteps: 1 } });
    expect(blocked.blockedDecision).not.toBeNull();
    expect(finalOutput(blocked)).toBeUndefined();
  });

  it('pins the simulate end-message format by contract — changing it MUST break here', () => {
    // finalOutput parses the run's output out of the `end` trail message. That
    // message is a HEADLESS, EN, never-localized string emitted by simulate.ts.
    // If the format (or i18n) ever changes, this contract test breaks LOUDLY
    // rather than the eval score degrading in silence ("falha declarada").
    const state = simulate(RESEARCH_AGENT, { fixtures: RESEARCH_FIXTURES });
    const end = state.trail.at(-1)!;
    expect(end.type).toBe('end');
    expect(end.message).toMatch(/^✓ end · \{/); // the exact prefix finalOutput slices on
    expect(end.message).toBe(`✓ end · ${JSON.stringify(finalOutput(state))}`);
  });
});

describe('runEvalSet (Squad Lane SL-7)', () => {
  const evalSet = (over: Partial<EvalSet> = {}): EvalSet => ({
    kind: 'EvalSet',
    id: 'eval:rsch-base',
    version: '1.0.0',
    targetRef: 'agnt-rsch@2.1.0',
    promotionThreshold: 1.0,
    cases: [
      {
        name: 'answers with fonte + schema + no email',
        input: { query: 'garantia' },
        fixtures: RESEARCH_FIXTURES,
        assertions: [
          { kind: 'contains', path: 'answer', value: 'fonte' },
          { kind: 'schema' },
          { kind: 'regex', path: 'answer', pattern: '^(?!.*@).*$' },
        ],
      },
    ],
    ...over,
  });

  it('passes when every assertion holds (contains/schema/regex)', () => {
    const report = runEvalSet(evalSet(), RESEARCH_AGENT);
    expect(report.passed).toBe(3);
    expect(report.total).toBe(3);
    expect(report.passRate).toBe(1);
    expect(report.meetsThreshold).toBe(true);
    expect(report.cases[0].passed).toBe(true);
  });

  it('fails a contains assertion honestly and drops below threshold', () => {
    const set = evalSet();
    set.cases[0].assertions[0] = { kind: 'contains', path: 'answer', value: 'ABSENT' };
    const report = runEvalSet(set, RESEARCH_AGENT);
    expect(report.passed).toBe(2);
    expect(report.total).toBe(3);
    expect(report.meetsThreshold).toBe(false);
    expect(report.cases[0].assertions[0].passed).toBe(false);
  });

  it('a regex assertion catches a forbidden pattern (an @ in the answer)', () => {
    const set = evalSet();
    set.cases[0].fixtures = {
      'llm-1': { outputs: [{ is_complete: true, answer: 'contact me@x.com', sources: ['a'] }] },
      'tool-2': { outputs: [{ results: ['a'] }] },
    };
    const report = runEvalSet(set, RESEARCH_AGENT);
    // the no-@ regex now fails; contains "fonte" also fails → only schema passes
    expect(report.cases[0].assertions.find((a) => a.kind === 'regex')?.passed).toBe(false);
    expect(report.meetsThreshold).toBe(false);
  });

  it('a blocked run fails every assertion of the case', () => {
    const set = evalSet();
    set.cases[0].fixtures = { 'llm-1': { outputs: [{ is_complete: false }] }, 'tool-2': { outputs: [{}] } };
    // is_complete never true and the loop is bounded → retry exhausts → blocked
    const report = runEvalSet(set, RESEARCH_AGENT);
    expect(report.cases[0].completed).toBe(false);
    expect(report.passed).toBe(0);
    expect(report.meetsThreshold).toBe(false);
  });

  it('is deterministic — same fixtures 10× → identical report', () => {
    const set = evalSet();
    const runs = Array.from({ length: 10 }, () => JSON.stringify(runEvalSet(set, RESEARCH_AGENT)));
    expect(new Set(runs).size).toBe(1);
  });

  it('no assertions → total 0, passRate 1 (nothing to fail)', () => {
    const report = runEvalSet(evalSet({ cases: [{ name: 'empty', assertions: [] }] }), RESEARCH_AGENT);
    expect(report.total).toBe(0);
    expect(report.passRate).toBe(1);
    expect(report.meetsThreshold).toBe(true);
  });
});
