---
'@buildtovalue/react': minor
---

SL-13 — readiness badges (single source) + reconciliation + i18n/a11y sweep (Handoff 22 "Squad Lane"),
the closing chore.

- `ReadinessBadge` — the ONE way any surface paints an agent's/squad's readiness. It derives the state
  SOLELY from the pure `readinessState()` (cerca §2.11 — painting a state in the UI is prohibited); the guard
  test compares the badge to `readinessState()` across all four states, so a component that derived its own
  state would break the build (acceptance §10.7). The four derived states are the ceiling; the host runtime
  states (`executando` / `erro-de-integracao`) show ONLY when the host informs them via `hostStatus` —
  `apto-para-integracao` never becomes `executando` on its own. Wired into AgentStudio's header (readiness
  from the studio's own validation + whether a completed simulation exists). i18n EN + PT-BR; zero
  serious/critical axe.
- `docs/design_handoff_btv_squad_lane/RECONCILIACAO.md` — the item-by-item scorecard of SL-1…SL-13 against
  §10 (every acceptance criterion → where it is satisfied: SL, file, test), plus the registered boundaries
  (the three distinct gate layers; manifest↔diagram round-trip; off-thread masking; host-only runtime states).
- i18n/a11y sweep: the new surface carries EN + PT-BR and passes the hardcoded-string cerca + the axe gate;
  the full suite stays green under coverage with independence/acidez and the conformance corpus untouched.
