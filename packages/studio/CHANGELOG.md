# @buildtovalue/studio

## 1.1.0

### Minor Changes

- e54e5f3: Handoff 15 V-5 — Studio review panel (spec §2d). `BpmnDiffViewer` grows the
  embedded review surface: Threads/Mudanças side tabs synced with the V-3
  topological list, the ⚑ approval-gate banner with "ver no canvas", justified
  thread dismissal (min 10 chars, never silent) and Esc riding the single
  dismissal stack (thread popover → ΔN popover → diff mode). New
  `reviewThreadsRule` promotion rule blocks `evaluateGates` while OPEN threads
  anchor to the target (resolved/dismissed release; orphans never block).
  `adapters-bpmn` adds `reviewThreadDismissedEntry` (+`REVIEW_THREAD_DISMISSED`
  type) for the host-appended audit trail. `ReviewScreen` accepts an optional
  `reviewStore` and embeds the split diff canvas with the gated approve button;
  without a store it renders exactly as before (declared degradation).

### Patch Changes

- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [9bee584]
- Updated dependencies [8ba65ae]
- Updated dependencies [6e94b12]
- Updated dependencies [b6f631d]
- Updated dependencies [a96973f]
- Updated dependencies [943006f]
- Updated dependencies [943006f]
- Updated dependencies [9bee584]
- Updated dependencies [e54e5f3]
  - @buildtovalue/react@1.1.0
  - @buildtovalue/adapters-bpmn@1.1.0
  - @buildtovalue/core@1.1.0
  - @buildtovalue/conformance@1.1.0
  - @buildtovalue/audit@1.1.0
  - @buildtovalue/identity@1.0.1
  - @buildtovalue/registry@1.0.1
  - @buildtovalue/soundness@1.0.1
  - @buildtovalue/copilot@1.0.1
  - @buildtovalue/library-react@1.0.1
