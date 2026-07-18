---
'@buildtovalue/react': minor
---

feat(react): escalação visual + autoridade + paleta não-interrupting (Handoff 18 EC-2, §5b)

O kind escalation entra em TODOS os gates locais da react (zero fork) e ganha a
personalidade BTV:

- **Gates alinhados na mesma PR**: `REF_KINDS`/`eventKindOf`
  (`EventDefinitionSection`), `eventBindingRule` e o overlay de chips
  (`overlays`) passam a aceitar `escalation`; o picker E-2 lista o bucket com
  `escalationCode` por tipo (molde do `errorCode`, assimetria testada).
- **Glifo + tracejado**: o chevron ↟ vem da fonte única `eventGlyph` (já
  existia — pintado, nunca duplicado); tracejado só não-interrupting via
  `isNonInterrupting`. Snapshot do boundary comum intacto.
- **Item de paleta dedicado «Escalation (boundary)»** (composto, molde ES-2):
  boundary + definição local + ref num 1 undo, `cancelActivity:false` explícito
  (default não-interrupting DECLARADO). **Reforço 7**: o drop precisa de host —
  sobre uma atividade anexa (anchor N-1), em canvas vazio recusa com veto
  declarado no 🔒 (`announceVeto`), nunca boundary órfão nem no-op mudo. O
  `InterruptingToggle` existente passa a servir boundaries (flipa `cancelActivity`).
- **Chips governados + autoridade**: o resolver E-3 (widened na EC-1) resolve
  escalação ponta-a-ponta; chip `esc-nome@semver` + selo. Novo chip de
  **autoridade** (`properties.escalationAuthority` → `bpmnr:`) — **reforço 8**: lê
  o valor ASSENTADO (commit no blur do inspector), autoridade vazia = ausente
  (sem chip). Ambos os chips são overlays transientes (nunca exportados).
- **Esub**: o shape colapsado já pinta o glifo do start de escalação.
  **Estado transitório registrado**: a lista de kinds do lint `EVT_SUBPROC_START`
  só ganha escalation na EC-4 — entre EC-2 e EC-4 o esub-escalação renderiza mas
  o lint ainda o sinaliza (dock advisório, sem quebra).
- **Transversais**: i18n EN/PT-BR (código, autoridade, veto, composto), touch,
  apiSurface react (`buildEscalationBoundaryInsert`, `hasInterruptingToggle`,
  `PaletteInsertResult`), pisos, dark, e2e (`?escalation=1` + veto em `?empty=1`).

Fora da EC-2: EC-3 ponte agente→humano + ledger · EC-4 lint 1.3.0 · EC-5
`throwEscalation`/dissolve.
