import type { ArtifactAdapter } from './types.js';

export interface AdapterWarning {
  adapterId: string;
  message: string;
}

export interface RegisterAdaptersOptions {
  onWarning?: (warning: AdapterWarning) => void;
}

/**
 * Validates adapters at registration time (Handoff 6 §3: warning, never
 * crash). Invalid adapters are dropped; a duplicate id keeps the first
 * registration and drops the later one.
 */
export function registerAdapters(
  adapters: readonly ArtifactAdapter[],
  options: RegisterAdaptersOptions = {},
): ArtifactAdapter[] {
  const warn = options.onWarning ?? (() => undefined);
  const accepted = new Map<string, ArtifactAdapter>();
  for (const adapter of adapters) {
    const id = typeof adapter.id === 'string' ? adapter.id.trim() : '';
    if (!id) {
      warn({ adapterId: '', message: 'adapter dropped: id must be a non-empty string' });
      continue;
    }
    const typeLabel = typeof adapter.typeLabel === 'string' ? adapter.typeLabel.trim() : '';
    if (!typeLabel) {
      warn({ adapterId: id, message: 'adapter dropped: typeLabel must be a non-empty string' });
      continue;
    }
    if (accepted.has(id)) {
      warn({ adapterId: id, message: `adapter dropped: duplicate id "${id}" (first registration wins)` });
      continue;
    }
    accepted.set(id, adapter);
  }
  return [...accepted.values()];
}
