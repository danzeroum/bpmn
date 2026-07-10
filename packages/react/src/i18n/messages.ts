/**
 * Zero-dependency i18n primitive (Handoff 11 N-6). The host injects a message
 * dictionary by prop; there is NO automatic locale detection and NO runtime
 * dependency — the host decides which dictionary to pass. English (`EN`) is the
 * complete, embedded fallback: any key missing from the injected dictionary
 * resolves to its English string, so a partial translation degrades to English
 * one key at a time instead of showing a raw key.
 *
 * Interpolation is a single pass of `{token}` replacement (no ICU). Plurals use
 * explicit sibling keys — `foo_one` / `foo_other` — selected by `params.count`;
 * a caller asks for the base key `foo` and the engine picks the sibling.
 */
export type Messages = Record<string, string>;

export type TParams = Record<string, string | number>;

/** `t(key, params?)` — resolve a key against the active dictionary. */
export type TFunction = (key: string, params?: TParams) => string;

/**
 * Resolve `key` against `dict`, falling back to `fallback` (always `EN`) per
 * key, then to the key itself as a last-resort dev signal. Applies plural
 * selection and `{token}` interpolation.
 */
export function translate(
  dict: Messages,
  fallback: Messages,
  key: string,
  params?: TParams,
): string {
  const resolvedKey = pluralKey(dict, fallback, key, params);
  const template = dict[resolvedKey] ?? fallback[resolvedKey] ?? fallback[key] ?? key;
  return interpolate(template, params);
}

/**
 * When `params.count` is a number, prefer the `_one` / `_other` sibling of
 * `key` (count === 1 → `_one`, otherwise `_other`), but only if that sibling
 * exists in the active dictionary or the fallback. Otherwise the base key.
 */
function pluralKey(dict: Messages, fallback: Messages, key: string, params?: TParams): string {
  if (params && typeof params.count === 'number') {
    const suffix = params.count === 1 ? '_one' : '_other';
    const candidate = key + suffix;
    if (candidate in dict || candidate in fallback) return candidate;
  }
  return key;
}

/** Replace `{token}` with `params[token]`; unknown tokens are left verbatim. */
function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Shallow-merge dictionaries left-to-right (later wins). Hosts use this to
 * extend an official dictionary with their own overrides without losing the
 * embedded EN fallback (missing keys still resolve to EN at lookup time).
 */
export function mergeMessages(...dicts: Messages[]): Messages {
  return Object.assign({}, ...dicts);
}
