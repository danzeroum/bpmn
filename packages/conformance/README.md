# @buildtovalue/conformance

OMG BPMN 2.0 conformance tooling for [bpmn-react](https://github.com/danzeroum/bpmn):

- **Interoperability corpus** (`corpus/`, 50+ files): structural equivalents of real-world
  exports (Camunda Modeler, bpmn.io, OMG spec examples — each file header documents the pattern
  it mirrors; generated content, no proprietary material). Every file must import without a
  fatal error and its re-export must re-import identically (`normalizeForDiff`); per-file
  warning counts are snapshotted so fidelity regressions are detectable.
- **External corpus** (`corpus-external/`, ≥20 files, git-ignored): **real** third-party
  exports (bpmn-js-examples, Camunda quick-starts — MIT / Apache-2.0), downloaded on demand by
  `scripts/fetch-corpus.mjs` (run in CI before the tests; DMN TCK / CC-BY-SA sources excluded).
  `tests/corpusExternal.test.ts` requires each to import without a fatal error and round-trip
  structurally; it skips when the directory is absent, so the build never depends on the network.
- **Conformance matrix** (`CONFORMANCE_MATRIX`): element-by-element status
  (supported / partial / degraded / unsupported) with Descriptive/Analytic class coverage.
- **`renderConformanceMarkdown()`**: renders the repository's `CONFORMANCE.md`
  deterministically; CI fails when the committed file goes stale
  (regenerate with `node scripts/gen-conformance.mjs`).

Headless, zero runtime dependencies (consumes only `@buildtovalue/core`). License: Apache-2.0.
