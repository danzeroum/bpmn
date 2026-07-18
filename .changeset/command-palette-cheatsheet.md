---
'@buildtovalue/react': minor
---

Handoff 15 V-7 — command palette, cheatsheet and empty state (spec §2f). The
ContextMenu's conditional built-ins are extracted into a command registry
(`builtinMenuItems`/`pluginMenuItems`/`pluginPadItems`, equivalence-tested
before the refactor) and joined by `builtinGlobalCommands` (toolbar-level
actions). The new Ctrl/Cmd+K `CommandPalette` has NO list of its own — it
aggregates exactly those registries, respects `when()` against the real
selection context, executes only via commands, and rides the single Esc
dismissal stack. The "?" `Cheatsheet` is generated from the SAME aggregate
plus the declared `KEYBOARD_SHORTCUT_CATALOG` (an anti-drift sweep test fails
on any handler key not in the catalog). The empty canvas shows a teaching
`EmptyState` with a one-click GOVERNED example (`buildGovernedExample` — real
version block, not a loose sample); it disappears at the first element and
returns if the canvas empties.
