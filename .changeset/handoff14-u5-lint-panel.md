---
'@buildtovalue/lint': minor
'@buildtovalue/adapters-bpmn': minor
'@buildtovalue/react': minor
---

Handoff 14 U-5 — lint problems dock (panel 1d). `@buildtovalue/lint` gains the
quick-fix contract `fix(ctx) → Command` (optional per rule, additive — the
`ValidationRule` shape is untouched): mechanical fixes for `duplicate-flow`,
`superfluous-gateway` (remove + reconnect in ONE composite) and
`event-endpoints`, plus versioned `LintProfile`s (`lint-etiquette@1.0.0`,
`lint-engine@1.0.0`), `lintFindings` (issues annotated with rule/profile/source
/fixability) and `fixCommandFor`. `@buildtovalue/react` ships `LintPanel`: a
resizable bottom dock grouped by rule with severity tokens, row click →
select + the SAME animated pan as search (`panViewportTo` extracted to
`canvas/viewport.ts` and now public), Esc via the dismissal stack, "corrigir"
= one undoable command, "Corrigir todos (N)" = ONE composite, and
"✦ sugerir correção" routing unfixable findings through the existing copilot
C5 pipeline (only with a host-injected `AIProvider`). Etiquette AND
engine-readiness findings share the one surface (source tag tells them apart);
open-dock canvas badges are stripped from exports (new `TRANSIENT_ATTRIBUTES`
in the exporter). `@buildtovalue/adapters-bpmn` adds `lintProfileAdapter` —
lint profiles as versioned, promotable Biblioteca artifacts with the VIGENTE
seal, reading the same `LINT_PROFILES` registry as the panel header.
