---
'@buildtovalue/adapters-bpmn': minor
---

feat(adapters-bpmn): escalationRaisedEntry + catálogo governado de escalação (Handoff 18 EC-3, §5c)

A ponte agente→humano ganha a cola de ledger, sem tocar o motor nem o agentflow:

- **`escalationRaisedEntry({actor, code, target})`** — builder PURO (molde
  `eventBindingChangedEntry`/`reviewCommentEntry`) que mapeia uma escalação RAISADA
  para o `AuditEntryInput` que o HOST appenda via `command.executed`; motor
  intacto. `details.author` carrega o ator para o selo ✦ do Explorer
  (`aiAuthorOf`): escalação de IA (`ia.copilot@…`) sela ✦, humana não — na mesma
  trilha. `ESCALATION_RAISED_TYPE` exportado; apiSurface.
- **`GovernedEventDefinitionRecord`** passa a tipar `kind` por `EventDefinitionRefKind`
  (fonte única, ganha `escalation`) e `definition` ganha `escalationCode?` — o
  catálogo/resolver E-3 resolve refs governadas de escalação (chip esc@ VIGENTE).

**Semântica (reforço 7):** `ESCALATION_RAISED` = "a escalação ACONTECEU", nunca
"o boundary foi desenhado". Nesta EC: builder + teste de host-append com gatilho
DEMONSTRATIVO no teste — a cola runtime (append quando `throwEscalation` disparar)
é da EC-5 (registrado em `pendencias.md`). O demo `?agentbridge=1` (no `example`)
mostra o desenho da ponte — agentTask (🤖 + ref), boundary NÃO-interrupting
governado (chip esc@ + chip de autoridade ↟) e revisão/assinatura humana — sem
observar o ledger ainda.

Zero dependência nova entre pacotes: agentflow segue independente (guard
`no-runtime-deps` + teste de independência), adapters-bpmn não importa react, o
`example` faz a cola. Degradação sem agentflow intacta (o agentTask renderiza pelo
shape do react core — teste).
