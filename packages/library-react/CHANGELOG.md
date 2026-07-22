# @buildtovalue/library-react

## 1.1.0-next.0

### Minor Changes

- 6dbc87a: #151 — i18n for the Biblioteca surfaces: `LibraryView`, `ArtifactCard` and
  `ArtifactDrawer` join the same i18n contract as every other public surface.

  - library-react: the three components accept `messages?: Messages` and resolve
    every UI string through `useT()` — resolution order: `messages` prop → an
    ancestor `<I18nProvider>` → the per-key English fallback (no provider, no
    prop → English, the standard embedded default).
  - react: new `library.*` dictionary fragment (EN + PT-BR) covering filters,
    search, sort, empty state, card runs chips and the whole detail drawer; the
    keys ship in `PT_BR` so `messages={PT_BR}` (or the host toggle) localizes the
    entire `/library` screen.
  - The three files join the `check-no-hardcoded-strings` static gate (MIGRATED).

### Patch Changes

- Updated dependencies [c4f2cbb]
- Updated dependencies [2d65a69]
- Updated dependencies [a99b6f9]
- Updated dependencies [3d7be05]
- Updated dependencies [db362a2]
- Updated dependencies [febfdb1]
- Updated dependencies [b204522]
- Updated dependencies [a3058f3]
- Updated dependencies [e04c719]
- Updated dependencies [00b17de]
- Updated dependencies [6d7f410]
- Updated dependencies [f034a2a]
- Updated dependencies [fcaaa8f]
- Updated dependencies [5215bae]
- Updated dependencies [c8223c9]
- Updated dependencies [40d6efd]
- Updated dependencies [6dbc87a]
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

## 1.0.1

### Patch Changes

- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [6e94b12]
- Updated dependencies [b6f631d]
- Updated dependencies [a96973f]
- Updated dependencies [943006f]
- Updated dependencies [9bee584]
- Updated dependencies [e54e5f3]
  - @buildtovalue/react@1.1.0
