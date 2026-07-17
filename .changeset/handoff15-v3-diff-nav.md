---
'@buildtovalue/react': minor
---

Handoff 15 V-3 — change-by-change navigation on the diff viewer (§2b). The
BpmnDiffViewer gains the top navigation bar ("change N of M", ←/→ and
F7/Shift+F7 with wrap), combinable category filter chips with per-kind counts
(filtering recomputes M and keeps the current item's place when it survives),
and the synced side list (active row follows navigation, clicking a row
navigates). The sequence is the SAME topologically-ordered list diffDiagrams
returns — the UI never reorders (identity test). Every step pans with the
shared panViewportTo and plays two halo pulses at the focus point
(prefers-reduced-motion → instant pan, zero pulses); REMOVED entries are
navigable — the pan goes to the ghost at the v-base position. Esc follows the
V-2 standalone decision (popover first, then the host's new `onClose` prop);
pulses ride under [data-diff-overlay] so exports stay clean mid-navigation.
Internally the component now composes the viewer providers directly — the
V-2 surface and all viewer invariants stay unchanged.
