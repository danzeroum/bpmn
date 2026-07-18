---
'@buildtovalue/react': minor
---

Handoff 17 ES-2 — event-subprocess shapes and the composite palette item
(spec §4b). `SubProcessShape` consumes the core `isEventSubprocess` predicate
(never reimplemented): the OMG thin DOTTED border + `event subProcess` tag,
with the COMMON subProcess byte-identical to before (frozen markup fixture);
collapsed containers show the trigger glyph of the FIRST typed start child —
0 starts / >1 starts / kindless starts degrade to no glyph, never a crash
(fixing the model is the lint's job). `StartEventShape` draws DASHED when
`startIsInterrupting(node) === false` (the H6 boundary dash), glyphs reused
from the single `eventGlyph` source. New documented public surface:
`PaletteItem.build` — a composite insert factory resolved by ONE code path
(`paletteInsertCommand`/`insertPaletteItem`) shared by the palette click and
the new `palette.insert.*` ⌘K registry (`paletteInsertCommands`, anti-drift
tested). The shipped «Event Subprocess» item creates container + typed
message start + referenced named definition in ONE undo — lint-clean by
construction. Palette labels now resolve `palette.item.{id}` from the i18n
dictionary when present (additive; existing items unchanged). Dashes are SVG
geometry, faithful in SVG/PNG export and both themes. Also new:
`useDiagramOrNull` (tolerant context hook for pure shapes).
