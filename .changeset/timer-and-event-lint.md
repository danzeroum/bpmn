---
'@buildtovalue/core': minor
'@buildtovalue/lint': minor
'@buildtovalue/react': minor
---

Handoff 16 E-5 — EVT_*/TIMER_* lint, headless ISO 8601 parser and the timer
editor (spec §3d, with the E-0 amendment). core: `parseTimerExpression`
(date / duration / cycle — total, never throws; `P1M` is one MONTH, `PT1M`
one MINUTE) returning a STRUCTURED result, plus the canonical
`properties.timer = { kind, expression }` exported as the standard OMG
`timeDate`/`timeDuration`/`timeCycle` child of the `timerEventDefinition` —
ONLY on timer events (on any other node the property stays an ordinary
`bpmnr:property`, never an orphan OMG child); byte-stable round-trip, absent
field keeps prior exports byte-identical. lint: new rules in the shipped
profiles (now 1.1.0 — a new promotable policy version): `EVT_START_THROW`,
`EVT_END_CATCH`, `EVT_ERROR_START_TOPLEVEL` (etiquette; same containment
predicate as the editor's Execução matrix) and `EVT_REF_MISSING` (warning,
with a KIND-AWARE mechanical quick-fix: one composite creating a definition
of the event's own kind and referencing it) + `TIMER_MALFORMED` (error via
the parser; no mechanical fix — guessing intent is not mechanical). react:
`TimerSection` — kind select, ISO 8601 expression and a HUMAN i18n preview
built from the parser's structured result; an invalid expression shows ONLY
the glyph+text notice (never a guessed preview) and an empty expression
removes the property entirely.
