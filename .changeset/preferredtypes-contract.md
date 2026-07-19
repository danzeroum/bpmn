---
'@buildtovalue/core': patch
---

Handoff 21 N-1 — `preferredTypes` no longer degrades a node's type identity in
silence (the library's "declared, never silent" fence).

- On import, the two paths that dropped a requested type identity without a
  warning now declare it: an unregistered `meta.type` warns per element
  (`… requested meta type "X", which is not registered — imported as <tag>`),
  and an unregistered `preferredTypes` entry warns once per requested type
  (`Preferred type "X" is not registered — ignored`). Type resolution itself is
  unchanged; `NodeTypeRegistry.typeForXmlTag` stays a pure primitive.
- The full behavior is frozen as a **contract matrix** in `docs/format-spec.md`
  (using the conformance vocabulary supported/degraded/unsupported), and every
  row cites the test in `packages/core/tests/preferredTypesContract.test.ts`
  that pins it — matrix and suite cannot drift.
- Fidelity snapshot `corpus-warnings.json` regenerated: `58-agent-task-v1.bpmn`
  goes 0 → 1 warning, surfacing a `btv:gate` identity that was silently
  downgraded to `<task>`.
