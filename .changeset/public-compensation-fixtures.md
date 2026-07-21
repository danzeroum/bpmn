---
'@buildtovalue/domain-example': minor
---

#152 — the compensation demo seeds are PUBLIC fixtures now.

New `@buildtovalue/domain-example/fixtures` entry exporting
`buildCompensationEditorDiagram`, `buildCompensationSimDiagram`,
`buildCompensationPackageDiagram` and `buildCompensationNoHandlerDiagram` —
moved verbatim from the example app (`packages/example/src/sampleDiagram.ts`),
which now imports the same entry (one source of truth; hosts reproducing the
`?compensation=1` demo can drop their ported copies). Pure builders over the
core factories: zero runtime/behavior change. The package is now publishable
(`private` flag removed) so the entry actually reaches npm consumers.
