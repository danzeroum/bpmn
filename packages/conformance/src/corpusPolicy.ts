/**
 * Corpus policy (Handoff 11 N-2): the single source for the real/generated
 * corpus proportion documented in CONFORMANCE.md and enforced by the tests.
 *
 * - The GENERATED corpus is committed (`corpus/*.bpmn`, structural
 *   equivalents, zero proprietary material); its count is frozen here and
 *   anti-drift-tested against the directory.
 * - The REAL corpus is fetched in CI (`pnpm fetch:corpus`) into the
 *   git-ignored `corpus-external/`; per-file origin + license live in its
 *   `MANIFEST.json` — NOT as in-file headers, because the round-trip suite
 *   must exercise byte-exact upstream files (decision recorded in
 *   pendencias.md §13).
 */
export const GENERATED_CORPUS_FILES = 59;

/** The round-trip gate requires at least this many real files when fetched. */
export const EXTERNAL_CORPUS_MIN = 20;

/** The fetch script caps the download at this many files. */
export const EXTERNAL_CORPUS_MAX = 40;

/** Permissive, redistributable sources only (no CC-BY-SA / share-alike). */
export const EXTERNAL_CORPUS_SOURCES = [
  { name: 'bpmn-io/bpmn-js-examples', license: 'MIT' },
  { name: 'camunda/camunda-get-started-quickstart', license: 'Apache-2.0' },
] as const;
