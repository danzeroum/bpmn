# @buildtovalue/domain-example

## 1.1.0-next.0

### Minor Changes

- 7258bb7: #152 — the compensation demo seeds are PUBLIC fixtures now.

  New `@buildtovalue/domain-example/fixtures` entry exporting
  `buildCompensationEditorDiagram`, `buildCompensationSimDiagram`,
  `buildCompensationPackageDiagram` and `buildCompensationNoHandlerDiagram` —
  moved verbatim from the example app (`packages/example/src/sampleDiagram.ts`),
  which now imports the same entry (one source of truth; hosts reproducing the
  `?compensation=1` demo can drop their ported copies). Pure builders over the
  core factories: zero runtime/behavior change. The package is now publishable
  (`private` flag removed) so the entry actually reaches npm consumers.

### Patch Changes

- Updated dependencies [c4f2cbb]
- Updated dependencies [0627ee6]
- Updated dependencies [2d65a69]
- Updated dependencies [a99b6f9]
- Updated dependencies [3d7be05]
- Updated dependencies [db362a2]
- Updated dependencies [cbe56a7]
- Updated dependencies [b9b625a]
- Updated dependencies [febfdb1]
- Updated dependencies [b204522]
- Updated dependencies [a3058f3]
- Updated dependencies [e04c719]
- Updated dependencies [2dc3518]
- Updated dependencies [00b17de]
- Updated dependencies [6d7f410]
- Updated dependencies [f034a2a]
- Updated dependencies [fcaaa8f]
- Updated dependencies [56fe142]
- Updated dependencies [5215bae]
- Updated dependencies [c8223c9]
- Updated dependencies [40d6efd]
- Updated dependencies [6dbc87a]
- Updated dependencies [8825d62]
- Updated dependencies [24c4684]
- Updated dependencies [47d0de8]
- Updated dependencies [c944070]
- Updated dependencies [b4557cd]
- Updated dependencies [dc29b38]
- Updated dependencies [d8d3269]
- Updated dependencies [627dbea]
- Updated dependencies [b9d565e]
- Updated dependencies [a8b3dda]
- Updated dependencies [88b9f0f]
- Updated dependencies [febc376]
- Updated dependencies [031c379]
  - @buildtovalue/react@1.2.0-next.0
  - @buildtovalue/core@1.2.0-next.0
