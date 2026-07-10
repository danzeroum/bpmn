import { mergeMessages, type Messages } from './messages.js';
import { FRAGMENTS } from './fragments/index.js';

/**
 * Brazilian Portuguese dictionary (Handoff 11 N-6) — the SECOND official
 * dictionary, assembled from every surface fragment. It proves the injection
 * prop end-to-end: the strings that used to be embedded pt-BR literals across
 * the react/studio surfaces now live in the fragments and are selected only
 * when the host passes `messages={PT_BR}`. Any key missing here falls back to
 * English (see `EN`), so a fragment may lag a key without breaking the UI.
 */
export const PT_BR: Messages = mergeMessages(...FRAGMENTS.map((f) => f.ptBR));
