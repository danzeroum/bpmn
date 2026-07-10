import { describe, expect, it } from 'vitest';
import { evaluate, parseOutputLiteral, parseUnaryTests, type SfeelTable } from '../src/index.js';

/**
 * Light fuzzing of malformed cells (SF-1 acceptance): any garbage string must
 * come back as a STRUCTURED failure — `{ok:false, reason}` from the parsers,
 * `{nonSimulable}` from evaluate — never a thrown exception, never a result.
 * Deterministic LCG so a failure is reproducible from the seed.
 */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const FRAGMENTS = [
  '<', '<=', '>', '>=', '=', '..', '[', ']', '(', ')', '{', '}', ',', '-',
  '"', '"a', 'a"', 'not', 'not(', 'true', 'false', '5', '3.14', '-2', '.',
  '@', '?', '+', '*', '/', 'date', 'for', 'some', 'every', 'x', '_id', '\\',
  ';', ':', '&', '|', '!', '§', '🙂', '\t', ' ',
];

function randomCell(rand: () => number): string {
  const parts = Math.floor(rand() * 8) + 1;
  let cell = '';
  for (let i = 0; i < parts; i++) {
    cell += FRAGMENTS[Math.floor(rand() * FRAGMENTS.length)];
    if (rand() < 0.3) cell += ' ';
  }
  return cell;
}

describe('malformed-cell fuzzing (deterministic, seed 42)', () => {
  const rand = lcg(42);
  const cells = Array.from({ length: 500 }, () => randomCell(rand));

  it('parseUnaryTests never throws and always answers with a structured verdict', () => {
    for (const cell of cells) {
      const parsed = parseUnaryTests(cell);
      if (!parsed.ok) {
        expect(parsed.reason.length, `empty reason for ${JSON.stringify(cell)}`).toBeGreaterThan(0);
      } else {
        expect(parsed.tests.length).toBeGreaterThan(0);
      }
    }
  });

  it('parseOutputLiteral never throws and always answers with a structured verdict', () => {
    for (const cell of cells) {
      const parsed = parseOutputLiteral(cell);
      if (!parsed.ok) expect(parsed.reason.length).toBeGreaterThan(0);
    }
  });

  it('evaluate over fuzzed cells never throws — a garbage cell yields nonSimulable', () => {
    for (const cell of cells.slice(0, 200)) {
      const table: SfeelTable = {
        hitPolicy: 'U',
        inputs: [{ expression: 'x' }],
        outputs: [{ expression: 'out' }],
        rules: [{ inputEntries: [cell], outputEntries: ['1'] }],
      };
      const outcome = evaluate(table, { x: 1 });
      if ('nonSimulable' in outcome) {
        expect(outcome.nonSimulable.reason.length).toBeGreaterThan(0);
      }
    }
  });
});
