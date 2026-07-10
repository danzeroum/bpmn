import { mergeMessages, type Messages } from './messages.js';
import { FRAGMENTS } from './fragments/index.js';

/**
 * English dictionary — the COMPLETE embedded fallback (Handoff 11 N-6),
 * assembled from every surface fragment. Any key a host-injected dictionary
 * omits resolves to the English string here, so a partial translation degrades
 * to English one key at a time instead of showing a raw key.
 *
 * Plural pairs use `_one` / `_other` siblings selected by `params.count`;
 * interpolation tokens are `{name}` (single-pass, no ICU).
 */
export const EN: Messages = mergeMessages(...FRAGMENTS.map((f) => f.en));
