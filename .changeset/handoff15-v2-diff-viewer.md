---
'@buildtovalue/react': minor
---

Handoff 15 V-2 — `BpmnDiffViewer`: the review diff painted on the read-only
viewer (§2a). Renders the target diagram on the N-7 viewer with the V-1
`diffDiagrams` output painted over it, to the spec mock's binding semantics:
unchanged elements dim to 45% (never hidden); removed = dashed ghost AT the
v-base position (−REM); moved = ghost at the origin + arrow to the
destination (→MOV); added = halo + tag (+ADD); changed = dashed halo +
clickable ΔN badge opening the before→after property popover; rerouted paints
the ROUTE (↷ROTA), never the nodes, and never counts as Δ. Colors come from
the existing tokens per the V-0 decision (added --btv-green, removed
--btv-error, moved --btv-gold, changed --btv-ink) — always glyph+text, never
color alone. Floating legend with per-category counts and the total. The
whole overlay is transient ([data-diff-overlay] in TRANSIENT_SELECTORS, the
data-diff-state paint in TRANSIENT_ATTRIBUTES) — exports stay clean
mid-diff. Read-only is absolute (binding test: no mutation reachable) and
nothing of the review ever touches the model — XML round-trip stays
byte-identical with review active. The viewer render without diffStates is
byte-identical to before (viewerEquivalence intact); the viewer entry keeps
its dep-graph boundary and size budget.
