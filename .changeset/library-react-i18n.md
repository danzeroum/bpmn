---
'@buildtovalue/react': minor
'@buildtovalue/library-react': minor
---

#151 — i18n for the Biblioteca surfaces: `LibraryView`, `ArtifactCard` and
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
