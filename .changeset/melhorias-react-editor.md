---
'@buildtovalue/react': minor
---

Editor UX/a11y/perf round (melhorias Bloco B): clipboard (Ctrl+C/X/V),
duplicate (Ctrl+D) and select-all (Ctrl+A) with atomic undo and id remapping;
roving keyboard focus on canvas elements (keyboard-only selection); axe gate
now fails on serious violations; canvas surfaces fully i18n'd (new `canvas.*`
keys — closed-element seal, ports, resize handles, recovery banner, no-route
title); consolidated per-element store selectors; connect-gesture rules
evaluated only on hover-target change; new subpath exports
`./simulation`, `./replay`, `./agent`, `./copilot`; manual dark-theme
counterparts for the DMN token blocks; arrow nudge is now 1px (Shift = grid).
