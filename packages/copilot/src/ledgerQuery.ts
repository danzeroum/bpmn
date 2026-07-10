/**
 * C6 — consulta ao ledger (Handoff 9 §4): the citability golden rule,
 * enforced LOCALLY. A provider answer is only surfaced when EVERY citation
 * resolves to a real entry hash the host supplied:
 *
 * - no citations at all → there is no evidence, the UI must say
 *   "não encontrei registro" instead of the answer;
 * - ONE invented hash poisons the whole answer (the same integral-rejection
 *   posture as §1.3) — a fabricated citation IS invention.
 *
 * Read-only like C3: these are pure functions over strings — nothing here can
 * append to (or even see) a ledger object.
 */
export type LedgerQueryResult =
  | { ok: true; answer: string; citations: string[] }
  | { ok: false; reason: string };

/**
 * Parses the provider's raw completion for a ledger query and applies the
 * citability rule against `knownHashes` (the hashes of the REAL entries the
 * host passed as context). Malformed responses and un-citable answers come
 * back as structured `ok: false` — never an exception, never a bare answer.
 */
export function parseLedgerAnswer(raw: string, knownHashes: Iterable<string>): LedgerQueryResult {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'provider response is not valid JSON' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, reason: 'answer must be an object' };
  }
  const p = data as Record<string, unknown>;
  if (typeof p.answer !== 'string' || p.answer.trim() === '') {
    return { ok: false, reason: "answer needs a non-empty string 'answer'" };
  }
  if (!Array.isArray(p.citations) || p.citations.some((c) => typeof c !== 'string')) {
    return { ok: false, reason: "answer needs a 'citations' array of entry hashes" };
  }
  const citations = p.citations as string[];
  if (citations.length === 0) {
    return { ok: false, reason: 'nenhuma entrada de ledger citável sustenta a resposta' };
  }
  const known = new Set(knownHashes);
  const invented = citations.find((hash) => !known.has(hash));
  if (invented !== undefined) {
    return {
      ok: false,
      reason: `citação '${invented.slice(0, 12)}…' não corresponde a nenhuma entrada do ledger`,
    };
  }
  return { ok: true, answer: p.answer, citations: [...new Set(citations)] };
}
