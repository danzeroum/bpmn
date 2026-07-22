/**
 * JSON canônico EXATO (invariante 2 do ADR-0001): chaves de objeto em ordem
 * lexicográfica, recursivamente; arrays preservam ordem (a ordem de arrays no
 * estado É semântica — tokens/waits em ordem determinística de criação;
 * `joinArrivals` já é gravado ordenado, condição c).
 *
 * Mesmo (state, event) ⇒ mesma string, byte a byte. É o comparador do corpus
 * de replay (D6) e da equivalência simulation×engine.
 */
export function canonicalJsonExact(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      out[key] = sortKeysDeep(record[key]);
    }
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('canonicalJsonExact: número não finito não é serializável');
  }
  return value;
}
