---
'@buildtovalue/react': minor
---

SL-10 (react) — the squad fact trail + the off-thread squad run (Handoff 22 "Squad Lane").

- `SquadTrail` — renders a headless `SquadSimResult` as the fact trail (D1): an ordered
  `intencao → acao → io → decisao → evidencia` list, each fact labeled with its provenance
  (`fixture` vs `evidencia-declarada`, E6) and its masked I/O. It is VIRTUALIZED with its OWN windowing
  (E8 — no react-window): a fixed row height + a scroll spacer means only the visible slice (+ overscan)
  mounts, so a 10k-fact trail scrolls with a bounded DOM. It is FILTERABLE by agent / kind / error, and
  STEP-ABLE (D8): step mode walks the filtered facts one at a time and shows the shared-context snapshot
  AT that step (already masked by the headless engine). It invents nothing — masking, provenance and the
  context snapshot all come straight from `simulateSquad`.
- `squadSimJob` — the squad run as an F7 compute job, registered in `DEFAULT_JOBS` as `squad-sim`, so it
  runs with the SAME agentflow engine off the main thread (or in-thread via the SyncExecutor — proven
  byte-identical). A resolver FUNCTION cannot cross a worker boundary, so the host passes a serializable
  map of member workflows keyed by `id@version` (the `routeJob` pattern); the job rebuilds the resolver
  inside the worker. Masking uses the conservative redaction across the boundary (never leaks).
- Tests: virtualization (bounded DOM + window-follows-scroll), the three filters, step mode with per-step
  context, provenance labels, the worker≡sync byte-identity, and a zero-serious/critical axe gate. i18n
  EN + PT-BR; `SquadTrail` added to the hardcoded-string cerca. apiSurface + typedoc updated.
