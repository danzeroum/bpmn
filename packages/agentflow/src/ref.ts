/**
 * Versioned reference parsing (Handoff 12, A-1 decision — locked).
 *
 * The canonical reference form is the `id@semver` STRING, identical to the
 * callActivity `calledElement` convention (`agnt-rsch@2.1.0`,
 * `prm:research@2.0.0`). The `agnt-`/`prm:` prefixes are part of the ID
 * (naming convention), NOT reference syntax — the only structural separator is
 * the LAST `@`, so an id may itself contain `-`, `:` and `.`.
 *
 * A "ref born pinned" carries a full version (bindRun standard). This single
 * parser also accepts the two other reference shapes already in the tree so a
 * caller never has to branch on origin:
 *   - the `{ id, version }` object (copilot `PromptTemplateRef`);
 *   - the abbreviated `id@major` / `id@major.minor` display forms the Agent
 *     Studio prototype shows (`prm:research@2`, `agnt-verify@1.0`).
 *
 * Abbreviated versions are NORMALIZED to full `major.minor.patch` and reported
 * in `warnings` — the display form is never accepted silently as storage.
 * Everything here is pure and imports nothing (independence test).
 */

/** A parsed, normalized reference — always a full semantic version. */
export interface AgentRef {
  /** Bare id, e.g. "agnt-rsch" or "prm:research". */
  id: string;
  /** Full `major.minor.patch`. */
  version: string;
}

/** The input shapes {@link parseRef} accepts. */
export type RefInput = string | { id: string; version: string };

/** Outcome of parsing: the normalized ref plus any non-fatal normalizations. */
export interface ParsedRef {
  ref: AgentRef;
  /** Human-readable notes, e.g. an abbreviated version that was expanded. */
  warnings: string[];
}

/** Thrown when a reference is structurally invalid (no `@`, empty id, or a
 * version that is not a run of dot-separated integers). */
export class AgentRefError extends Error {
  constructor(
    message: string,
    readonly input: RefInput,
  ) {
    super(message);
    this.name = 'AgentRefError';
  }
}

const VERSION_PART = /^\d+(\.\d+){0,2}$/;

/**
 * Normalizes a version token to `major.minor.patch`. `2` → `2.0.0`,
 * `2.1` → `2.1.0`, `2.1.0` unchanged. Pushes a warning when it expands.
 */
function normalizeVersion(raw: string, warnings: string[], input: RefInput): string {
  const trimmed = raw.trim();
  if (!VERSION_PART.test(trimmed)) {
    throw new AgentRefError(
      `Invalid version "${raw}" — expected up to major.minor.patch integers`,
      input,
    );
  }
  const [major = '0', minor = '0', patch = '0'] = trimmed.split('.');
  const full = `${major}.${minor}.${patch}`;
  if (full !== trimmed) {
    warnings.push(
      `Reference version "${trimmed}" is an abbreviated display form; normalized to "${full}".`,
    );
  }
  return full;
}

/**
 * Parses any accepted reference shape into a normalized {@link AgentRef}.
 * Throws {@link AgentRefError} for structurally invalid input; abbreviated
 * versions are normalized and surfaced in `warnings`, not rejected.
 */
export function parseRef(input: RefInput): ParsedRef {
  const warnings: string[] = [];
  if (typeof input !== 'string') {
    const id = input.id?.trim() ?? '';
    if (id === '') throw new AgentRefError('Reference has an empty id', input);
    return { ref: { id, version: normalizeVersion(input.version, warnings, input) }, warnings };
  }
  const at = input.lastIndexOf('@');
  if (at <= 0) {
    throw new AgentRefError(
      `Reference "${input}" is missing a version — expected "id@major.minor.patch"`,
      input,
    );
  }
  const id = input.slice(0, at).trim();
  if (id === '') throw new AgentRefError(`Reference "${input}" has an empty id`, input);
  return { ref: { id, version: normalizeVersion(input.slice(at + 1), warnings, input) }, warnings };
}

/** Parses and discards warnings — for callers that only want the ref. */
export function toRef(input: RefInput): AgentRef {
  return parseRef(input).ref;
}

/** Formats a ref back to its canonical `id@version` storage string. */
export function formatRef(ref: AgentRef): string {
  return `${ref.id}@${ref.version}`;
}

/** True when `input` parses as a valid reference (no throw). */
export function isValidRef(input: RefInput): boolean {
  try {
    parseRef(input);
    return true;
  } catch {
    return false;
  }
}
