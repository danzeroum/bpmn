# @bpmn-react/conformance

OMG BPMN 2.0 conformance tooling for [bpmn-react](https://github.com/danzeroum/bpmn):

- **Interoperability corpus** (`corpus/`, 50+ files): structural equivalents of real-world
  exports (Camunda Modeler, bpmn.io, OMG spec examples — each file header documents the pattern
  it mirrors; generated content, no proprietary material). Every file must import without a
  fatal error and its re-export must re-import identically (`normalizeForDiff`); per-file
  warning counts are snapshotted so fidelity regressions are detectable.
- **Conformance matrix** (`CONFORMANCE_MATRIX`): element-by-element status
  (supported / partial / degraded / unsupported) with Descriptive/Analytic class coverage.
- **`renderConformanceMarkdown()`**: renders the repository's `CONFORMANCE.md`
  deterministically; CI fails when the committed file goes stale
  (regenerate with `node scripts/gen-conformance.mjs`).

Headless, zero runtime dependencies (consumes only `@bpmn-react/core`). License: Apache-2.0.
