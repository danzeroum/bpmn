import { describe, expect, it } from 'vitest';
import { parseLedgerAnswer } from '../src/index.js';

/**
 * C6 — the citability golden rule (Handoff 9 §4/§10), enforced LOCALLY:
 * every claim must be anchored in a REAL entry hash; no citable entry →
 * "não encontrei registro"; an invented hash poisons the whole answer.
 */
const KNOWN = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];

describe('parseLedgerAnswer (C6)', () => {
  it('accepts an answer whose every citation is a real entry hash', () => {
    const raw = JSON.stringify({ answer: 'carla aprovou a v2.0.0.', citations: [KNOWN[1]] });
    const result = parseLedgerAnswer(raw, KNOWN);
    expect(result).toEqual({ ok: true, answer: 'carla aprovou a v2.0.0.', citations: [KNOWN[1]] });
  });

  it('tolerates a ```json fence and dedupes repeated citations', () => {
    const raw = '```json\n' + JSON.stringify({ answer: 'ok', citations: [KNOWN[0], KNOWN[0]] }) + '\n```';
    const result = parseLedgerAnswer(raw, KNOWN);
    expect(result).toEqual({ ok: true, answer: 'ok', citations: [KNOWN[0]] });
  });

  it('NO citations → not ok ("não encontrei registro"), never a bare answer', () => {
    const result = parseLedgerAnswer(JSON.stringify({ answer: 'inventei', citations: [] }), KNOWN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('nenhuma entrada de ledger citável');
  });

  it('ONE invented hash poisons the WHOLE answer (integral rejection)', () => {
    const fake = 'f'.repeat(64);
    const raw = JSON.stringify({ answer: 'meio verdade', citations: [KNOWN[0], fake] });
    const result = parseLedgerAnswer(raw, KNOWN);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain(`'${fake.slice(0, 12)}…'`);
      expect(result.reason).toContain('não corresponde a nenhuma entrada');
    }
  });

  it.each([
    ['not JSON at all', 'quem aprovou foi carla', 'not valid JSON'],
    ['a JSON array', '[1,2]', 'must be an object'],
    ['a JSON scalar', '"resposta"', 'must be an object'],
    ['missing answer', '{"citations": []}', "non-empty string 'answer'"],
    ['empty answer', '{"answer": "  ", "citations": []}', "non-empty string 'answer'"],
    ['citations not an array', '{"answer": "x", "citations": "abc"}', "'citations' array"],
    ['non-string citation', '{"answer": "x", "citations": [1]}', "'citations' array"],
  ])('malformed response (%s) → structured error, never a throw', (_label, raw, fragment) => {
    const result = parseLedgerAnswer(raw, KNOWN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(fragment);
  });

  it('is pure/read-only: the hash source is never mutated', () => {
    const hashes = [...KNOWN];
    parseLedgerAnswer(JSON.stringify({ answer: 'x', citations: [KNOWN[0]] }), hashes);
    expect(hashes).toEqual(KNOWN);
  });
});
