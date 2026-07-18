---
'@buildtovalue/react': minor
---

Named event definitions UI (Handoff 16 §3a, E-2). The properties panel gains
an "Evento" section for message/signal/error events: a named-definition
picker with the «+» flow — ONE composite command (add definition + reference
the node) so a single undo reverts both; inline rename whose cascade to every
referencing event is by construction (refs are by id — nodes never touched);
an honest usage list with click-to-navigate (U-4 animated pan,
reduced-motion respected); and deletion whose core veto (usage list in the
reason) surfaces through the existing `lastVeto` channel — the managed
definition survives unlinking so the Axelor flow "change ref → delete" is
reachable while the veto stays honest. `errorCode` renders only for error
definitions. i18n EN/PT-BR (`eventDefs` fragment), touch ≥44px, dark theme.
