/**
 * SHA-256 via Web Crypto (`crypto.subtle`), available in modern browsers and
 * Node.js ≥ 20 without imports — keeping the zero-dependency policy.
 */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deterministic JSON: object keys sorted recursively, numbers rounded to two
 * decimals so float noise never changes a hash or a diff.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (typeof value === 'number') return roundCoord(value);
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const result: Record<string, unknown> = {};
    for (const [key, v] of entries) result[key] = sortValue(v);
    return result;
  }
  return value;
}

export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}
